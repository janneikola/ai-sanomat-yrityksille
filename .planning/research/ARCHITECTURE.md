# Architecture Research: v1.1 Feature Integration

**Domain:** Enterprise AI-curated newsletter platform -- extending existing Fastify/Next.js monorepo
**Researched:** 2026-03-03
**Confidence:** HIGH (existing codebase is well-understood; external API docs verified)

## Existing Architecture Baseline

Before describing changes, here is the current system as-built in v1.0:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Web (Next.js 15)                             │
│  ┌──────────────┐  ┌──────────────┐                                │
│  │ Admin Panel   │  │ Portal       │                                │
│  │ /admin/*      │  │ /portal/*    │                                │
│  └──────┬───────┘  └──────┬───────┘                                │
│         └─────────┬───────┘                                        │
├───────────────────┼────────────────────────────────────────────────┤
│                   │  API (Fastify)                                  │
│  ┌────────────────┴────────────────┐                               │
│  │         Route Layer             │                               │
│  │  /api/admin/*  /api/portal/*    │                               │
│  │  /api/auth/*   /api/webhooks/*  │                               │
│  └────────────────┬────────────────┘                               │
│  ┌────────────────┴────────────────┐                               │
│  │         Service Layer           │                               │
│  │  newsCollector  newsletter      │                               │
│  │  emailService   imageService    │                               │
│  │  sources  clients  templates    │                               │
│  └────────────────┬────────────────┘                               │
│  ┌────────────────┴────────────────┐                               │
│  │      Integration Layer          │                               │
│  │  rssCollector  beehiivClient    │                               │
│  │  claudeClient  geminiClient     │                               │
│  │  resendClient                   │                               │
│  └────────────────┬────────────────┘                               │
│  ┌────────────────┴────────────────┐                               │
│  │      Scheduler (node-cron)      │                               │
│  │  daily collection 06:00 EET     │                               │
│  └─────────────────────────────────┘                               │
├─────────────────────────────────────────────────────────────────────┤
│                    PostgreSQL (Railway)                              │
│  clients  members  newsSources  newsItems                          │
│  issues  deliveryStats  promptTemplates                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Current Data Flow: News Collection to Delivery

```
[node-cron 06:00]
    |
    v
[newsCollectorService.collectAllNews()]
    |-- iterates active newsSources
    |-- for each source: fetchRssFeed() or fetchBeehiivPosts()
    |-- inserts into newsItems (URL-based dedup via UNIQUE constraint)
    v
[Admin triggers /digests/generate]
    |
    v
[newsletterService.generateClientDigest(clientId)]
    |-- fetches recent 30 newsItems (no client filtering)
    |-- fills prompt templates with client.industry + client.name
    |-- Claude: generate digest -> validate -> image prompts
    |-- Gemini: generate images
    |-- saves to issues table (status: generating -> validating -> ready)
    v
[Admin reviews, approves, sends]
    |
    v
[emailService.sendDigestToClient(issueId)]
    |-- renders React Email template
    |-- sends via Resend batch API
    |-- creates deliveryStats records
    v
[Resend webhooks -> deliveryStats updates]
```

### Key Observations from Existing Code

1. **Source types are enum-constrained**: `sourceTypeEnum` = `['rss', 'beehiiv', 'manual']` -- must be extended
2. **Deduplication is URL-only**: `newsItems.url` has a UNIQUE constraint, `onConflictDoNothing()`
3. **News collection is source-agnostic but hardcoded**: `collectAllNews()` switches on `source.type`
4. **Digest generation ignores source type**: Takes latest 30 newsItems regardless of origin
5. **No client-specific news**: All clients see the same pool of newsItems
6. **Scheduler is single-purpose**: One cron job for daily collection, no per-client scheduling
7. **Email template is functional but basic**: Inline CSS styles, no brand assets, no feedback mechanism
8. **No source health tracking**: Failed collections log to console and increment an error counter, nothing persisted

---

## v1.1 Architecture: New Components & Modified Components

### System Overview After v1.1

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Web (Next.js 15)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐         │
│  │ Admin Panel   │  │ Portal       │  │ Feedback          │         │
│  │ /admin/*      │  │ /portal/*    │  │ /feedback/:token  │  [NEW]  │
│  │ + source      │  │              │  │ (public, no auth) │         │
│  │   health UI   │  │              │  └──────────────────┘         │
│  │ + schedule UI │  │              │                                │
│  └──────┬───────┘  └──────┬───────┘                                │
│         └─────────┬───────┘                                        │
├───────────────────┼────────────────────────────────────────────────┤
│                   │  API (Fastify)                                  │
│  ┌────────────────┴────────────────────────────────────────┐       │
│  │                    Route Layer                           │       │
│  │  /api/admin/*  /api/portal/*                            │       │
│  │  /api/auth/*   /api/webhooks/*                          │       │
│  │  /api/feedback/:token/vote          [NEW]               │       │
│  │  /api/admin/schedules/*             [NEW]               │       │
│  │  /api/admin/source-health/*         [NEW]               │       │
│  └────────────────┬────────────────────────────────────────┘       │
│  ┌────────────────┴────────────────────────────────────────┐       │
│  │                  Service Layer                           │       │
│  │  newsCollector [MODIFIED]  newsletter [MODIFIED]         │       │
│  │  emailService  [MODIFIED]  imageService                  │       │
│  │  sources  clients  templates                             │       │
│  │  deduplicationService      [NEW]                         │       │
│  │  sourceHealthService       [NEW]                         │       │
│  │  feedbackService           [NEW]                         │       │
│  │  scheduleService           [NEW]                         │       │
│  └────────────────┬────────────────────────────────────────┘       │
│  ┌────────────────┴────────────────────────────────────────┐       │
│  │                Integration Layer                         │       │
│  │  rssCollector      beehiivClient                         │       │
│  │  claudeClient      geminiClient                          │       │
│  │  resendClient                                            │       │
│  │  xClient           [NEW]                                 │       │
│  │  webSearchClient   [NEW]  (Tavily)                       │       │
│  │  embeddingClient   [NEW]  (OpenAI text-embedding-3-small)│       │
│  └────────────────┬────────────────────────────────────────┘       │
│  ┌────────────────┴────────────────────────────────────────┐       │
│  │              Scheduler (node-cron) [MODIFIED]            │       │
│  │  daily collection 06:00 EET                              │       │
│  │  per-client digest generation (configurable schedule)    │       │
│  │  source health check (daily)                             │       │
│  └─────────────────────────────────────────────────────────┘       │
├─────────────────────────────────────────────────────────────────────┤
│                 PostgreSQL (Railway) + pgvector                     │
│  [existing]  clients  members  newsSources  newsItems              │
│             issues  deliveryStats  promptTemplates                  │
│  [modified] newsSources (+ healthMetrics cols)                     │
│             newsItems (+ embedding col, + sourceMetadata)           │
│             clients (+ schedule cols, + searchPrompt)               │
│             issues (+ feedbackToken col)                            │
│  [new]      sourceHealthLogs  feedbackVotes                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

### New Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `xClient` | `api/src/integrations/xClient.ts` | Fetch tweets from X API v2 (user timeline + search recent) |
| `webSearchClient` | `api/src/integrations/webSearchClient.ts` | Search web via Tavily API for AI news |
| `embeddingClient` | `api/src/integrations/embeddingClient.ts` | Generate text embeddings via OpenAI for dedup |
| `deduplicationService` | `api/src/services/deduplicationService.ts` | Semantic dedup using pgvector cosine similarity |
| `sourceHealthService` | `api/src/services/sourceHealthService.ts` | Track source reliability, staleness, quality scoring |
| `feedbackService` | `api/src/services/feedbackService.ts` | Handle thumbs up/down from email recipients |
| `scheduleService` | `api/src/services/scheduleService.ts` | Manage per-client digest generation schedules |
| Feedback routes | `api/src/routes/feedback.ts` | Public endpoint for email vote links |

### Modified Components

| Component | What Changes |
|-----------|-------------|
| `newsCollectorService` | Add X and web search collection alongside RSS/Beehiiv; call dedup after each batch insert |
| `newsletterService` | Filter newsItems by client relevance (industry search prompt); include aisanomat.fi featured section |
| `emailService` | Inject feedback links per recipient; use new premium template |
| `DigestEmail.tsx` | Redesign with co-branding, AI-Sanomat brand frame, feedback buttons |
| `scheduler.ts` | Add per-client digest generation crons; add source health check cron |
| `db/schema.ts` | New tables + column additions + pgvector extension |
| `sourceTypeEnum` | Extend to include `'x_account'`, `'x_search'`, `'web_search'` |
| Shared schemas | New Zod schemas for schedule, feedback, source health |

---

## Database Schema Changes

### Extensions Required

```sql
CREATE EXTENSION IF NOT EXISTS vector;  -- pgvector for semantic dedup
```

pgvector is available on Railway PostgreSQL as a one-click deploy template. Confidence: HIGH -- verified via Railway deployment templates.

### Modified Tables

#### `newsSources` -- add health tracking columns

```typescript
// Add to existing newsSources table:
lastSuccessAt: timestamp('last_success_at'),
lastFailureAt: timestamp('last_failure_at'),
consecutiveFailures: integer('consecutive_failures').notNull().default(0),
totalCollections: integer('total_collections').notNull().default(0),
totalItemsCollected: integer('total_items_collected').notNull().default(0),
qualityScore: integer('quality_score'),  // 0-100, null = unscored
```

#### `sourceTypeEnum` -- extend

```typescript
export const sourceTypeEnum = pgEnum('source_type', [
  'rss', 'beehiiv', 'manual', 'x_account', 'x_search', 'web_search'
]);
```

Note: Drizzle ORM does not support adding values to existing enums via schema push. This requires a manual SQL migration: `ALTER TYPE source_type ADD VALUE 'x_account';` etc.

#### `newsItems` -- add embedding + metadata

```typescript
// Add to existing newsItems table:
embedding: vector('embedding', { dimensions: 512 }),  // OpenAI text-embedding-3-small (truncated)
sourceMetadata: text('source_metadata'),  // JSON: tweet ID, search query, clientId etc.
isDuplicate: boolean('is_duplicate').notNull().default(false),
```

Plus an HNSW index for fast cosine similarity:

```typescript
// In table definition's third argument:
(table) => [
  index('newsItemsEmbeddingIdx')
    .using('hnsw', table.embedding.op('vector_cosine_ops')),
]
```

#### `clients` -- add scheduling + search config

```typescript
// Add to existing clients table:
sendFrequency: varchar('send_frequency', { length: 20 }).notNull().default('weekly'),
  // 'weekly' | 'biweekly' | 'monthly'
sendDayOfWeek: integer('send_day_of_week').notNull().default(1),  // 1=Monday
sendHour: integer('send_hour').notNull().default(9),  // Local hour (Europe/Helsinki)
searchPrompt: text('search_prompt'),  // Per-client industry-specific search terms
autoGenerateEnabled: boolean('auto_generate_enabled').notNull().default(false),
lastAutoGeneratedAt: timestamp('last_auto_generated_at'),
```

#### `issues` -- add feedback tracking

```typescript
// Add to existing issues table:
feedbackToken: varchar('feedback_token', { length: 64 }).unique(),
  // crypto.randomBytes(32).toString('hex'), unique per issue
```

### New Tables

#### `sourceHealthLogs` -- per-collection-run metrics

```typescript
export const sourceHealthLogs = pgTable('source_health_logs', {
  id: serial('id').primaryKey(),
  sourceId: integer('source_id').notNull().references(() => newsSources.id),
  collectedAt: timestamp('collected_at').notNull().defaultNow(),
  success: boolean('success').notNull(),
  itemsCollected: integer('items_collected').notNull().default(0),
  durationMs: integer('duration_ms'),
  errorMessage: text('error_message'),
});
```

#### `feedbackVotes` -- per-recipient per-issue votes

```typescript
export const feedbackVoteEnum = pgEnum('feedback_vote', ['up', 'down']);

export const feedbackVotes = pgTable('feedback_votes', {
  id: serial('id').primaryKey(),
  issueId: integer('issue_id').notNull().references(() => issues.id),
  memberId: integer('member_id').notNull().references(() => members.id),
  vote: feedbackVoteEnum('vote').notNull(),
  votedAt: timestamp('voted_at').notNull().defaultNow(),
});
```

---

## Detailed Integration Architecture per Feature

### 1. X (Twitter) Monitoring

**API Choice: Official X API v2 Basic tier ($200/month)**

The official API is the only legally sustainable option. Third-party scraping APIs (twitterapi.io, etc.) violate X ToS and risk shutdown at any time. At Basic tier:
- 10,000 tweet reads/month (adequate for 10-20 influencer accounts + occasional keyword searches)
- Recent search endpoint (last 7 days) -- sufficient for weekly newsletter cadence
- User tweet timeline endpoint for curated accounts

**Library:** `twitter-api-v2` (npm) -- strongly typed, maintained, supports v2 endpoints. Confidence: HIGH.

**Data Flow:**

```
[scheduler: daily 06:00]
    |
    v
[newsCollectorService]
    |-- for each source WHERE type = 'x_account':
    |     xClient.fetchUserTweets(config.userId, since lastSuccessAt)
    |     -> filter: engagement threshold, AI-relevance heuristic
    |     -> map to CollectedItem format
    |     -> insert newsItems
    |
    |-- for each source WHERE type = 'x_search':
    |     xClient.searchRecentTweets(config.query)
    |     -> filter: engagement threshold
    |     -> map to CollectedItem format
    |     -> insert newsItems
    v
[deduplicationService.deduplicateRecent()]
```

**`xClient.ts` structure:**

```typescript
// api/src/integrations/xClient.ts
import { TwitterApi } from 'twitter-api-v2';

const client = new TwitterApi(process.env.X_BEARER_TOKEN!);

export interface XCollectedItem {
  title: string;       // tweet text (truncated to ~200 chars)
  url: string;         // https://x.com/{user}/status/{id}
  summary: string;     // full tweet text
  publishedAt: Date;
  sourceMetadata: {
    tweetId: string;
    authorUsername: string;
    metrics: { likes: number; retweets: number; replies: number };
  };
}

export async function fetchUserTweets(
  userId: string,
  sinceId?: string
): Promise<XCollectedItem[]> { /* ... */ }

