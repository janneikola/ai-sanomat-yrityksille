# Phase 7: Web Search Integration - Research

**Researched:** 2026-03-03
**Domain:** Tavily web search API integration, per-client query generation, search caching
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Auto-generate Tavily queries from client's industry field (e.g., "fintech" -> "AI fintech news")
- Admin can override the auto-generated query with a custom searchPrompt (stored on clients table)
- If searchPrompt is empty/null, system auto-generates from industry
- Run 2-3 sub-queries per client per collection for broader coverage
- Post-fetch AI relevance filter: after fetching Tavily results, use Claude or keyword check to filter out non-AI results
- Web search runs as part of the existing daily 06:00 cron in collectAllNews()
- Only collect for clients whose digest is due within 24 hours (needs schedule awareness in collector)
- Search time range: last 7 days of results from Tavily
- Web search results stored as regular news_items in the shared pool (no per-client tagging)
- Cache Tavily query results in a dedicated search_cache DB table with 24-hour TTL
- If same query runs again within TTL, skip the API call
- Store top 5 results per query
- URL deduplication via existing news_items unique constraint still applies
- Source type badge visible in admin news items list (RSS, Beehiiv, Web Search)
- Separate web search management page (not embedded in client settings)
- Page lists all clients with: web search enabled/disabled, industry, search prompt, last run time
- Shows recent search results per client (title + URL) for quality verification
- Manual "Search now" trigger button per client for testing
- Editable search prompt field per client with auto-generated default shown

### Claude's Discretion
- Exact Tavily API parameters (search depth, include domains, exclude domains)
- AI relevance filter implementation (Claude call vs keyword matching)
- How to split industry into 2-3 sub-queries
- Search cache table schema details
- Web search management page layout and styling

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SRC-03 | System searches web via Tavily for industry-specific AI news per client | Tavily `@tavily/core` SDK with `topic: "news"`, `timeRange: "week"`, per-client query generation from industry field, search cache with 24hr TTL |
| SRC-04 | Admin can configure per-client industry search prompts for Tavily queries | New `searchPrompt` and `webSearchEnabled` columns on clients table, admin web search management page with editable prompts and manual trigger |
</phase_requirements>

## Summary

This phase integrates Tavily web search into the existing news collection pipeline to find industry-specific AI news that RSS feeds miss. The core work involves: (1) a new `tavilyClient.ts` integration that queries the Tavily Search API with per-client industry-tailored queries, (2) a `search_cache` DB table with 24-hour TTL to avoid redundant API calls, (3) modifications to `collectAllNews()` to run web searches for clients with digests due within 24 hours, (4) new columns on the `clients` table for `searchPrompt` and `webSearchEnabled`, and (5) a dedicated admin web search management page.

The Tavily API is straightforward -- the `@tavily/core` npm package (v0.7.2) provides a typed JavaScript/TypeScript client. The `topic: "news"` parameter combined with `timeRange: "week"` maps directly to the user's requirement of 7-day search windows. At 1 credit per basic search and 2-3 sub-queries per client, the free tier (1,000 credits/month) supports ~160-330 client-searches per month, which is ample for early stage.

The main architectural challenge is integrating client-aware logic into the currently source-driven `collectAllNews()`. The existing pattern iterates over active `newsSources`, but web search needs to iterate over active clients with `webSearchEnabled=true` whose digests are due. This means adding a second loop in `collectAllNews()` after the source-based collection, querying the schedule service to determine which clients are due.

**Primary recommendation:** Use `@tavily/core` v0.7.2 with `topic: "news"`, `searchDepth: "basic"` (1 credit), and `timeRange: "week"`. Implement keyword-based relevance filtering (not Claude calls) to keep costs and latency low. Cache with a dedicated `search_cache` PostgreSQL table.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tavily/core | 0.7.2 | Web search API client | Official Tavily TypeScript SDK, typed responses, simple API |
| drizzle-orm | 0.45.x | DB queries for search_cache + client columns | Already used throughout project |
| node-cron | 4.2.x | Scheduling (existing) | Already in place, web search hooks into 06:00 cron |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 3.25.x | Schema validation for new API endpoints | Already used for all route validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @tavily/core | Direct REST API calls via fetch | SDK handles auth, types, retries; raw fetch adds boilerplate |
| Keyword relevance filter | Claude API call per result | Claude call costs ~$0.003/call, adds 1-2s latency per result; keywords are free and instant |
| search_cache DB table | Redis/in-memory cache | DB cache survives Railway deploys (same reason as DB-driven scheduling); no Redis needed for this scale |

**Installation:**
```bash
cd api && npm install @tavily/core
```

## Architecture Patterns

