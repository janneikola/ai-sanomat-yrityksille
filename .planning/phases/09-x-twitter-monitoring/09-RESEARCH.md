# Phase 9: X/Twitter Monitoring - Research

**Researched:** 2026-03-03
**Domain:** Apify Tweet Scraper V2 integration, X/Twitter data collection, budget tracking
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use Apify Tweet Scraper (not official X API v2) -- already in the stack via x-reader skill
- Direct HTTP calls to Apify API (no @apify/client SDK) -- matches existing Python skill pattern
- Synchronous actor runs (wait for results with timeout) -- simpler, sufficient for 10-25 accounts
- Influencer timeline fetches run daily alongside RSS/Beehiiv in existing daily cron
- Keyword searches run on-demand before digest generation (within 24h of due date) -- matches web search pattern
- Both use since_id pagination to avoid re-fetching old posts
- One news_sources row per influencer account: type='x_account', config={handle, description, includeReplies, minLikes}
- One news_sources row per keyword query: type='x_search', config={query, language}
- Individual health tracking per source (reuses existing source health system)
- Separate admin page at (admin)/x-monitoring/ -- not mixed into existing sources page
- Expected initial scale: 10-25 influencer accounts
- Fixed monthly dollar amount cap (default $50/month), admin-configurable
- Track estimated cost per Apify run
- At cap: warn with dashboard alert and log warnings, but continue fetching (no hard stop)
- Budget visible on main admin dashboard (summary card) + detailed breakdown on X monitoring page
- Monthly reset of usage counter
- Collect ALL posts from influencer accounts (no keyword filter on influencer posts)
- Original posts only -- skip retweets and replies
- Keyword searches: apply minimum engagement threshold (likes/retweets) to filter spam
- X posts stored in news_items: title = first ~100 chars of post, summary = full post text, url = tweet link
- Influencer list is global (shared across all clients) -- collected once, digest AI picks relevant posts per client's industry
- Keyword searches are per-client (tied to client context, run on-demand like web search)

### Claude's Discretion
- Exact engagement threshold numbers for keyword search filtering
- Apify run timeout duration
- Error retry strategy for failed Apify runs
- Exact cost estimation formula per run
- Budget warning threshold percentage

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SRC-01 | System monitors curated X influencer accounts and collects AI-related posts | Apify Tweet Scraper V2 via `handles` input, integrated into daily cron via newsCollectorService |
| SRC-02 | System searches X by keyword for AI topics and trending discussions | Apify Tweet Scraper V2 via `searchTerms` input, on-demand pattern from webSearchService |
| SRC-06 | Admin can add and manage X influencer accounts and keyword searches as source types | New admin page at /x-monitoring, new route file, extended source type enum |
| SRC-07 | X API usage tracked with monthly budget cap to prevent cost overruns | New x_budget_usage table, cost estimation at $0.40/1000 tweets, monthly reset |
</phase_requirements>

## Summary

This phase integrates X/Twitter post collection into the existing news pipeline using Apify's Tweet Scraper V2 actor (`apidojo/tweet-scraper`). The project already has a working x-reader skill that demonstrates the exact API pattern: direct HTTP POST to Apify's synchronous run endpoint. The implementation follows two established patterns in the codebase: (1) daily collection alongside RSS/Beehiiv sources for influencer timeline fetches, and (2) on-demand per-client search like the existing Tavily web search for keyword queries.

The architecture adds two new source types (`x_account`, `x_search`) to the existing enum, a thin integration client (`xClient.ts`) modeled after `tavilyClient.ts`, a service layer for X-specific collection logic, budget tracking via a new database table, and a dedicated admin page. All existing infrastructure (source health tracking, URL-based deduplication, embedding pipeline) works out of the box with X posts stored as `news_items`.

The main risk is cost management. Apify charges $0.40 per 1,000 tweets on the pay-per-result model. With 25 influencer accounts fetching ~20 tweets each daily, that is ~500 tweets/day = ~$0.20/day = ~$6/month for influencers alone. Keyword searches add variable cost. The $50/month budget cap provides comfortable headroom but must be tracked per-run.

