import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clients, newsItems, newsSources, searchCache } from '../db/schema.js';
import { searchTavily, type TavilyResult } from '../integrations/tavilyClient.js';
import { isDueToday } from './scheduleService.js';
import { logFetchAttempt, updateSourceHealth } from './sourceHealthService.js';

const AI_KEYWORDS = [
  'ai', 'artificial intelligence', 'tekoaly', 'machine learning',
  'koneoppiminen', 'neural', 'gpt', 'llm', 'generative',
  'deep learning', 'syvaoppiminen', 'chatbot', 'automation',
  'automaatio', 'robotiikka', 'robotics',
];

/**
 * Generoi hakukyselyt asiakkaan toimialan ja mahdollisen muokatun kehotteen perusteella.
 */
export function generateSearchQueries(
  industry: string,
  customPrompt?: string | null
): string[] {
  if (customPrompt) {
    return [
      customPrompt,
      `${customPrompt} ${industry}`,
    ];
  }
  return [
    `AI ${industry} news`,
    `artificial intelligence ${industry} latest`,
    `${industry} tekoaly uutiset`,
  ];
}

/**
 * Tarkistaa onko sisalto AI-relevanttia avainsanojen perusteella.
 */
export function isAIRelevant(title: string, content: string): boolean {
  const text = `${title} ${content}`.toLowerCase();
  return AI_KEYWORDS.some((keyword) => text.includes(keyword));
}

/**
 * Tarkistaa onko asiakas eraantyva 24 tunnin sisalla (tanaan tai huomenna).
 */
export function isDueWithin24Hours(
  frequency: 'weekly' | 'biweekly' | 'monthly',
  preferredDay: number,
  biweeklyWeek: string | null
): boolean {
  const today = new Date();
  if (isDueToday(frequency, preferredDay, biweeklyWeek, today)) {
    return true;
  }
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isDueToday(frequency, preferredDay, biweeklyWeek, tomorrow);
}

/**
 * Hakee Tavilyta valimuistin kautta (24h TTL).
 */
export async function searchWithCache(
  query: string,
  clientId: number
): Promise<TavilyResult[]> {
  const queryHash = query.toLowerCase().trim();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Tarkista valimuisti
  const cached = await db
    .select()
    .from(searchCache)
    .where(
      and(
        eq(searchCache.queryHash, queryHash),
        eq(searchCache.clientId, clientId),
        gt(searchCache.cachedAt, twentyFourHoursAgo)
      )
    )
    .limit(1);

  if (cached.length > 0) {
    return JSON.parse(cached[0].results) as TavilyResult[];
  }

  // Valimuistissa ei ole -- hae Tavilylta
  const results = await searchTavily(query);

  // Tallenna valimuistiin
  await db.insert(searchCache).values({
    queryHash,
    query,
    clientId,
    results: JSON.stringify(results),
    resultCount: results.length,
  });

  return results;
}

/**
 * Etsii tai luo jaetun "Web Search" -uutislahteen terveysseurantaa varten.
 */
async function getOrCreateWebSearchSource(): Promise<number> {
  const existing = await db
    .select()
    .from(newsSources)
    .where(
      and(
        eq(newsSources.type, 'web_search'),
        eq(newsSources.name, 'Web Search')
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const [created] = await db
    .insert(newsSources)
    .values({
      name: 'Web Search',
      type: 'web_search',
      isActive: true,
    })
    .returning();

  return created.id;
}

/**
 * Suorittaa verkkohaun yksittaiselle asiakkaalle.
 * Generoi kyselyt, hakee valimuistin kautta, suodattaa ei-AI-tulokset,
 * ja tallentaa relevantit uutiset tietokantaan.
 */
export async function searchForClient(
  clientId: number
): Promise<{ collected: number; queries: number; cached: number }> {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId));

  if (!client) {
    throw new Error(`Client ${clientId} not found`);
  }

  const sourceId = await getOrCreateWebSearchSource();
  const queries = generateSearchQueries(client.industry, client.searchPrompt);

  let collected = 0;
  let cachedCount = 0;

  for (const query of queries) {
    const queryHash = query.toLowerCase().trim();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Tarkista onko valimuistissa (cached-laskurin paivittamiseen)
    const wasCached = await db
      .select()
      .from(searchCache)
      .where(
        and(
          eq(searchCache.queryHash, queryHash),
          eq(searchCache.clientId, clientId),
          gt(searchCache.cachedAt, twentyFourHoursAgo)
        )
      )
      .limit(1);

    if (wasCached.length > 0) {
      cachedCount++;
    }

    try {
      const results = await searchWithCache(query, clientId);

      // Suodata AI-relevantit tulokset
      const relevant = results.filter((r) => isAIRelevant(r.title, r.content));

      for (const item of relevant) {
        if (!item.url) continue;

        const result = await db
          .insert(newsItems)
          .values({
            sourceId,
            title: item.title,
            url: item.url,
            summary: item.content.slice(0, 500) || null,
            publishedAt: item.publishedDate ? new Date(item.publishedDate) : null,
          })
          .onConflictDoNothing();

        if (result.rowCount && result.rowCount > 0) {
          collected++;
        }
      }
    } catch (error) {
      console.error(`Web search query failed: "${query}"`, error);
    }
  }

  // Paivita asiakkaan viimeinen hakuaika
  await db
    .update(clients)
    .set({ lastWebSearchAt: new Date() })
    .where(eq(clients.id, clientId));

  // Terveysseuranta jaetun web search -lahteen kautta
  await logFetchAttempt(sourceId, true, collected, null);
  await updateSourceHealth(sourceId, true, collected);

  return { collected, queries: queries.length, cached: cachedCount };
}