export async function searchRecentTweets(
  query: string,
  maxResults?: number
): Promise<XCollectedItem[]> { /* ... */ }
```

**Source configuration (in `newsSources.config` JSON):**

```json
// x_account source:
{ "userId": "123456789", "username": "sama", "minLikes": 50 }

// x_search source:
{ "query": "AI regulation OR artificial intelligence policy", "maxResults": 20 }
```

**Rate limit considerations:** Basic tier has 10,000 reads/month. With daily collection and ~15 accounts + 3 keyword searches, this consumes roughly: 15 accounts * 30 days = 450 requests + 3 searches * 30 = 90 = ~540 requests/month. Well within limits.

### 2. Web Search (Tavily)

**API Choice: Tavily over Serper**

Use Tavily because:
- Purpose-built for AI/RAG pipelines (returns clean, structured content, not raw SERP HTML)
- 1,000 free credits/month (1,000 basic searches or 500 advanced)
- Simple REST API with official Node.js SDK (`@tavily/core`)
- Topic filtering and domain whitelisting built-in
- Serper returns raw Google SERP data requiring more parsing

**Pricing path:** Start on free tier (1,000 credits). Move to $30/month (4,000 credits) when scaling to 5+ clients. Confidence: HIGH -- verified via Tavily official docs.

**Data Flow:**

```
[scheduler: daily 06:00, after RSS/X collection]
    |
    v