**Primary recommendation:** Build a thin xClient.ts with direct HTTP calls to Apify's run-sync-get-dataset-items endpoint, integrate influencer fetching into the existing collectAllNews loop, and model keyword search service after webSearchService.ts.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Apify REST API v2 | v2 | Tweet collection via HTTP | Already proven in x-reader skill; no SDK needed |
| node-fetch / built-in fetch | native | HTTP client for Apify calls | Node 18+ has built-in fetch; no new dependency |
| Drizzle ORM | (existing) | Database operations | Project standard for all DB access |
| Zod | (existing) | Schema validation | Project standard for route/config validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node-cron | (existing) | Daily scheduling | Already runs 06:00 collection; X accounts join same loop |
| lucide-react | (existing) | Admin UI icons | Twitter icon for sidebar nav item |
| sonner | (existing) | Toast notifications | Admin page feedback on actions |
| shadcn/ui | (existing) | UI components | Cards, Tables, Switches, Inputs for admin page |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct HTTP to Apify | @apify/client SDK | SDK adds dependency; direct HTTP matches x-reader skill pattern and is simpler |
| apidojo/tweet-scraper | Other Apify actors (fastcrawler, sovereigntaylor) | apidojo is the established actor used in x-reader skill; cheaper alternatives ($0.20/1K) exist but are less proven |
| Pay-per-result Apify | Official X API v2 Basic ($200/month) | Apify is dramatically cheaper for this volume (~$6-15/month vs $200/month) |

**Installation:**
```bash
# No new packages needed -- uses existing dependencies + native fetch
```

## Architecture Patterns

### Recommended Project Structure
```
api/src/
  integrations/
    xClient.ts                  # Thin Apify HTTP client (like tavilyClient.ts)
  services/
    xCollectorService.ts        # Influencer collection logic (added to daily cron)
    xSearchService.ts           # Keyword search logic (like webSearchService.ts)
    xBudgetService.ts           # Budget tracking and cost estimation
  routes/
    xMonitoring.ts              # Admin CRUD + budget endpoints
  db/
    schema.ts                   # Extended: x_account, x_search types + x_budget_usage table

web/src/app/(admin)/
  x-monitoring/
    page.tsx                    # Dedicated admin page for X sources + budget

packages/shared/src/schemas/
  source.ts                     # Extended type enum with x_account, x_search
```

### Pattern 1: Thin Integration Client (xClient.ts)
**What:** Single-purpose HTTP client wrapping Apify's synchronous run API
**When to use:** All Apify Tweet Scraper calls
**Example:**
```typescript
// Pattern from existing tavilyClient.ts + x-reader skill
const APIFY_ACTOR = 'apify~tweet-scraper-v2';
const SYNC_URL = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`;