### Recommended Project Structure
```
api/src/
  integrations/
    tavilyClient.ts          # Tavily API wrapper (follows rssCollector.ts pattern)
  services/
    webSearchService.ts      # Orchestration: query generation, caching, relevance filter
    newsCollectorService.ts  # Modified: add web search branch after RSS/Beehiiv
  db/
    schema.ts                # Modified: search_cache table, clients columns, sourceTypeEnum
  routes/
    webSearch.ts             # Admin API: list, trigger, configure per-client search
web/src/
  app/(admin)/
    web-search/
      page.tsx               # Web search management page
  components/
    web-search/
      client-search-table.tsx  # Table component
      search-prompt-editor.tsx # Inline prompt editor
```

### Pattern 1: Tavily Client Integration
**What:** Thin wrapper around `@tavily/core` that follows the existing integration client pattern (like `rssCollector.ts` and `beehiivClient.ts`)
**When to use:** All Tavily API calls go through this wrapper
**Example:**
```typescript
// Source: https://docs.tavily.com/sdk/javascript/reference
import { tavily } from '@tavily/core';

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY! });

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate: string | null;
}

export async function searchTavily(
  query: string,
  maxResults = 5
): Promise<TavilyResult[]> {
  const response = await tvly.search(query, {
    topic: 'news',
    searchDepth: 'basic',
    timeRange: 'week',
    maxResults,
  });
  return response.results.map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
    score: r.score,
    publishedDate: r.publishedDate ?? null,
  }));
}
```

### Pattern 2: Query Generation from Industry
**What:** Pure function that generates 2-3 sub-queries from a client's industry field
**When to use:** When no custom searchPrompt is set, or to supplement the custom prompt
**Example:**
```typescript
export function generateSearchQueries(
  industry: string,
  customPrompt?: string | null
): string[] {
  if (customPrompt) {
    // Custom prompt becomes primary query, add industry variant
    return [
      customPrompt,
      `${industry} artificial intelligence news`,
      `AI ${industry} trends`,
    ];
  }
  // Auto-generate from industry
  return [
    `AI ${industry} news`,
    `artificial intelligence ${industry} latest`,
    `${industry} tekoaly uutiset`,  // Finnish variant for local coverage
  ];
}
```

### Pattern 3: Search Cache with TTL
**What:** DB-based cache for Tavily query results with 24-hour TTL
**When to use:** Before every Tavily API call, check cache first
**Example:**
```typescript
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { searchCache } from '../db/schema.js';

export async function getCachedResults(queryHash: string): Promise<TavilyResult[] | null> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const cached = await db
    .select()
    .from(searchCache)
    .where(
      and(
        eq(searchCache.queryHash, queryHash),
        gt(searchCache.cachedAt, cutoff)
      )
    )
    .limit(1);
  if (cached.length === 0) return null;
  return JSON.parse(cached[0].results);
}
```

### Pattern 4: Client-Aware Collection in collectAllNews()
**What:** After existing RSS/Beehiiv source loop, add a web search loop over due clients
**When to use:** During the daily 06:00 collection
**Example:**
```typescript
// In collectAllNews(), after the source loop:

// Web search: iterate over clients with webSearchEnabled due within 24 hours
const webSearchClients = await db
  .select()
  .from(clients)
  .where(
    and(
      eq(clients.isActive, true),
      eq(clients.webSearchEnabled, true)
    )
  );

// Filter to clients due within 24 hours using schedule awareness
const dueClients = webSearchClients.filter((c) => {
  if (c.schedulePaused) return false;
  return isDueWithin24Hours(c.scheduleFrequency, c.scheduleDay, c.scheduleBiweeklyWeek);
});

for (const client of dueClients) {
  const queries = generateSearchQueries(client.industry, client.searchPrompt);
  for (const query of queries) {
    const results = await searchWithCache(query);
    // Insert results as news_items with web_search source
    for (const result of results) {
      await db.insert(newsItems).values({
        sourceId: webSearchSourceId,
        title: result.title,
        url: result.url,
        summary: result.content,
        publishedAt: result.publishedDate ? new Date(result.publishedDate) : null,
      }).onConflictDoNothing();
    }
  }
}
```

### Anti-Patterns to Avoid
- **Per-client news_items tagging:** Results go into the shared pool. Do NOT add clientId to news_items -- the digest generation already selects from the shared pool based on industry relevance.
- **Claude API call per search result for filtering:** At 5 results x 3 queries x N clients, this would be expensive and slow. Use keyword filtering instead.
- **In-memory cache:** Will be lost on Railway deploy. Use DB table.
- **Creating a new_source per client:** Use a single "Web Search" source in news_sources for health tracking. Individual client searches are tracked via search_cache.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Web search API | Custom web scraping | @tavily/core SDK | Tavily handles crawling, parsing, relevance ranking |
| Query hash for cache | Custom string hashing | Simple lowercase trim + sorted query | Predictable, deterministic, no crypto needed |
| Schedule awareness | Custom date math | Existing `isDueToday()` + new `isDueWithin24Hours()` helper | Reuse proven schedule logic from Phase 5 |
| Source type enum migration | Manual ALTER TABLE | Drizzle `db:push` | Project uses push-based schema sync, not manual migrations |

