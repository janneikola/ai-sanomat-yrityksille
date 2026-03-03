import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { newsItems, newsSources, clients } from '../db/schema.js';
import { fetchRssFeed } from '../integrations/rssCollector.js';
import { fetchBeehiivPosts } from '../integrations/beehiivClient.js';
import {
  logFetchAttempt,
  updateSourceHealth,
  checkAutoDisable,
  checkHealthTransitionNotification,
} from './sourceHealthService.js';
import { searchForClient, isDueWithin24Hours } from './webSearchService.js';
import { processNewEmbeddings } from './deduplicationService.js';

export async function collectAllNews() {
  const sources = await db
    .select()
    .from(newsSources)
    .where(eq(newsSources.isActive, true));

  let collected = 0;
  let errors = 0;

  // Kasataan lahteet perakkkain (ei Promise.all) nopeusrajoitusten valttamiseksi
  for (const source of sources) {
    try {
      let items: Array<{
        title: string;
        url: string;
        summary: string | null;
        publishedAt: Date | null;
      }> = [];

      if (source.type === 'rss' && source.url) {
        items = await fetchRssFeed(source.url);
      } else if (source.type === 'beehiiv' && source.config) {
        const config = JSON.parse(source.config) as {
          publicationId: string;
        };
        items = await fetchBeehiivPosts(
          config.publicationId,
          process.env.BEEHIIV_API_KEY!
        );
      }

      for (const item of items) {
        if (!item.url) continue;

        // Hiljainen deduplikointi -- onConflictDoNothing URL:n uniikkirajoitteella
        const result = await db
          .insert(newsItems)
          .values({
            sourceId: source.id,
            title: item.title,
            url: item.url,
            summary: item.summary,
            publishedAt: item.publishedAt,
          })
          .onConflictDoNothing();

        if (result.rowCount && result.rowCount > 0) {
          collected++;
        }
      }

      // Terveyden seuranta: onnistunut haku
      await logFetchAttempt(source.id, true, items.length, null);
      await updateSourceHealth(source.id, true, items.length);
    } catch (error) {
      // Kirjataan virhe ja jatketaan -- yksi epaonnistunut lahde ei saa estaa muita
      console.error(`Failed to collect from ${source.name}:`, error);
      errors++;

      // Terveyden seuranta: epaonnistunut haku
      const oldFailures = source.consecutiveFailures ?? 0;
      const newFailureCount = oldFailures + 1;

      await logFetchAttempt(source.id, false, 0, String(error));
      await updateSourceHealth(source.id, false, 0);
      await checkAutoDisable(source.id, newFailureCount);
      await checkHealthTransitionNotification(source.name, oldFailures, newFailureCount);
    }
  }

  // Verkkohaku: hae AI-uutisia verkosta asiakkaille joiden katsaus eraantyy 24h sisalla
  let webSearchCollected = 0;
  try {
    const webSearchClients = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.isActive, true),
          eq(clients.webSearchEnabled, true),
          eq(clients.schedulePaused, false)
        )
      );

    const dueClients = webSearchClients.filter((c) =>
      isDueWithin24Hours(c.scheduleFrequency, c.scheduleDay, c.scheduleBiweeklyWeek)
    );

    for (const client of dueClients) {
      try {
        const result = await searchForClient(client.id);
        webSearchCollected += result.collected;
        console.log(
          `Web search for ${client.name}: ${result.collected} new items (${result.queries} queries, ${result.cached} cached)`
        );
      } catch (error) {
        console.error(`Web search failed for client ${client.name}:`, error);
        errors++;
      }
    }
  } catch (error) {
    console.error('Web search client query failed:', error);
  }

  // Semanttinen deduplikointi: generoi upotukset uusille uutisille ja etsi duplikaatit
  try {
    const dedupResult = await processNewEmbeddings();
    if (dedupResult.embedded > 0) {
      console.log(
        `Deduplication: ${dedupResult.embedded} items embedded, ${dedupResult.duplicatesFound} duplicates found`
      );
    }
  } catch (error) {
    console.error('Deduplication processing failed:', error);
  }

  return { collected: collected + webSearchCollected, errors, sources: sources.length };
}