[newsCollectorService]
    |-- for each source WHERE type = 'web_search':
    |     webSearchClient.search(config.query, config.options)
    |     -> map results to CollectedItem format
    |     -> insert newsItems
    |
    |-- for each client WHERE searchPrompt IS NOT NULL:
    |     webSearchClient.search(client.searchPrompt)
    |     -> tag results with clientId in sourceMetadata
    |     -> insert newsItems
    v
[deduplicationService.deduplicateRecent()]
```

**`webSearchClient.ts` structure:**

```typescript
// api/src/integrations/webSearchClient.ts
import { tavily } from '@tavily/core';

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY! });

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;  // AI-optimized snippet from Tavily
  score: number;    // Tavily relevance score 0-1
  publishedDate: string | null;
}

export async function searchAiNews(
  query: string,
  options?: {
    maxResults?: number;    // default 10
    searchDepth?: 'basic' | 'advanced';
    includeDomains?: string[];
    excludeDomains?: string[];
    topic?: 'general' | 'news';
  }
): Promise<WebSearchResult[]> {
  const response = await tvly.search(query, {
    maxResults: options?.maxResults ?? 10,
    searchDepth: options?.searchDepth ?? 'basic',
    topic: options?.topic ?? 'news',
    includeDomains: options?.includeDomains,
    excludeDomains: options?.excludeDomains,
  });
  return response.results;
}
```

**Two-level search strategy:**
1. **General AI news** (global, shared): `web_search` type sources with broad queries like "artificial intelligence news this week"
2. **Client-specific** (per-client): Uses `clients.searchPrompt` field, e.g. "AI in healthcare diagnostics 2026" for a healthcare client. Results tagged with `sourceMetadata.clientId`.

### 3. Semantic Deduplication

**Approach: pgvector + OpenAI text-embedding-3-small**

Use pgvector because:
- Already available on Railway PostgreSQL
- Native Drizzle ORM support (`drizzle-orm/pg-core` has `vector` type)
- Cosine similarity via `<=>` operator with HNSW index
- No separate vector DB needed (keeps architecture simple)
- OpenAI embeddings are cheap ($0.02/1M tokens) and high quality

Use 512 dimensions (not full 1536) because:
- text-embedding-3-small supports Matryoshka truncation to 512 dims
- 512 dims provides 95%+ of accuracy at 1/3 the storage
- HNSW index is faster and smaller with fewer dimensions

**Data Flow:**

```
[After batch insert of newsItems]
    |
    v