**Key insight:** Tavily already does the hard work of web crawling, content extraction, and relevance scoring. The integration layer is thin -- the complexity is in the orchestration (caching, dedup, schedule awareness) and admin UX.

## Common Pitfalls

### Pitfall 1: PostgreSQL Enum Extension
**What goes wrong:** Adding `'web_search'` to the existing `sourceTypeEnum` pgEnum requires an ALTER TYPE statement. Drizzle's `db:push` may not handle enum value additions cleanly.
**Why it happens:** PostgreSQL enums are immutable by default; adding a value requires `ALTER TYPE source_type ADD VALUE 'web_search'`.
**How to avoid:** Use `drizzle-kit push` which handles this. If it fails, run the ALTER TYPE manually before push. Test with a local DB first.
**Warning signs:** `db:push` errors mentioning enum types.

### Pitfall 2: Tavily API Key Missing in Environment
**What goes wrong:** `searchTavily()` crashes with undefined API key at runtime.
**Why it happens:** `TAVILY_API_KEY` is a new env var not yet in .env files.
**How to avoid:** Check for `TAVILY_API_KEY` at startup (or when web search is first called). Log a warning if missing but don't crash the entire collector. Skip web search gracefully.
**Warning signs:** Undefined or empty string passed to `tavily()` constructor.

### Pitfall 3: Rate Limiting / Credit Exhaustion
**What goes wrong:** Too many API calls exhaust the free tier (1,000 credits/month).
**Why it happens:** With 2-3 queries per client per day, credits add up: 10 clients x 3 queries x 30 days = 900 credits/month.
**How to avoid:** (1) Cache with 24-hour TTL prevents duplicate queries. (2) Only search for clients due within 24 hours. (3) Log credit usage per search run. (4) Consider basic search depth only (1 credit vs 2 for advanced).
**Warning signs:** HTTP 432 (plan limit) or 433 (PayGo limit) from Tavily API.

### Pitfall 4: Duplicate Results Across Sub-Queries
**What goes wrong:** Multiple sub-queries return the same URLs, causing wasted insert attempts.
**Why it happens:** "AI fintech news" and "artificial intelligence fintech" may return overlapping results.
**How to avoid:** The existing `onConflictDoNothing()` on news_items URL unique constraint handles this transparently. No extra dedup logic needed.
**Warning signs:** High `onConflictDoNothing` skip counts (informational, not a problem).

### Pitfall 5: isDueWithin24Hours Logic
**What goes wrong:** Incorrect schedule awareness causes web searches to run for wrong clients or not run at all.
**Why it happens:** The existing `isDueToday()` checks for exact day match, but we need "due within the next 24 hours" which may span two days.
**How to avoid:** Implement `isDueWithin24Hours()` by checking both today and tomorrow with `isDueToday()`. If either returns true, the client is due.
**Warning signs:** Web search not running for clients whose digest day is tomorrow.

### Pitfall 6: Non-AI Results in Search Results
**What goes wrong:** Queries like "AI fintech news" return general fintech articles without AI relevance.
**Why it happens:** Tavily returns results by general relevance to the query, not specifically AI-filtered.
**How to avoid:** Post-fetch keyword filter checking for AI-related terms in title + content. Use a set of terms: ["AI", "artificial intelligence", "tekoaly", "machine learning", "koneoppiminen", "neural", "GPT", "LLM", "generative"].
**Warning signs:** Digest contains articles with no AI connection.

## Code Examples

### search_cache Table Schema
```typescript
// In api/src/db/schema.ts
export const searchCache = pgTable('search_cache', {
  id: serial('id').primaryKey(),
  queryHash: varchar('query_hash', { length: 255 }).notNull(),
  query: text('query').notNull(),
  clientId: integer('client_id').references(() => clients.id),
  results: text('results').notNull(), // JSON string of TavilyResult[]
  resultCount: integer('result_count').notNull().default(0),
  cachedAt: timestamp('cached_at').notNull().defaultNow(),
});
```

### Extended Client Columns
```typescript
// Add to clients table in schema.ts
webSearchEnabled: boolean('web_search_enabled').notNull().default(false),
searchPrompt: text('search_prompt'), // nullable -- null means auto-generate from industry
lastWebSearchAt: timestamp('last_web_search_at'),
```

### Extended sourceTypeEnum
```typescript
// Modify existing enum
export const sourceTypeEnum = pgEnum('source_type', ['rss', 'beehiiv', 'manual', 'web_search']);
```

