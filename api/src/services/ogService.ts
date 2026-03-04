import ogs from 'open-graph-scraper';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { newsItems } from '../db/schema.js';

const GENERIC_URL_PATTERNS = ['default', 'logo', 'fallback', 'placeholder'];

/**
 * Checks if an image URL looks like a generic site-wide image
 * (logo, placeholder, fallback, default) rather than article-specific.
 */
export function isGenericImageUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return GENERIC_URL_PATTERNS.some((pat) => lowerUrl.includes(pat));
}

/**
 * Returns the og:image URL from a page, or null if none / rejected as generic.
 * Timeout is 4 seconds (within the 3-5s requirement).
 */
export async function fetchOgImage(url: string): Promise<string | null> {
  const { error, result } = await ogs({
    url,
    timeout: 4, // SECONDS not milliseconds
    fetchOptions: {
      headers: { 'User-Agent': 'AI-Sanomat-Collector/1.0' },
    },
  });

  if (error || !result.ogImage || result.ogImage.length === 0) return null;

  const imageUrl = result.ogImage[0].url;
  if (!imageUrl) return null;

  if (isGenericImageUrl(imageUrl)) return null;

  return imageUrl;
}

/**
 * Fetches og:image and writes it to newsItems.ogImageUrl.
 * All errors silently ignored — the article record is never affected.
 */
export async function fetchAndStoreOgImage(
  newsItemId: number,
  url: string
): Promise<void> {
  const imageUrl = await fetchOgImage(url);
  if (imageUrl) {
    await db
      .update(newsItems)
      .set({ ogImageUrl: imageUrl })
      .where(eq(newsItems.id, newsItemId));
  }
}
