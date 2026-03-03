/**
 * X/Twitter-influensseritilien keraamispalvelu.
 * Hakee x_account-lahteiden aikajanat Apifyn kautta ja tallentaa news_items-tauluun.
 * Ajetaan paivittain RSS/Beehiiv-lahtojen rinnalla.
 */

import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { newsItems, newsSources } from '../db/schema.js';
import { fetchTweetsByHandle, type ApifyTweet } from '../integrations/xClient.js';
import {
  logFetchAttempt,
  updateSourceHealth,
  checkAutoDisable,
  checkHealthTransitionNotification,
} from './sourceHealthService.js';
import { recordBudgetUsage, checkBudget } from './xBudgetService.js';

interface XAccountConfig {
  handle: string;
  description?: string;
  includeReplies?: boolean;
  minLikes?: number;
}

/**
 * Normalisoi twiitin URL:n yhtenaiseen x.com-muotoon.
 * Estaa duplikaatit eri URL-formaateista (twitter.com vs x.com, query-parametrit).
 */
function normalizeTweetUrl(tweet: ApifyTweet): string {
  const userName = tweet.author?.userName;
  if (userName && tweet.id) {
    return `https://x.com/${userName}/status/${tweet.id}`;
  }
  // Fallback: kayta twiitin omaa URL:aa (strippaa query-parametrit)
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
 * Suodattaa twiitit konfiguraation mukaan.
 * Ohittaa retwiitit ja vastaukset (paitsi jos includeReplies on paalla).
 */
function filterTweets(tweets: ApifyTweet[], config: XAccountConfig): ApifyTweet[] {
  return tweets.filter((tweet) => {
    if (tweet.isRetweet === true) return false;
    if (tweet.isReply === true && !config.includeReplies) return false;
    if (config.minLikes && tweet.likeCount < config.minLikes) return false;
    return true;
  });
}

/**
 * Keraa twiitit kaikilta aktiivisilta x_account-lahteilta.
 * Suodattaa, normalisoi URL:t ja tallentaa news_items-tauluun.
 */
export async function collectXAccounts(): Promise<{ collected: number; errors: number }> {
  const sources = await db
    .select()
    .from(newsSources)
    .where(eq(newsSources.isActive, true));

  const xSources = sources.filter((s) => s.type === 'x_account' && s.config);

  let collected = 0;
  let errors = 0;

  for (const source of xSources) {
    try {
      const config = JSON.parse(source.config!) as XAccountConfig;

      // Budjetin tarkistus (pehmea -- varoittaa mutta ei esta)
      const budget = await checkBudget();
      if (budget.remaining <= 0) {
        console.warn(`X budget exceeded ($${budget.spent.toFixed(2)}/$${budget.limit}), continuing anyway for @${config.handle}`);
      }

      const tweets = await fetchTweetsByHandle(config.handle, 20);
      const filtered = filterTweets(tweets, config);

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

      // Terveysseuranta: onnistunut haku
      await logFetchAttempt(source.id, true, sourceCollected, null);
      await updateSourceHealth(source.id, true, sourceCollected);

      // Kustannusseuranta (kaikki haetut twiitit, ei vain suodatetut)
      if (tweets.length > 0) {
        await recordBudgetUsage('influencer', source.id, tweets.length);
      }
    } catch (error) {
      console.error(`X collection failed for source ${source.name}:`, error);
      errors++;

      const oldFailures = source.consecutiveFailures ?? 0;
      const newFailureCount = oldFailures + 1;

      await logFetchAttempt(source.id, false, 0, String(error));
      await updateSourceHealth(source.id, false, 0);
      await checkAutoDisable(source.id, newFailureCount);
      await checkHealthTransitionNotification(source.name, oldFailures, newFailureCount);
    }
  }

  return { collected, errors };
}