### Relevance Filter (Keyword-Based)
```typescript
// Recommended: keyword filter (fast, free, deterministic)
const AI_KEYWORDS = [
  'ai', 'artificial intelligence', 'tekoaly', 'machine learning',
  'koneoppiminen', 'neural', 'gpt', 'llm', 'generative',
  'deep learning', 'syvaoppiminen', 'chatbot', 'automation',
  'automaatio', 'robotiikka', 'robotics',
];

export function isAIRelevant(title: string, content: string): boolean {
  const text = `${title} ${content}`.toLowerCase();
  return AI_KEYWORDS.some((kw) => text.includes(kw));
}
```

### Admin Web Search Route (Trigger Search)
```typescript
// POST /admin/web-search/:clientId/trigger
f.route({
  method: 'POST',
  url: '/web-search/:clientId/trigger',
  onRequest: [fastify.authenticate],
  schema: {
    params: z.object({ clientId: z.coerce.number() }),
    response: {
      200: z.object({
        collected: z.number(),
        queries: z.number(),
        cached: z.number(),
      }),
    },
  },
  handler: async (request, reply) => {
    const result = await webSearchService.searchForClient(request.params.clientId);
    return reply.code(200).send(result);
  },
});
```

### Updated Shared Schemas
```typescript
// packages/shared/src/schemas/source.ts - add 'web_search' to all type enums
export const createSourceSchema = z.object({
  name: z.string().min(1, 'Nimi on pakollinen'),
  type: z.enum(['rss', 'beehiiv', 'manual', 'web_search']),
  // ...
});

// packages/shared/src/schemas/client.ts - add web search fields
export const updateClientSchema = z.object({
  // ... existing fields ...
  webSearchEnabled: z.boolean().optional(),
  searchPrompt: z.string().nullable().optional(),
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tavily` npm package (unofficial) | `@tavily/core` (official) | 2024 | Official SDK with TypeScript types, maintained by Tavily |
| Serper/SerpAPI + separate scraping | Tavily (search + content extraction in one) | 2024 | Single API call returns both search results AND extracted content |
| Basic search only | topic-based search (general/news/finance) | 2024-2025 | `topic: "news"` optimizes for news article discovery |

**Deprecated/outdated:**
- The `tavily` npm package (by transitive-bullshit) is an unofficial client. Use `@tavily/core` (official).
- The old Tavily REST API at `https://api.tavily.com/search` still works but the SDK is preferred for TypeScript projects.

## Open Questions

1. **Finnish query effectiveness**
   - What we know: Tavily is primarily English-focused, Finnish AI news may return limited results.
   - What's unclear: How well Finnish-language queries perform on Tavily.
   - Recommendation: Include both English and Finnish sub-queries. Monitor result quality after deployment. The existing RSS feeds already cover Finnish sources, so Tavily supplements with international AI news.

2. **Single web_search source vs. per-client source rows**
   - What we know: Decision is to store results in shared pool. Health tracking uses news_sources.
   - What's unclear: Should there be one "Web Search" news_source for all clients, or one per client?
   - Recommendation: One shared "Web Search" news_source for health tracking simplicity. Individual client search activity tracked via search_cache table and lastWebSearchAt on clients.

3. **Relevance filter threshold**
   - What we know: Post-fetch filtering needed. Keyword approach is fastest.
   - What's unclear: What percentage of Tavily news results will pass AI keyword filter.
   - Recommendation: Start with keyword filter, log filter rates. If too many false negatives, expand keywords. The manual "Search now" button lets admins verify quality before go-live.

## Sources

### Primary (HIGH confidence)
- [Tavily SDK Reference](https://docs.tavily.com/sdk/javascript/reference) - Complete search parameters, response structure, all types
- [Tavily Quickstart](https://docs.tavily.com/sdk/javascript/quick-start) - Installation, initialization, basic usage
- [Tavily Credits & Pricing](https://docs.tavily.com/documentation/api-credits) - Credit costs per operation, plan tiers

### Secondary (MEDIUM confidence)
- [@tavily/core npm](https://www.npmjs.com/package/@tavily/core) - Version 0.7.2 confirmed via `npm view`
- [Tavily REST API](https://docs.tavily.com/documentation/api-reference/endpoint/search) - Error codes (429, 432, 433), auth format

### Tertiary (LOW confidence)
- None -- all findings verified with official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - @tavily/core is the official SDK, version verified, API docs thoroughly reviewed
- Architecture: HIGH - Patterns follow established codebase conventions (integration clients, drizzle schema, Fastify routes, Next.js admin pages)
- Pitfalls: HIGH - Enum migration, API key handling, credit limits are well-documented concerns

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (Tavily API is stable, 30-day validity)