interface ApifyTweet {
  id: string;
  text: string;
  createdAt: string;          // "Fri Nov 24 17:49:36 +0000 2023"
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
    throw new Error(`Apify request failed: ${response.status}`);
  }

  return response.json() as Promise<ApifyTweet[]>;
}

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
    throw new Error(`Apify search failed: ${response.status}`);
  }

  return response.json() as Promise<ApifyTweet[]>;
}
```

### Pattern 2: Daily Collection Integration
**What:** X account collection joins the existing collectAllNews loop
**When to use:** For influencer timeline fetches in the daily cron
**Example:**
```typescript
// In newsCollectorService.ts -- add to the source type switch
if (source.type === 'x_account' && source.config) {
  const config = JSON.parse(source.config) as {
    handle: string;
    includeReplies?: boolean;
    minLikes?: number;
  };
  const tweets = await fetchTweetsByHandle(config.handle, 20);

  // Filter: original posts only (skip retweets and replies unless configured)
  const filtered = tweets.filter((t) => {
    if (t.isRetweet) return false;
    if (t.isReply && !config.includeReplies) return false;
    if (config.minLikes && t.likeCount < config.minLikes) return false;
    return true;
  });

  items = filtered.map((t) => ({
    title: t.text.slice(0, 100),
    url: t.url,
    summary: t.text,
    publishedAt: new Date(t.createdAt),
  }));
}
```

### Pattern 3: On-Demand Keyword Search (like webSearchService.ts)
**What:** Per-client keyword search triggered before digest generation
**When to use:** For keyword-based X searches tied to client context
**Example:**
```typescript
// In xSearchService.ts -- mirrors webSearchService.ts pattern
export async function searchXForClient(clientId: number): Promise<{
  collected: number;
  queries: number;
}> {
  // Get client's x_search sources
  const searchSources = await db
    .select()
    .from(newsSources)
    .where(
      and(
        eq(newsSources.type, 'x_search'),
        eq(newsSources.isActive, true)
      )
    );

  // Filter to sources linked to this client (via config.clientId or similar)
  // Execute searches, filter by engagement, store results
  // Track costs via xBudgetService
}
```

### Pattern 4: Budget Tracking
**What:** Track estimated Apify costs per run with monthly cap
**When to use:** Every Apify API call
**Example:**
```typescript
// New table: x_budget_usage
// Columns: id, month (varchar 'YYYY-MM'), estimatedCost (real), tweetsCollected (int),
//          runType ('influencer' | 'search'), sourceId, createdAt

// Cost estimation: $0.40 per 1,000 tweets
function estimateCost(tweetCount: number): number {
  return (tweetCount / 1000) * 0.40;
}

// Budget check before each run
async function checkBudget(): Promise<{ spent: number; limit: number; remaining: number }> {
  const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const [usage] = await db
    .select({ total: sql<number>`coalesce(sum(estimated_cost), 0)` })
    .from(xBudgetUsage)
    .where(eq(xBudgetUsage.month, currentMonth));

  const limit = Number(process.env.X_MONTHLY_BUDGET ?? '50');
  const spent = usage?.total ?? 0;
  return { spent, limit, remaining: limit - spent };
}
```

### Anti-Patterns to Avoid
- **Running one Apify call per account serially:** Batch multiple handles into a single Apify run when possible (the actor supports `handles: ["user1", "user2", ...]`). However, for health tracking per source, individual calls per source are needed.
- **Hard-stopping on budget cap:** The decision says warn but continue. Do NOT throw errors or skip fetches when budget is exceeded.
- **Storing raw Apify JSON in news_items:** Map to the standard news_items shape (title, url, summary, publishedAt). Do not add X-specific columns to news_items.
- **Using the @apify/client SDK:** The decision is direct HTTP. Keep it consistent with the x-reader skill pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tweet date parsing | Custom date parser | `new Date(tweet.createdAt)` | JS Date handles Twitter's date format ("Fri Nov 24 17:49:36 +0000 2023") natively |
| URL deduplication | Custom dedup logic | Existing `onConflictDoNothing` on news_items.url unique constraint | Already handles all source types |
| Source health tracking | Custom health system | Existing sourceHealthService (logFetchAttempt, updateSourceHealth, checkAutoDisable) | Works for any source type out of the box |
| Embedding generation | Custom pipeline | Existing deduplicationService.processNewEmbeddings() | Runs post-collection, picks up all new news_items automatically |
| Admin UI components | Custom components | Existing shadcn/ui (Card, Table, Switch, Input, Button, Badge) | Project standard, consistent look |

**Key insight:** 90% of the infrastructure already exists. The new code is primarily: thin Apify client, source type handling in the collection loop, budget tracking table + service, and admin UI page.

## Common Pitfalls

### Pitfall 1: Apify Synchronous Timeout
**What goes wrong:** The synchronous endpoint has a 300-second (5 min) hard limit. Large requests (100+ tweets, multiple handles) can exceed this.
**Why it happens:** Apify scraping speed varies (30-80 tweets/sec), and proxy delays can slow things down.
**How to avoid:** Use `timeout=120` query parameter (2 min). Keep `tweetsDesired` low per call (20 for influencers, 50 for search). If timeout occurs, catch the 408 status and log it as a failed fetch attempt via sourceHealthService.
**Warning signs:** HTTP 408 responses in logs, increasing fetch times.

### Pitfall 2: Apify Token Missing Silently
**What goes wrong:** Fetch functions return empty arrays silently when APIFY_TOKEN is not set, but no source health failure is logged.
**Why it happens:** Graceful fallback pattern (like tavilyClient.ts) can mask configuration issues.
**How to avoid:** Log a warning on every call if token is missing. On the admin page, show a clear "APIFY_TOKEN not configured" status banner. In health tracking, still log the attempt as "skipped" (not success, not failure).
**Warning signs:** Zero items collected from all X sources simultaneously.

### Pitfall 3: Cost Estimation Drift
**What goes wrong:** Estimated costs diverge from actual Apify billing because the per-tweet price changes or the actor returns fewer/more tweets than requested.
**Why it happens:** Apify can return more or fewer tweets than `tweetsDesired`. The $0.40/1K rate is advertised but actual billing depends on Apify's PPR model.
**How to avoid:** Track estimated cost based on actual items received (not requested). Log actual item count per run. Budget cap is soft (warn-only) so drift does not cause operational failures. Periodically compare estimates with Apify billing dashboard.
**Warning signs:** Monthly estimated spend significantly different from Apify invoice.

### Pitfall 4: Source Type Enum Migration
**What goes wrong:** Adding new values to a PostgreSQL enum requires `ALTER TYPE ... ADD VALUE`, which Drizzle's `db:push` may or may not handle cleanly.
**Why it happens:** PostgreSQL enums are not easily mutable. Drizzle ORM's push behavior with enums varies.
**How to avoid:** Test `npx drizzle-kit push` in dev first. If it fails, write a manual migration: `ALTER TYPE source_type ADD VALUE 'x_account'; ALTER TYPE source_type ADD VALUE 'x_search';`. Add new values at the end of the enum (PostgreSQL limitation: cannot reorder).
**Warning signs:** Push errors mentioning "enum type" or "cannot add value".

### Pitfall 5: Tweet URL Uniqueness Format
**What goes wrong:** The same tweet appears with different URL formats (x.com vs twitter.com, with/without trailing slash or query params).
**Why it happens:** Apify may return URLs in varying formats across runs.
**How to avoid:** Normalize tweet URLs before insertion: always use `https://x.com/{username}/status/{id}` format, strip query parameters. The tweet `id` field from Apify is the canonical identifier.
**Warning signs:** Duplicate tweets with slightly different URLs in news_items.

