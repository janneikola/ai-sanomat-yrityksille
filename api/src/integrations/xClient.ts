/**
 * Apify Tweet Scraper V2 HTTP client.
 * Direct HTTP calls to the synchronous run endpoint -- no SDK dependency.
 * Follows tavilyClient.ts lazy-init pattern with graceful fallback.
 */

const APIFY_ACTOR = 'apify~tweet-scraper-v2';
const SYNC_URL = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`;

export interface ApifyTweet {
  id: string;
  text: string;
  createdAt: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  bookmarkCount: number;
  isRetweet: boolean;
  isReply: boolean;
  author: {
    userName: string;
    name: string;
    profileImageUrl: string;
  };
  url: string;
}

let apiToken: string | null = null;

function getToken(): string | null {
  if (!apiToken) {
    apiToken = process.env.APIFY_TOKEN || null;
  }
  return apiToken;
}

/**
 * Hakee twiitit kayttajan aikajanalat handlen perusteella.
 * Palauttaa tyhjan taulukon jos APIFY_TOKEN ei ole asetettu.
 */
export async function fetchTweetsByHandle(
  handle: string,
  maxItems: number = 20
): Promise<ApifyTweet[]> {
  const token = getToken();
  if (!token) {
    console.warn('APIFY_TOKEN not set, skipping X collection');
    return [];
  }

  const response = await fetch(
    `${SYNC_URL}?token=${token}&timeout=120`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handles: [handle],
        tweetsDesired: maxItems,
        proxyConfig: { useApifyProxy: true },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Apify request failed for @${handle}: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<ApifyTweet[]>;
}

/**
 * Hakee twiitit avainsanahaulla.
 * Palauttaa tyhjan taulukon jos APIFY_TOKEN ei ole asetettu.
 */
export async function searchTweets(
  searchTerms: string[],
  maxItems: number = 50
): Promise<ApifyTweet[]> {
  const token = getToken();
  if (!token) {
    console.warn('APIFY_TOKEN not set, skipping X search');
    return [];
  }

  const response = await fetch(
    `${SYNC_URL}?token=${token}&timeout=120`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchTerms,
        tweetsDesired: maxItems,
        proxyConfig: { useApifyProxy: true },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Apify search failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<ApifyTweet[]>;
}
