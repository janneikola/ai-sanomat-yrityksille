import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { newsItems, newsSources } from '../db/schema.js';
import { fetchRssFeed } from '../integrations/rssCollector.js';
import { fetchBeehiivPosts } from '../integrations/beehiivClient.js';

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
    } catch (error) {
      // Kirjataan virhe ja jatketaan -- yksi epaonnistunut lahde ei saa estaa muita
      console.error(`Failed to collect from ${source.name}:`, error);
      errors++;
    }
  }

  return { collected, errors, sources: sources.length };
}