### Pitfall 6: Retweet/Reply Fields Not Present
**What goes wrong:** Filtering on `isRetweet`/`isReply` fails because fields are undefined rather than false.
**Why it happens:** Apify output fields may be absent rather than false for non-retweet/non-reply tweets.
**How to avoid:** Use `!!tweet.isRetweet` or `tweet.isRetweet === true` rather than `tweet.isRetweet` for truthy checks. Default to false if field is missing.
**Warning signs:** All tweets passing the retweet/reply filter, including actual retweets.

## Code Examples

Verified patterns from the x-reader skill and existing codebase:

### Apify Synchronous Run (from x-reader skill)
```typescript
// Source: .claude/skills/x-reader/SKILL.md
// Endpoint: POST run-sync-get-dataset-items
const APIFY_SYNC_URL = 'https://api.apify.com/v2/acts/apify~tweet-scraper-v2/run-sync-get-dataset-items';

// Fetch by handles (influencer collection)
const response = await fetch(`${APIFY_SYNC_URL}?token=${APIFY_TOKEN}&timeout=120`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    handles: ['karpathy', 'sama'],
    tweetsDesired: 20,
    proxyConfig: { useApifyProxy: true },
  }),
});
const tweets = await response.json(); // Array of tweet objects

// Search by keywords
const searchResponse = await fetch(`${APIFY_SYNC_URL}?token=${APIFY_TOKEN}&timeout=120`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    searchTerms: ['AI agents 2026'],
    tweetsDesired: 50,
    proxyConfig: { useApifyProxy: true },
  }),
});
```