[deduplicationService.embedAndDedup()]
    |-- SELECT * FROM newsItems WHERE embedding IS NULL
    |-- for each batch of unembedded items:
    |     text = item.title + ' ' + (item.summary || '')
    |     embedding = embeddingClient.embed(texts)  // batch call
    |     UPDATE newsItems SET embedding = embedding
    |
    |-- for each newly embedded item:
    |     SELECT * FROM newsItems
    |       WHERE cosineDistance(embedding, newItem.embedding) < 0.15
    |       AND id != newItem.id
    |       AND collectedAt > (now - 7 days)
    |     if duplicates found:
    |       keep item with earliest collectedAt
    |       mark others as isDuplicate = true
```

**`embeddingClient.ts` structure:**

```typescript
// api/src/integrations/embeddingClient.ts
import OpenAI from 'openai';

const openai = new OpenAI();

export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
    dimensions: 512,  // Matryoshka truncation
  });
  return response.data.map((d) => d.embedding);
}

export async function generateEmbedding(
  text: string
): Promise<number[]> {
  const [embedding] = await generateEmbeddings([text]);
  return embedding;
}
```

**`deduplicationService.ts` key logic:**

```typescript
// api/src/services/deduplicationService.ts
import { cosineDistance, desc, gt, sql, and, gte, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { newsItems } from '../db/schema.js';
import { generateEmbeddings } from '../integrations/embeddingClient.js';

const SIMILARITY_THRESHOLD = 0.85;  // cosineDistance < 0.15 means >85% similar
const DEDUP_WINDOW_DAYS = 7;

export async function embedNewItems(): Promise<number> {
  const unembedded = await db
    .select()
    .from(newsItems)
    .where(sql`${newsItems.embedding} IS NULL`)
    .limit(100);  // batch to respect API limits

  if (unembedded.length === 0) return 0;

  const texts = unembedded.map(
    (item) => `${item.title} ${item.summary || ''}`
  );
  const embeddings = await generateEmbeddings(texts);

  for (let i = 0; i < unembedded.length; i++) {
    await db
      .update(newsItems)
      .set({ embedding: embeddings[i] })
      .where(eq(newsItems.id, unembedded[i].id));
  }

  return unembedded.length;
}

export async function markDuplicates(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DEDUP_WINDOW_DAYS);

  // Get recently embedded, non-duplicate items
  const recent = await db
    .select()
    .from(newsItems)
    .where(
      and(
        sql`${newsItems.embedding} IS NOT NULL`,
        eq(newsItems.isDuplicate, false),
        gte(newsItems.collectedAt, cutoff)
      )
    )
    .orderBy(newsItems.collectedAt);

  let marked = 0;
  const seenIds = new Set<number>();

  for (const item of recent) {
    if (seenIds.has(item.id)) continue;

    const similarity = sql<number>`1 - (${cosineDistance(newsItems.embedding, item.embedding!)})`;
    const dupes = await db
      .select({ id: newsItems.id, similarity })
      .from(newsItems)
      .where(
        and(
          gt(similarity, SIMILARITY_THRESHOLD),
          sql`${newsItems.id} != ${item.id}`,
          sql`${newsItems.id} > ${item.id}`,  // only flag newer dupes
          eq(newsItems.isDuplicate, false),
          gte(newsItems.collectedAt, cutoff)
        )
      );

    for (const dupe of dupes) {
      await db
        .update(newsItems)
        .set({ isDuplicate: true })
        .where(eq(newsItems.id, dupe.id));
      seenIds.add(dupe.id);
      marked++;
    }
  }

  return marked;
}
```

**Cost estimate:** At ~50 news items/day, 30 days = 1,500 items/month. Average 50 tokens/item = 75,000 tokens/month = $0.0015/month. Negligible.

### 4. Auto-Scheduled Digest Generation

**Approach: Database-driven schedules with node-cron master clock**

Do NOT create one cron job per client. Instead, run a single "scheduler tick" every hour that checks which clients are due for digest generation.

**Why this approach:**
- node-cron jobs are in-memory; server restart loses dynamically created jobs
- Database-driven scheduling survives restarts
- Simple to query: "which clients need a digest generated right now?"
- Avoids the complexity of dynamic cron expression management

**Data Flow:**

```
[node-cron: hourly check, every hour at :00]
    |
    v
