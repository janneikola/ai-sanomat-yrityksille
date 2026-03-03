/**
 * X/Twitter-avainsanahakupalvelu.
 * Hakee per-asiakas avainsanahaut Apifyn kautta ja tallentaa news_items-tauluun.
 * Ajetaan on-demand asiakkaille joiden katsaus eraantyy 24h sisalla (kuten webSearchService).
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { newsItems, newsSources } from '../db/schema.js';
import { searchTweets, type ApifyTweet } from '../integrations/xClient.js';
import {
  logFetchAttempt,
  updateSourceHealth,
  checkAutoDisable,
  checkHealthTransitionNotification,
} from './sourceHealthService.js';
import { recordBudgetUsage, checkBudget } from './xBudgetService.js';

interface XSearchConfig {
  query: string;
  language?: string;
  clientId?: number;
}

// Engagement-kynnysarvot: matala jotta breaking news ei jaisi huomaamatta
const MIN_LIKES = 5;
const MIN_RETWEETS = 2;

/**
 * Normalisoi twiitin URL:n yhtenaiseen x.com-muotoon.
 */
function normalizeTweetUrl(tweet: ApifyTweet): string {
  const userName = tweet.author?.userName;
  if (userName && tweet.id) {
    return `https://x.com/${userName}/status/${tweet.id}`;
  }
  if (tweet.url) {
    try {
      const parsed = new URL(tweet.url);
      parsed.search = '';
      return parsed.toString().replace('twitter.com', 'x.com');
    } catch {
      return tweet.url;
    }
  }
  return `https://x.com/unknown/status/${tweet.id}`;
}

/**
 * Suodattaa hakutulokset: ohittaa retwiitit, vastaukset ja matalan sitoutumisen twiitit.
 */
function filterSearchResults(tweets: ApifyTweet[]): ApifyTweet[] {
  return tweets.filter((tweet) => {
    if (tweet.isRetweet === true) return false;
    if (tweet.isReply === true) return false;
    // Engagement threshold: vahintaan 5 tykkayst TAI 2 retwiittia
    if (tweet.likeCount < MIN_LIKES && tweet.retweetCount < MIN_RETWEETS) return false;
    return true;
  });
}

/**
 * Suorittaa X-avainsanahaun yksittaiselle asiakkaalle.
 * Hakee asiakkaan x_search-lahteet, suorittaa haut ja tallentaa tulokset.
 */
export async function searchXForClient(clientId: number): Promise<{
  collected: number;
  queries: number;
}> {
  const searchSources = await db
    .select()
    .from(newsSources)
    .where(
      and(
        eq(newsSources.type, 'x_search'),
        eq(newsSources.isActive, true)
      )
    );

  // Suodata lahteet jotka kuuluvat talle asiakkaalle (config.clientId)
  const clientSources = searchSources.filter((source) => {
    if (!source.config) return false;
    try {
      const config = JSON.parse(source.config) as XSearchConfig;
      return config.clientId === clientId;
    } catch {
      return false;
    }
  });

  let collected = 0;
  let queries = 0;

  for (const source of clientSources) {
    try {
      const config = JSON.parse(source.config!) as XSearchConfig;

      // Budjetin tarkistus (pehmea)
      const budget = await checkBudget();
      if (budget.remaining <= 0) {
        console.warn(`X budget exceeded ($${budget.spent.toFixed(2)}/$${budget.limit}), continuing anyway for search "${config.query}"`);
      }

      const tweets = await searchTweets([config.query], 50);
      queries++;

      const filtered = filterSearchResults(tweets);

      let sourceCollected = 0;
      for (const tweet of filtered) {
        const url = normalizeTweetUrl(tweet);
        if (!url) continue;

        const result = await db
          .insert(newsItems)
          .values({
            sourceId: source.id,
            title: tweet.text.slice(0, 100) + (tweet.text.length > 100 ? '...' : ''),
            url,
            summary: tweet.text,
            publishedAt: new Date(tweet.createdAt),
          })
          .onConflictDoNothing();

        if (result.rowCount && result.rowCount > 0) {
          sourceCollected++;
        }
      }

      collected += sourceCollected;

      // Terveysseuranta
      await logFetchAttempt(source.id, true, sourceCollected, null);
      await updateSourceHealth(source.id, true, sourceCollected);

      // Kustannusseuranta
      if (tweets.length > 0) {
        await recordBudgetUsage('search', source.id, tweets.length);
      }
    } catch (error) {
      console.error(`X search failed for source ${source.name}:`, error);

      const oldFailures = source.consecutiveFailures ?? 0;
      const newFailureCount = oldFailures + 1;

      await logFetchAttempt(source.id, false, 0, String(error));
      await updateSourceHealth(source.id, false, 0);
      await checkAutoDisable(source.id, newFailureCount);
      await checkHealthTransitionNotification(source.name, oldFailures, newFailureCount);
    }
  }

  return { collected, queries };
}
