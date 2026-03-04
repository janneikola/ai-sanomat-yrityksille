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
import { collectXAccounts } from './xCollectorService.js';
import { searchXForClient } from './xSearchService.js';
import { fetchAndStoreOgImage } from './ogService.js';

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
        const rows = await db
          .insert(newsItems)
          .values({
            sourceId: source.id,
            title: item.title,
            url: item.url,
            summary: item.summary,
            publishedAt: item.publishedAt,
          })
          .onConflictDoNothing()
          .returning({ id: newsItems.id });

        if (rows.length > 0) {
          collected++;
          fetchAndStoreOgImage(rows[0].id, item.url).catch(console.error);
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

  // X/Twitter: hae influensseri-tilit
  let xCollected = 0;
  try {
    const xResult = await collectXAccounts();
    xCollected = xResult.collected;
    if (xCollected > 0) {
      console.log(`X accounts: ${xResult.collected} new items, ${xResult.errors} errors`);
    }
  } catch (error) {
    console.error('X account collection failed:', error);
  }

  // Hae asiakkaat joiden katsaus eraantyy 24h sisalla (jaetaan web- ja X-haun kesken)
  let dueClients: Array<{ id: number; name: string }> = [];
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

    dueClients = webSearchClients.filter((c) =>
      isDueWithin24Hours(c.scheduleFrequency, c.scheduleDay, c.scheduleBiweeklyWeek)
    );
  } catch (error) {
    console.error('Due client query failed:', error);
  }

  // Verkkohaku: hae AI-uutisia verkosta asiakkaille joiden katsaus eraantyy 24h sisalla
  let webSearchCollected = 0;
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

  // X/Twitter-haku: hae hakusanat asiakkaille joiden katsaus eraantyy 24h sisalla
  let xSearchCollected = 0;
  for (const client of dueClients) {
    try {
      const xResult = await searchXForClient(client.id);
      xSearchCollected += xResult.collected;
      if (xResult.collected > 0) {
        console.log(`X search for ${client.name}: ${xResult.collected} new items (${xResult.queries} queries)`);
      }
    } catch (error) {
      console.error(`X search failed for client ${client.name}:`, error);
    }
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

  return { collected: collected + webSearchCollected + xCollected + xSearchCollected, errors, sources: sources.length };
}
