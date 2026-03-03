import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { newsItems, newsSources } from '../db/schema.js';
import type { FeaturedPost } from '../types/digest.js';

/**
 * Hakee uusimmat aisanomat.fi-blogipostaukset "AI-Sanomat suosittelee" -osiota varten.
 * Kayttaa olemassa olevaa Beehiiv-lahdetta news_items-taulusta — ei erillista keraajaa.
 */
export async function getFeaturedPosts(limit = 3): Promise<FeaturedPost[]> {
  const posts = await db
    .select({
      title: newsItems.title,
      url: newsItems.url,
      summary: newsItems.summary,
    })
    .from(newsItems)
    .innerJoin(newsSources, eq(newsItems.sourceId, newsSources.id))
    .where(
      and(
        eq(newsSources.type, 'beehiiv'),
        eq(newsSources.isActive, true)
      )
    )
    .orderBy(desc(newsItems.publishedAt))
    .limit(limit);

  return posts;
}