### Mapping Apify Tweet to news_items
```typescript
// Map tweet to news_items compatible format
function mapTweetToNewsItem(tweet: ApifyTweet, sourceId: number) {
  // Normalize URL: ensure consistent x.com format
  const tweetUrl = tweet.url || `https://x.com/${tweet.author?.userName}/status/${tweet.id}`;

  return {
    sourceId,
    title: tweet.text.slice(0, 100) + (tweet.text.length > 100 ? '...' : ''),
    url: tweetUrl,
    summary: tweet.text,
    publishedAt: new Date(tweet.createdAt),
  };
}
```

### Source Config JSON Schemas
```typescript
// x_account config shape
interface XAccountConfig {
  handle: string;           // e.g., "karpathy"
  description?: string;     // e.g., "AI researcher, ex-Tesla"
  includeReplies?: boolean; // default false
  minLikes?: number;        // default 0
}

// x_search config shape (per-client)
interface XSearchConfig {
  query: string;            // e.g., "AI healthcare"
  language?: string;        // ISO 639-1, e.g., "en"
  clientId?: number;        // links search to specific client
}
```

### Budget Tracking Table Schema
```typescript
// New table for x_budget_usage
export const xBudgetUsage = pgTable('x_budget_usage', {
  id: serial('id').primaryKey(),
  month: varchar('month', { length: 7 }).notNull(),  // 'YYYY-MM'
  estimatedCost: real('estimated_cost').notNull(),     // dollars
  tweetsCollected: integer('tweets_collected').notNull(),
  runType: varchar('run_type', { length: 20 }).notNull(), // 'influencer' | 'search'
  sourceId: integer('source_id').references(() => newsSources.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

### Integration with Existing Collection (newsCollectorService.ts)
```typescript
// Add x_account handling in the source type switch block
// after beehiiv block, before the items insertion loop
else if (source.type === 'x_account' && source.config) {
  const config = JSON.parse(source.config) as XAccountConfig;

  // Budget check (warn-only, never block)
  const budget = await checkBudget();
  if (budget.remaining <= 0) {
    console.warn(`X budget exceeded ($${budget.spent.toFixed(2)}/$${budget.limit}), continuing anyway`);
  }

  const tweets = await fetchTweetsByHandle(config.handle, 20);

  // Filter: original posts only
  const filtered = tweets.filter((t) => {
    if (t.isRetweet === true) return false;
    if (t.isReply === true && !config.includeReplies) return false;
    if (config.minLikes && t.likeCount < (config.minLikes ?? 0)) return false;
    return true;
  });

  items = filtered.map((t) => mapTweetToNewsItem(t, source.id));

  // Track cost
  await recordBudgetUsage('influencer', source.id, tweets.length);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Official Twitter API v1.1 (free) | X API v2 ($200/month Basic) | 2023 | Made scraping via Apify the cost-effective alternative |
| twitter.com URLs | x.com URLs | 2023 | Must normalize URLs to x.com format |
| Apify compute-unit pricing | Pay-per-result ($0.40/1K tweets) | 2024-2025 | Simpler cost tracking, no compute unit estimation needed |
| Bearer token auth for X API | APIFY_TOKEN for Apify platform | N/A | Different auth model -- Apify token, not X bearer token |

**Deprecated/outdated:**
- STATE.md mentions "X_BEARER_TOKEN" env var -- this should be APIFY_TOKEN instead (not using official X API)
- The x-reader skill uses `APIFY_API_KEY` as the env var name; standardize on `APIFY_TOKEN` which is Apify's official env var name

## Open Questions

1. **Exact Apify Tweet Output Schema**
   - What we know: Fields include `id`, `text`, `createdAt`, `likeCount`, `retweetCount`, `replyCount`, `quoteCount`, `bookmarkCount`, `isRetweet`, `isReply`, `author`, `url`
   - What's unclear: Full list of all fields, exact format of `createdAt` string, exact author sub-fields, whether `url` is always present
   - Recommendation: During implementation, do a test call and log the full response to capture the complete schema. Build the TypeScript interface from actual data. The fields listed above are HIGH confidence from multiple sources.

2. **Engagement Threshold for Keyword Search Filtering (Claude's Discretion)**
   - What we know: Need minimum engagement to filter spam from keyword searches
   - What's unclear: What constitutes "good" engagement for AI-related tweets
   - Recommendation: Start with `minLikes: 5, minRetweets: 2` as defaults. These are configurable per-source via config JSON. Very low thresholds prevent spam while not losing genuinely breaking news (which may not have high engagement yet).

3. **Apify Run Timeout Duration (Claude's Discretion)**
   - What we know: Sync endpoint max is 300s. Typical runs for 20 tweets should complete in <30s.
   - What's unclear: How often timeouts occur in practice
   - Recommendation: Use `timeout=120` (2 minutes). This gives plenty of headroom for 20-50 tweets while failing fast enough to not block the collection loop.

4. **Error Retry Strategy (Claude's Discretion)**
   - What we know: Apify can return 408 (timeout) or 400 (run failure)
   - What's unclear: Whether transient failures are common
   - Recommendation: No automatic retry within the same collection run. Rely on the existing source health system: failed fetches increment consecutiveFailures, and the next daily run retries automatically. This matches the existing pattern for RSS/Beehiiv sources.

5. **Budget Warning Threshold (Claude's Discretion)**
   - What we know: Budget cap is soft (warn-only at $50/month default)
   - What's unclear: When to start warning
   - Recommendation: Warn at 80% ($40 of $50 default). Show yellow badge on dashboard card at 80%, red badge at 100%+. Log warnings at 80% and 100% thresholds.

6. **APIFY_TOKEN vs APIFY_API_KEY Env Var Name**
   - What we know: x-reader skill uses `APIFY_API_KEY`, Apify's official docs use `APIFY_TOKEN`
   - What's unclear: Whether the project already has one configured
   - Recommendation: Use `APIFY_TOKEN` to match Apify's official convention. Add to env setup docs.

## Sources

### Primary (HIGH confidence)
- `.claude/skills/x-reader/SKILL.md` - Complete Apify Tweet Scraper V2 usage pattern with curl examples, parameter reference, async fallback pattern
- Existing codebase: `tavilyClient.ts`, `webSearchService.ts`, `newsCollectorService.ts` - Established integration patterns
- [Apify API v2 docs - Run Actor Sync](https://docs.apify.com/api/v2/act-run-sync-get-dataset-items-post) - Endpoint URL, parameters, 300s timeout, status codes

### Secondary (MEDIUM confidence)
- [Apify Tweet Scraper V2 page](https://apify.com/apidojo/tweet-scraper) - Pricing ($0.40/1K tweets), 30-80 tweets/sec performance
- [Apify Actors in Store docs](https://docs.apify.com/platform/actors/running/actors-in-store) - Pay-per-result model, maxItems parameter for cost control
- [Apify pricing docs](https://docs.apify.com/platform/actors/publishing/monetize/pricing-and-costs) - PPR billing model details
- Multiple web sources confirming output fields: `createdAt`, `likeCount`, `retweetCount`, `replyCount`, `quoteCount`, `bookmarkCount`, `isRetweet`, `isReply`

### Tertiary (LOW confidence)
- Exact complete output JSON schema for apidojo/tweet-scraper -- could not access full output schema page. Fields are aggregated from multiple partial sources. Validate with a test API call during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies needed; all patterns proven in codebase
- Architecture: HIGH - Direct extensions of existing patterns (tavilyClient, webSearchService, newsCollectorService)
- Apify API integration: MEDIUM - x-reader skill proves the pattern works; exact output field list needs validation
- Budget tracking: MEDIUM - Cost formula ($0.40/1K) verified from Apify docs; actual billing alignment unverified
- Pitfalls: MEDIUM - Based on API documentation and general Apify experience; some edge cases only discoverable during implementation

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (30 days -- Apify pricing and actor behavior are relatively stable)