[scheduleService.checkDueClients()]
    |-- SELECT * FROM clients
    |     WHERE autoGenerateEnabled = true
    |     AND isActive = true
    |     AND isDue(sendFrequency, sendDayOfWeek, sendHour, lastAutoGeneratedAt)
    |
    |-- for each due client:
    |     newsletterService.generateClientDigest(client.id)
    |     UPDATE clients SET lastAutoGeneratedAt = now()
    |     (digest lands in status 'ready', admin still reviews/approves)
```

**`scheduleService.ts` key logic:**

```typescript
// api/src/services/scheduleService.ts

function isDue(client: {
  sendFrequency: string;
  sendDayOfWeek: number;
  sendHour: number;
  lastAutoGeneratedAt: Date | null;
}): boolean {
  const now = new Date();
  // Convert to Helsinki timezone
  const helsinkiHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Europe/Helsinki',
    }).format(now)
  );
  const helsinkiDay = parseInt(
    new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: 'Europe/Helsinki',
    }).format(now)
  );
  // Map weekday string to number (0=Sun, 1=Mon, ..., 6=Sat)

  // Check if it is the right hour
  if (helsinkiHour !== client.sendHour) return false;

  // Check if it is the right day of week
  if (helsinkiDay !== client.sendDayOfWeek) return false;

  // Check frequency window since last generation
  if (client.lastAutoGeneratedAt) {
    const daysSince = Math.floor(
      (now.getTime() - client.lastAutoGeneratedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    switch (client.sendFrequency) {
      case 'weekly': if (daysSince < 6) return false; break;
      case 'biweekly': if (daysSince < 13) return false; break;
      case 'monthly': if (daysSince < 27) return false; break;
    }
  }

  return true;
}
```

**Scheduler modification:**

```typescript
// Updated scheduler.ts
export function startScheduler() {
  // Existing: daily news collection at 06:00
  cron.schedule('0 6 * * *', collectAllNews, { timezone: 'Europe/Helsinki' });

  // NEW: hourly schedule check for auto-generation
  cron.schedule('0 * * * *', checkDueClientsAndGenerate, { timezone: 'Europe/Helsinki' });

  // NEW: daily source health check at 07:00 (after collection)
  cron.schedule('0 7 * * *', runSourceHealthCheck, { timezone: 'Europe/Helsinki' });
}
```

### 5. Source Health Monitoring

**Approach: Instrument existing collection loop + daily health report**

Wrap each source collection in timing/success tracking. Store per-run logs. Compute aggregate health metrics on the source record.

**Data Flow:**

```
[newsCollectorService.collectAllNews() -- modified]
    |-- for each source:
    |     startTime = Date.now()
    |     try { collect items }
    |     finally {
    |       insert sourceHealthLog(sourceId, success, items, duration, error)
    |       update newsSources health columns
    |     }
    v
[sourceHealthService.runDailyCheck() -- daily at 07:00]
    |-- for each source:
    |     compute qualityScore based on:
    |       - success rate (last 7 days)
    |       - items collected / total collections
    |       - consecutive failures
    |       - staleness (days since lastSuccessAt)
    |     update newsSources.qualityScore
    |
    |-- if any source has consecutiveFailures >= 3:
    |     log warning (future: notify admin)
```

**Quality score formula (0-100):**

```
qualityScore =
  (successRate * 40) +            // 40 points for reliability
  (freshnessScore * 30) +         // 30 points for recency
  (volumeScore * 30)              // 30 points for item volume

Where:
  successRate   = successful runs / total runs (last 7 days), scaled 0-1
  freshnessScore = 1.0 if last success < 24h, 0.5 if < 72h, 0 if older
  volumeScore   = min(avgItemsPerRun / expectedItems, 1.0)
```

### 6. Email Feedback Loop

**Approach: Token-based public endpoint with thumbs up/down**

Each issue gets a unique `feedbackToken`. Email includes two links:
- `https://app.aisanomat.fi/api/feedback/{token}/vote?v=up&m={memberId}`
- `https://app.aisanomat.fi/api/feedback/{token}/vote?v=down&m={memberId}`

These are GET requests (email clients do not support POST from emails) that record the vote and redirect to a thank-you page.

**Data Flow:**

```
[emailService.sendDigestToClient() -- modified]
    |-- generate feedbackToken for issue (if not exists)
    |-- for each member:
    |     inject personalized feedback URLs into email template
    v
[Recipient clicks thumbs up/down in email]
    |
    v
[GET /api/feedback/:token/vote?v=up&m=123]
    |-- validate token (lookup issue)
    |-- validate member belongs to issue's client
    |-- upsert feedbackVotes (one vote per member per issue)
    |-- redirect to /feedback/thanks page (static)
    v
[Admin dashboard -- aggregate stats]
    |-- per issue: count(up), count(down), total voters / total recipients
    |-- per client: trend over time
```

**Route implementation:**

```typescript
// api/src/routes/feedback.ts -- PUBLIC, no auth required
fastify.route({
  method: 'GET',
  url: '/feedback/:token/vote',
  schema: {
    params: z.object({ token: z.string() }),
    querystring: z.object({
      v: z.enum(['up', 'down']),
      m: z.coerce.number(),
    }),
  },
  handler: async (request, reply) => {
    const { token } = request.params;
    const { v, m } = request.query;
    await feedbackService.recordVote(token, m, v);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    return reply.redirect(`${frontendUrl}/feedback/thanks`);
  },
});
```

### 7. Premium Newsletter Template

**Approach: Extend existing React Email component**

The existing `DigestEmail.tsx` is a working foundation. Redesign adds:
- AI-Sanomat brand header (logo image, brand colors, tagline)
- Client co-branding (company name, industry badge)
- aisanomat.fi featured section ("AI-Sanomat suosittelee")
- Feedback buttons in footer (thumbs up/down emoji links)
- Cleaner typography, more whitespace, modern card-based story layout
- Week number and date in header

**Changes to `DigestEmailProps`:**

```typescript
export interface DigestEmailProps {
  // Existing
  clientName: string;
  digest: DigestEmailDigest;
  heroImageUrl: string | null;
  unsubscribeUrl: string;
  trackingPixelUrl?: string;
  // New
  clientIndustry: string;
  weekNumber: number;
  year: number;
  feedbackUpUrl: string;
  feedbackDownUrl: string;
  aisanomatFeatured?: {
    title: string;
    url: string;
    excerpt: string;
  };
  brandLogoUrl: string;  // AI-Sanomat logo hosted on server
}
```

**aisanomat.fi featured section data source:**
Add a news source of type `'rss'` pointing to aisanomat.fi's RSS feed (if available) or type `'manual'` where admin selects the featured article. The `newsletterService` pulls the latest aisanomat.fi-sourced item and passes it as `aisanomatFeatured` to the template.

---

## Modified Data Flow: End-to-End v1.1

```
[Scheduler: 06:00 daily -- news collection]
    |
    v
[newsCollectorService.collectAllNews()]  -- MODIFIED
    |-- RSS sources (existing, unchanged)
    |-- Beehiiv sources (existing, unchanged)
    |-- X account sources (NEW: xClient.fetchUserTweets)
    |-- X search sources (NEW: xClient.searchRecentTweets)
    |-- Web search sources (NEW: webSearchClient.searchAiNews)
    |-- Per-client web searches (NEW: client.searchPrompt -> webSearchClient)
    |
    |-- Each source wrapped in health tracking (sourceHealthLogs)
    |-- Insert newsItems with URL dedup (existing)
    v
[deduplicationService.embedAndDedup()]  -- NEW, runs after collection
    |-- Generate embeddings for new items (embeddingClient)
    |-- Find semantic duplicates via pgvector cosine similarity
    |-- Mark duplicates (isDuplicate = true)
    v
[Scheduler: 07:00 daily -- source health]
    |
    v
[sourceHealthService.runDailyCheck()]
    |-- Compute quality scores for all sources
    |-- Flag unhealthy sources
    v
[Scheduler: hourly -- check auto-generation schedules]
    |
    v
[scheduleService.checkDueClients()]
    |-- For each due client: generateClientDigest()
    v
[newsletterService.generateClientDigest()]  -- MODIFIED
    |-- Fetch newsItems with client-relevance:
    |     1. Client-specific items (sourceMetadata.clientId = clientId)
    |     2. General items (no clientId), ranked by relevance
    |     3. aisanomat.fi featured item (latest from aisanomat.fi source)
    |-- Exclude items WHERE isDuplicate = true
    |-- Fill prompt templates (existing)
    |-- Claude generation + validation (existing)
    |-- Gemini images (existing)
    |-- Generate feedbackToken for issue (NEW)
    |-- Status: ready (admin reviews)
    v
[Admin approves, sends]
    |
    v
[emailService.sendDigestToClient()]  -- MODIFIED
    |-- Render with premium template (co-branding, feedback URLs, featured section)
    |-- Per-member feedback URLs injected
    |-- Send via Resend (existing)
    v
[Resend webhooks]  -- existing, unchanged
[Feedback votes]   -- NEW public endpoint
```

---

## Recommended Project Structure (New/Modified Files)

```
api/src/
├── integrations/
│   ├── rssCollector.ts          # existing, unchanged
│   ├── beehiivClient.ts         # existing, unchanged
│   ├── claudeClient.ts          # existing, unchanged
│   ├── geminiClient.ts          # existing, unchanged
│   ├── resendClient.ts          # existing, unchanged
│   ├── xClient.ts               # NEW: X API v2 integration
│   ├── webSearchClient.ts       # NEW: Tavily search integration
│   └── embeddingClient.ts       # NEW: OpenAI embeddings
├── services/
│   ├── newsCollectorService.ts  # MODIFIED: add X, web search, health tracking
│   ├── newsletterService.ts     # MODIFIED: client-relevant news, featured section
│   ├── emailService.ts          # MODIFIED: feedback URLs, premium template
│   ├── imageService.ts          # existing, unchanged
│   ├── sources.ts               # existing, unchanged
│   ├── clients.ts               # existing, unchanged
│   ├── templates.ts             # existing, unchanged
│   ├── portalAuth.ts            # existing, unchanged
│   ├── deduplicationService.ts  # NEW: semantic dedup with pgvector
│   ├── sourceHealthService.ts   # NEW: health monitoring + quality scoring
│   ├── feedbackService.ts       # NEW: vote recording + aggregation
│   └── scheduleService.ts       # NEW: per-client scheduling logic
├── routes/
│   ├── feedback.ts              # NEW: public feedback endpoint
│   └── (existing routes -- minor additions for health/schedule admin endpoints)
├── emails/
│   ├── DigestEmail.tsx          # MODIFIED: premium redesign with co-branding
│   └── MagicLinkEmail.tsx       # existing, unchanged
├── db/
│   ├── schema.ts                # MODIFIED: new tables + columns + pgvector
│   └── (existing files)
└── scheduler.ts                 # MODIFIED: add hourly + daily health crons
```

---

## Architectural Patterns

### Pattern 1: Source Type Polymorphism via Collector Map

**What:** Each source type has a dedicated collector function. `newsCollectorService` dispatches based on `source.type` using a lookup map instead of the current if/else chain.

**Why:** Current code uses `if (source.type === 'rss') ... else if (source.type === 'beehiiv')`. Adding 3 more types makes this unwieldy and error-prone.

**Trade-offs:** Slightly more abstraction, but each collector is independently testable. New source types only require adding one entry to the map.

**Implementation:**

```typescript
type CollectorFn = (source: NewsSource) => Promise<CollectedItem[]>;

const collectors: Record<string, CollectorFn> = {
  rss: collectFromRss,
  beehiiv: collectFromBeehiiv,
  x_account: collectFromXAccount,
  x_search: collectFromXSearch,
  web_search: collectFromWebSearch,
  manual: async () => [],  // no-op, manual items added via admin
};

// In collectAllNews:
for (const source of sources) {
  const collector = collectors[source.type];
  if (!collector) {
    console.warn(`Unknown source type: ${source.type}`);
    continue;
  }
  const items = await collector(source);
  // ... insert items
}
```

### Pattern 2: Database-Driven Scheduling (Polling, Not Dynamic Crons)

**What:** A single hourly cron checks the database for clients due for generation, rather than creating/destroying cron jobs dynamically.

**Why:** Stateless, survives restarts, easy to reason about. The overhead of one DB query per hour is zero.

**Trade-offs:** Minimum scheduling resolution is 1 hour. This is fine for weekly/biweekly/monthly newsletter generation.

### Pattern 3: Embed-Then-Compare Dedup Pipeline

**What:** Run embedding generation as a separate step after all collection is complete, then compare new embeddings against the recent window.

**Why:** Batching embeddings is cheaper (one API call with 50-100 texts vs. 50 individual calls). Comparing against a window (7 days) keeps the search space small and HNSW index fast.

**Trade-offs:** Slight delay between collection and dedup. Not an issue since digest generation happens hours later.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Real-Time Embedding on Insert

**What people do:** Generate embedding for each newsItem immediately during collection.
**Why it is wrong:** Collection already involves external API calls (RSS, X, Tavily). Adding OpenAI embedding calls inline slows down collection and makes failure handling complex. One OpenAI outage blocks all news collection.
**Do this instead:** Collect first, embed in a batch second. If embedding fails, news items are still saved and can be embedded on retry.

### Anti-Pattern 2: One Cron Job Per Client

**What people do:** Dynamically create `cron.schedule()` for each client.
**Why it is wrong:** In-memory jobs are lost on server restart. Managing dynamic jobs is complex (add/remove/update as clients change). Race conditions when multiple jobs fire simultaneously.
**Do this instead:** Single hourly tick, query database for due clients.

### Anti-Pattern 3: Storing Embeddings in a Separate Vector DB

**What people do:** Spin up Pinecone/Qdrant/Weaviate alongside PostgreSQL.
**Why it is wrong:** Adds operational complexity, another service to manage, data synchronization issues between two stores. At this scale (hundreds to low thousands of news items), a dedicated vector DB provides no benefit.
**Do this instead:** pgvector in the same PostgreSQL instance. The scale does not justify a dedicated vector DB.

### Anti-Pattern 4: Feedback via POST in Email

**What people do:** Add forms or POST buttons in email templates.
**Why it is wrong:** Most email clients (Gmail, Outlook, Apple Mail) strip forms and do not support HTTP POST from emails.
**Do this instead:** Use GET links with query parameters. The GET endpoint records the vote and redirects to a static thank-you page.

### Anti-Pattern 5: Client-Specific News via Separate Collection Runs

**What people do:** Run separate collection pipelines per client, duplicating shared news items across client-specific tables.
**Why it is wrong:** Multiplies API calls, storage, and complexity. An article about "GPT-5 release" is relevant to all clients -- collecting it once is sufficient.
**Do this instead:** Collect all news into a shared pool. Tag client-specific search results with `sourceMetadata.clientId`. At digest generation time, combine shared pool + client-specific items. Let the Claude prompt handle industry-relevance filtering.

---

## Integration Points

### External Services

| Service | Integration Pattern | Monthly Cost | Rate Limits |
|---------|---------------------|-------------|-------------|
| X API v2 (Basic) | Bearer token auth, `twitter-api-v2` npm | $200 | 10K reads/month |
| Tavily | API key auth, `@tavily/core` npm | Free (1,000 credits) | 1,000 basic searches/month |
| OpenAI Embeddings | API key auth, `openai` npm | ~$0.002 | 3,500 RPM |
| Claude (existing) | API key auth, `@anthropic-ai/sdk` | Per-token | Existing limits |
| Resend (existing) | API key auth, `resend` npm | Existing plan | Existing limits |
| Gemini (existing) | API key auth | Existing plan | Existing limits |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Collector -> Dedup | Sequential: collect all, then embed+dedup | Batch processing, not inline |
| Scheduler -> Newsletter | Scheduler calls service directly (same process) | No queue needed at this scale |
| Email -> Feedback | GET link in email -> public API endpoint | Stateless, token-validated |
| Admin UI -> Source Health | REST API call to admin endpoints | Read-only dashboard data |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-10 clients | Current approach is fine. Single-process scheduler, direct service calls. |
| 10-50 clients | Consider running digest generation in a job queue (BullMQ) to avoid blocking the API process during long Claude/Gemini calls. |
| 50+ clients | Move scheduler to a separate worker process. Upgrade Tavily/X API tiers. pgvector HNSW handles 100K+ vectors well. |

### First Bottleneck

**Digest generation time.** Each digest requires 3-4 Claude calls + Gemini image generation. At ~30-60 seconds per digest, 10 clients due at the same hour would take 5-10 minutes sequentially. Acceptable for the hourly scheduler, but could be improved with parallel generation limited by API rate limits.

### Second Bottleneck

**X API read limits.** 10,000 reads/month at Basic tier. With 20+ influencer accounts and growing keyword searches, this could hit the ceiling. Solution: upgrade to Pro ($5,000/month -- steep) or use the pay-per-use option when it becomes generally available, or reduce collection frequency for X sources to every-other-day.

---

## Suggested Build Order (Dependencies-Aware)

The following order accounts for technical dependencies between features:

### Phase 1: Foundation (schema changes + collector refactor)
1. **Database schema migration** -- add pgvector extension, new tables, modified columns, extended enum
2. **Source type collector map** -- refactor `newsCollectorService` to use strategy map instead of if/else
3. **Source health instrumentation** -- wrap collection loop with timing/logging, sourceHealthLogs table

*Rationale: Everything else builds on the schema. Strategy pattern makes adding new source types clean.*

### Phase 2: New Collection Sources
4. **X API integration** -- `xClient.ts` + `x_account` and `x_search` collectors
5. **Tavily web search** -- `webSearchClient.ts` + `web_search` collector + per-client search
6. **Expanded RSS** -- add more RSS sources via admin UI (no code change needed, just data)

*Rationale: Each collector is independent. X and Tavily can be built in parallel.*

### Phase 3: Semantic Deduplication
7. **Embedding client** -- `embeddingClient.ts` (OpenAI text-embedding-3-small)
8. **Deduplication service** -- embed-then-compare pipeline, duplicate flagging
9. **Newsletter service update** -- exclude duplicates when selecting news for digest

*Rationale: Dedup depends on having multiple sources producing overlapping content (Phase 2).*

### Phase 4: Auto-Scheduling
10. **Schedule service** -- `isDue()` logic, client schedule fields
11. **Scheduler update** -- hourly tick calling `checkDueClients()`
12. **Admin UI for schedules** -- configure frequency/day/hour per client

*Rationale: Depends on reliable news collection (Phase 2) and clean data (Phase 3).*

### Phase 5: Email Redesign + Feedback
13. **Premium email template** -- redesign `DigestEmail.tsx` with brand frame + co-branding
14. **aisanomat.fi featured section** -- data flow from source to template
15. **Feedback system** -- `feedbackService`, public endpoint, vote URLs in email

*Rationale: Template redesign is cosmetic (no backend deps). Feedback requires template changes, so they ship together.*

### Phase 6: Source Health Dashboard
16. **Source health service** -- quality scoring algorithm, daily check cron
17. **Admin health UI** -- source health dashboard, alerts for failing sources

*Rationale: Needs accumulated health data from Phase 1 instrumentation. Lower priority than user-facing features.*

---

## Environment Variables Required (New)

```bash
# X API
X_BEARER_TOKEN=            # X API v2 Bearer token (Basic tier, $200/mo)

# Tavily
TAVILY_API_KEY=            # Tavily search API key (free tier: 1,000 credits/mo)

# OpenAI (for embeddings only, not for text generation)
OPENAI_API_KEY=            # OpenAI API key for text-embedding-3-small
```

---

## Sources

- [Drizzle ORM pgvector guide](https://orm.drizzle.team/docs/guides/vector-similarity-search) -- schema definition, cosineDistance, HNSW index (HIGH)
- [pgvector on Railway](https://railway.com/deploy/pgvector-latest) -- confirms availability (HIGH)
- [pgvector-node on GitHub](https://github.com/pgvector/pgvector-node) -- Node.js/Drizzle support (HIGH)
- [twitter-api-v2 npm](https://www.npmjs.com/package/twitter-api-v2) -- Node.js X API client docs (HIGH)
- [Tavily API credits & pricing](https://docs.tavily.com/documentation/api-credits) -- credit costs, plan tiers (HIGH)
- [OpenAI text-embedding-3-small](https://platform.openai.com/docs/models/text-embedding-3-small) -- $0.02/1M tokens, 512-dim Matryoshka support (HIGH)
- [X API pricing tiers](https://twitterapi.io/blog/twitter-api-pricing-2025) -- Basic $200/month, 10K reads (MEDIUM)
- [React Email templates](https://react.email/templates) -- component library (HIGH)
- [node-cron npm](https://www.npmjs.com/package/node-cron) -- scheduler features, setTime, waitForCompletion (HIGH)

---
*Architecture research for: AI-Sanomat Yrityksille v1.1 feature integration*
*Researched: 2026-03-03*
