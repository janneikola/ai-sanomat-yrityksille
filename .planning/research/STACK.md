# Stack Research: v1.1 Smart Sourcing & Polish

**Domain:** Enterprise AI-curated newsletter platform -- new feature additions
**Researched:** 2026-03-03
**Confidence:** HIGH (most libraries verified via npm/official docs)

## Scope

This covers ONLY new dependencies needed for v1.1 features. The existing validated stack (Fastify 5.7, Next.js 16.1, PostgreSQL 16, Drizzle ORM 0.45, Claude Sonnet 4.6 via @anthropic-ai/sdk, Gemini via @google/genai, Resend 6.9, React Email 1.0.8, node-cron 4.2, Zod 3.25, Svix 1.86) is NOT re-researched. See v1.0 research archive for those decisions.

---

## Recommended New Dependencies

### 1. X (Twitter) Monitoring: `twitter-api-v2`

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `twitter-api-v2` | ^1.29.0 | X API v2 client for influencer timelines and keyword search | Only actively maintained, strongly-typed Node.js client for X API v2. Full TypeScript support, automatic pagination with async iterators, built-in rate-limit handling. Officially listed on X developer platform. |

**X API Access Tier: Pay-Per-Use (recommended)**

X launched consumption-based pricing in February 2026. This is the right fit because:
- No $200/month minimum commitment (old Basic tier required this even for light use)
- Credits purchased upfront, deducted per request: single-item lookups = 1 credit, paginated (20 items) = 5 credits, batch (100 items) = 25 credits
- Spending caps prevent surprise bills, auto-top-up optional
- Monthly cap of 2M post reads -- far above newsletter needs
- For ~20 influencer timelines + keyword searches weekly, expect very low monthly cost

**Alternative considered: Third-party X data APIs** (TwitterAPI.io at $0.15/1K tweets, SocialData, SociaVault). These are 90% cheaper but introduce ToS violation risk, vendor instability, and a dependency on scraping infrastructure. For a legitimate B2B product sold to enterprises, the official API is the only defensible choice.

**Integration with existing codebase:**
```typescript
// New file: api/src/integrations/xClient.ts
import { TwitterApi } from 'twitter-api-v2';

const client = new TwitterApi(process.env.X_BEARER_TOKEN!);
const readOnly = client.readOnly;

// Keyword search (last 7 days) -- fits existing CollectedItem interface
export async function searchXPosts(query: string): Promise<CollectedItem[]> {
  const results = await readOnly.v2.search(query, {
    max_results: 100,
    'tweet.fields': ['created_at', 'public_metrics', 'entities'],
  });
  return results.data.data.map(tweet => ({
    title: tweet.text.slice(0, 200),
    url: `https://x.com/i/status/${tweet.id}`,
    summary: tweet.text,
    publishedAt: tweet.created_at ? new Date(tweet.created_at) : null,
  }));
}

// Influencer timeline monitoring
export async function fetchUserTimeline(userId: string): Promise<CollectedItem[]> {
  const timeline = await readOnly.v2.userTimeline(userId, {
    max_results: 10,
    'tweet.fields': ['created_at', 'public_metrics'],
  });
  // ... same mapping pattern
}
```

**Extends `newsCollectorService.ts`:** Add `'x_search'` and `'x_user'` to `sourceTypeEnum`. The existing sequential collection loop and try/catch per source pattern works unchanged.

---

### 2. Web Search: `@tavily/core`

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@tavily/core` | ^0.7.2 | AI-optimized web search for industry-specific news discovery | Returns LLM-ready extracted content in a single API call (search + scrape + extract). No separate scraping pipeline needed. Purpose-built for feeding results into AI models. |

**Why Tavily over Serper:**

| Factor | Tavily | Serper |
|--------|--------|--------|
| Output format | Clean extracted content per result | Raw SERP data (titles, URLs, snippets only) |
| Content extraction | Included -- aggregates from up to 20 sources | Not included -- requires separate scraping of each URL |
| Architecture impact | Single API call | Search API call + Puppeteer/fetch per URL + HTML cleaning |
| Free tier | 1,000 credits/month | 2,500 queries but each needs scraping |
| Paid pricing | ~$0.008/credit ($8/1K searches) | ~$1/1K queries + scraping infra cost |
| AI optimization | Built for LLM/RAG workflows | General SERP wrapper |

The decisive factor: Serper returns Google search snippets. To get actual article content for Claude to summarize, you would need to fetch and parse each URL separately, adding Puppeteer or a scraping service. Tavily eliminates this entire layer. For a newsletter platform that feeds search results into Claude, Tavily's single-call approach removes significant complexity.

**Pricing estimate:** Basic search = 1 credit, advanced search = 2 credits. For 10 clients with weekly industry-specific searches (2 searches each), that's ~80 credits/month -- well within the free 1,000 credits/month tier.

**Integration pattern:**
```typescript
// New file: api/src/integrations/tavilyClient.ts
import { tavily } from '@tavily/core';

const client = tavily({ apiKey: process.env.TAVILY_API_KEY! });

export async function searchWeb(query: string): Promise<CollectedItem[]> {
  const results = await client.search(query, {
    searchDepth: 'advanced',
    maxResults: 10,
    includeAnswer: false,
    topic: 'news',
  });
  return results.results.map(r => ({
    title: r.title,
    url: r.url,
    summary: r.content, // Already extracted, clean text
    publishedAt: null, // Tavily doesn't return publish dates
  }));
}
```

---

### 3. Semantic Deduplication: `openai` + `pgvector`

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `openai` | ^6.25.0 | OpenAI Embeddings API (`text-embedding-3-small`) for generating vector embeddings of news items | Cheapest quality embeddings: $0.02/1M tokens. 1536 dimensions. Anthropic does not offer an embeddings API (they partner with Voyage AI, which adds unnecessary vendor complexity). |
| pgvector (PostgreSQL extension) | 0.7+ | Vector column storage and cosine similarity search in existing PostgreSQL | No separate vector DB needed. Railway has one-click pgvector deployment templates. Drizzle ORM has built-in pgvector support (vector column type, cosineDistance function, HNSW indexes). |

**Why this approach:**

1. **Why not Claude for embeddings?** Anthropic explicitly does not offer an embeddings model. Their docs recommend Voyage AI, but adding a third AI vendor for a simple embedding task is unnecessary complexity.

2. **Why not a dedicated vector database (Pinecone, Qdrant, Weaviate)?** The dataset is tiny: ~100-500 news items per week. pgvector in the existing PostgreSQL handles this with zero operational overhead. A separate vector DB adds another service to manage on Railway for no benefit at this scale.

3. **Why not fuzzy string matching?** URL deduplication (already in v1.0 via `newsItems.url` UNIQUE constraint) catches exact duplicates. Semantic dedup catches "same story, different source" -- e.g., TechCrunch and The Verge both covering an OpenAI announcement with completely different titles and URLs. This requires understanding meaning, not string similarity.

4. **Why not local/on-device embeddings (transformers.js, ONNX)?** Adds CPU/memory overhead on Railway containers. The API approach is simpler and costs essentially nothing ($0.02/1M tokens -- 500 articles/week at ~100 tokens each = $0.001/week).

**Drizzle ORM pgvector integration (verified in official docs):**

```typescript
// Schema addition to newsItems table
import { vector, index } from 'drizzle-orm/pg-core';
import { cosineDistance, gt, desc, sql } from 'drizzle-orm';

export const newsItems = pgTable('news_items', {
  // ... existing columns unchanged
  embedding: vector('embedding', { dimensions: 1536 }),
}, (table) => [
  index('news_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
]);

// Deduplication query
const similarity = sql<number>`1 - (${cosineDistance(newsItems.embedding, queryEmbedding)})`;
const duplicates = await db
  .select({ id: newsItems.id, title: newsItems.title, similarity })
  .from(newsItems)
  .where(gt(similarity, 0.85)) // Threshold: 85% similarity = likely duplicate
  .orderBy(desc(similarity))
  .limit(5);
```

**Railway pgvector setup:** Railway offers PostgreSQL 16/17/18 templates with pgvector pre-installed. If the current instance doesn't have it, run `CREATE EXTENSION IF NOT EXISTS vector;` (requires superuser, which Railway grants). Alternatively, spin up a new PostgreSQL from the pgvector template and migrate.

---

## Features Requiring NO New Dependencies

### 4. Email Feedback (Thumbs Up/Down)

**Zero new libraries.** Implemented with existing stack:

- **Signed feedback URLs:** Use existing `@fastify/jwt` to create per-member, per-issue tokens containing `{ issueId, memberId, rating }` with long expiry. Embed as links in email template.
- **New API endpoint:** `GET /api/feedback?token=<jwt>` validates token, records feedback, redirects to a simple "Thank you" HTML page.
- **New database table:** `issue_feedback` with `issueId`, `memberId`, `rating` (enum: 'positive' | 'negative'), `createdAt`.
- **Email template change:** Add two button-style links in `DigestEmail.tsx` footer with thumbs-up/thumbs-down labels.

Why not an external survey service (Typeform, etc.)? Inline email buttons have far higher response rates. A single-click action directly in the email is the highest-conversion approach for satisfaction tracking.

### 5. Source Health Monitoring

**Zero new libraries.** Extends existing `newsCollectorService.ts`:

- **New columns on `news_sources`:** `lastSuccessAt` (timestamp), `lastErrorAt` (timestamp), `consecutiveErrors` (integer), `healthScore` (integer 0-100), `lastItemCount` (integer).
- **Collection wrapper:** Already has try/catch per source in the sequential loop. Add health metric updates on success/failure.
- **Staleness detection:** Add a `node-cron` job (already used) that flags sources with no new items for 7+ days.
- **Quality scoring:** Track how often items from each source are selected for final digests (used/collected ratio).

### 6. Premium Newsletter Design

**Zero new libraries.** Redesign `DigestEmail.tsx` using existing `@react-email/components`:

- Add AI-Sanomat logo image (static asset served via `@fastify/static`)
- Add client co-branding section with company name and industry tag
- Add "AI-Sanomat suosittelee" featured section for aisanomat.fi content
- Add feedback buttons in footer (see item 4)
- Improve spacing, typography, visual hierarchy
- Keep single-column 600px width for email client compatibility (mandatory best practice)

All necessary React Email primitives (`Button`, `Column`, `Row`, `Section`, `Img`, `Link`, `Hr`, `Text`, `Container`) are in `@react-email/components` 1.0.8, already installed.

### 7. Auto-Scheduled Digest Generation

**Zero new libraries.** Extends existing `node-cron` scheduler:

- **New columns on `clients`:** `sendFrequency` ('weekly' | 'biweekly' | 'monthly'), `preferredSendDay` (0-6), `preferredSendHour` (integer), `nextScheduledAt` (timestamp).
- **Scheduler enhancement:** Add cron job that checks `clients.nextScheduledAt <= NOW()` and triggers draft generation for matching clients.
- **Admin review gate:** Auto-generation creates digests in "ready" status. Admin reviews and explicitly approves before sending. This matches existing `issueStatusEnum` workflow.

---

## Complete Installation

### New Production Dependencies

```bash
npm install -w api twitter-api-v2@^1.29.0 @tavily/core@^0.7.2 openai@^6.25.0
```

### Database Extension

```sql
-- Run once on Railway PostgreSQL instance
CREATE EXTENSION IF NOT EXISTS vector;
```

### New Environment Variables

```env
# X API (pay-per-use account)
X_BEARER_TOKEN=

# Tavily (from tavily.com dashboard)
TAVILY_API_KEY=

# OpenAI (for embeddings only -- not for text generation)
OPENAI_API_KEY=
```

### No New Dev Dependencies

All existing dev tooling (tsx, drizzle-kit, TypeScript, ESLint) handles the new code.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `twitter-api-v2` (official) | TwitterAPI.io, SocialData, SociaVault | Third-party scraping services pose ToS risk for enterprise B2B product |
| `@tavily/core` | `serper` npm package | Serper returns raw SERP data requiring separate content scraping per URL |
| `@tavily/core` | Perplexity Search API | Chat-oriented API, harder to get structured results, more expensive |
| `@tavily/core` | Exa Search | More expensive, focused on similarity search rather than news discovery |
| OpenAI `text-embedding-3-small` | Voyage AI | Anthropic's recommended partner, but adds another vendor for a simple task |
| OpenAI `text-embedding-3-small` | Cohere Embed v3 | Good alternative, but OpenAI's pricing is lower and the SDK is simpler |
| OpenAI `text-embedding-3-small` | transformers.js (local) | CPU/memory overhead on Railway, API is simpler and effectively free at this scale |
| pgvector (in PostgreSQL) | Pinecone, Qdrant, Weaviate | Separate vector DB is overkill for <1K items/week; pgvector uses existing infra |
| JWT-signed feedback URLs | SurveyMonkey, Typeform | External tools add friction; inline email buttons have highest conversion |
| JWT-signed feedback URLs | Resend click tracking | Click tracking is deferred to v2.0 per scope; feedback needs explicit rating, not just click data |
| node-cron for scheduling | BullMQ + Redis | Adds Redis service on Railway ($5/mo); unnecessary for <50 clients with weekly batches |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|---------------------|
| Separate vector database (Pinecone, Qdrant) | Under 1K items/week; another service to manage on Railway | pgvector in existing PostgreSQL |
| Puppeteer / Playwright | Heavy browser automation, complex Railway deployment, unnecessary with Tavily | `@tavily/core` handles content extraction |
| Redis | Premature; no job queue or caching need at current scale | Node.js in-memory for caching, node-cron for scheduling |
| BullMQ | Over-engineering for weekly batch processing with <50 clients | node-cron + async functions |
| `@tavily/ai-sdk` | Vercel AI SDK v5/v6 integration wrapper; we don't use Vercel AI SDK | `@tavily/core` directly |
| `serper` npm package | Would need separate scraping layer to get article content | `@tavily/core` does search + extraction |
| Click tracking library | Explicitly deferred to v2.0 in PROJECT.md | Resend's built-in open tracking + feedback buttons |
| Multiple embedding models | text-embedding-3-small is more than sufficient for title/summary dedup | Single model, single vendor |
| Voyage AI SDK | Adds third AI vendor (after Anthropic and Google) for no clear benefit | OpenAI embeddings are simpler and cheaper |
| `@anthropic-ai/sdk` for embeddings | Anthropic does not offer embeddings | OpenAI `text-embedding-3-small` |

---

## Version Compatibility Matrix

| New Package | Compatible With | Notes |
|-------------|-----------------|-------|
| `twitter-api-v2@^1.29.0` | Node.js 16+, TypeScript 4.5+ | Uses native fetch in Node 18+; project already on Node 22+ |
| `@tavily/core@^0.7.2` | Node.js >= 18 | ESM compatible, matches project's `"type": "module"` |
| `openai@^6.25.0` | Node.js >= 18, TypeScript 4.7+ | ESM compatible; only using `client.embeddings.create()`, no streaming needed |
| `drizzle-orm@^0.45.0` + pgvector | pgvector extension 0.5+, PostgreSQL 12+ | Vector type, cosineDistance, HNSW index support added in drizzle-orm 0.30+; project is already on 0.45 |
| pgvector extension | PostgreSQL 12+ | Railway supports PG 16/17/18 with pgvector; `CREATE EXTENSION vector` is all that's needed |

---

## Integration Map (How New Libraries Touch Existing Code)

### New Files to Create

| File | Purpose | Dependencies |
|------|---------|-------------|
| `api/src/integrations/xClient.ts` | X API search + timeline functions | `twitter-api-v2` |
| `api/src/integrations/tavilyClient.ts` | Web search via Tavily | `@tavily/core` |
| `api/src/integrations/embeddingClient.ts` | Generate embeddings via OpenAI | `openai` |
| `api/src/services/deduplicationService.ts` | Semantic dedup logic using embeddings + pgvector | `embeddingClient`, `drizzle-orm` |

### Existing Files to Modify

| File | Change | Why |
|------|--------|-----|
| `api/src/db/schema.ts` | Add new source types to enum, vector column to newsItems, new tables (issue_feedback), new columns on clients and news_sources | Support new features |
| `api/src/services/newsCollectorService.ts` | Add X and Tavily source type handlers in the collection loop | New source types |
| `api/src/scheduler.ts` | Add auto-generation cron job, source health check job | Scheduled generation, health monitoring |
| `api/src/emails/DigestEmail.tsx` | Add branding, co-branding, featured section, feedback buttons | Premium design + feedback |
| `api/src/services/emailService.ts` | Generate per-member feedback URLs, pass to template | Feedback tokens |

### Files That Stay Unchanged

| File | Why |
|------|-----|
| `api/src/integrations/claudeClient.ts` | Content generation/validation unchanged |
| `api/src/integrations/geminiClient.ts` | Image generation unchanged |
| `api/src/integrations/resendClient.ts` | Email sending unchanged |
| `api/src/integrations/rssCollector.ts` | RSS collection unchanged, just gets more sources |
| `api/src/routes/webhooks.ts` | Resend webhook handling unchanged |

---

## Cost Summary (Monthly Estimates at 10 Clients)

| Service | Expected Usage | Monthly Cost |
|---------|---------------|-------------|
| X API (pay-per-use) | ~200 timeline reads + ~50 searches/week | ~$5-15 |
| Tavily | ~80 advanced searches/month | Free (1,000 credit tier) |
| OpenAI Embeddings | ~2K articles x 100 tokens = 200K tokens/month | ~$0.004 (effectively free) |
| pgvector | Runs in existing PostgreSQL | $0 |

**Total new API costs: ~$5-15/month** (dominated by X API)

---

## Sources

- [twitter-api-v2 npm](https://www.npmjs.com/package/twitter-api-v2) -- v1.29.0 confirmed, HIGH confidence
- [twitter-api-v2 GitHub docs](https://github.com/plhery/node-twitter-api-v2/blob/master/doc/v2.md) -- API reference, HIGH confidence
- [X API pay-per-use announcement](https://devcommunity.x.com/t/announcing-the-x-api-pay-per-use-pricing-pilot/250253) -- February 2026, MEDIUM confidence (pricing details evolving)
- [X API pricing overview](https://www.wearefounders.uk/the-x-api-price-hike-a-blow-to-indie-hackers/) -- tier breakdown, MEDIUM confidence
- [@tavily/core npm](https://www.npmjs.com/package/@tavily/core) -- v0.7.2 confirmed, HIGH confidence
- [Tavily JS quickstart](https://docs.tavily.com/sdk/javascript/quick-start) -- official docs, HIGH confidence
- [Tavily pricing/credits](https://docs.tavily.com/documentation/api-credits) -- credit model, HIGH confidence
- [Tavily vs Serper comparison](https://searchmcp.io/blog/tavily-vs-serper-search-api) -- output format differences, MEDIUM confidence
- [openai npm](https://www.npmjs.com/package/openai) -- v6.25.0 confirmed, HIGH confidence
- [OpenAI text-embedding-3-small](https://platform.openai.com/docs/models/text-embedding-3-small) -- $0.02/1M tokens, HIGH confidence
- [Anthropic embeddings page](https://platform.claude.com/docs/en/build-with-claude/embeddings) -- confirms no native embeddings, HIGH confidence
- [Drizzle ORM pgvector guide](https://orm.drizzle.team/docs/guides/vector-similarity-search) -- schema + query examples, HIGH confidence
- [Drizzle ORM PostgreSQL extensions](https://orm.drizzle.team/docs/extensions/pg) -- pgvector support, HIGH confidence
- [Railway pgvector deployment](https://railway.com/deploy/pgvector-latest) -- one-click template, HIGH confidence
- [Railway pgvector blog](https://blog.railway.com/p/hosting-postgres-with-pgvector) -- hosting details, HIGH confidence
- [Resend webhooks docs](https://resend.com/docs/webhooks/introduction) -- event types, HIGH confidence
- [Resend open/click tracking](https://resend.com/blog/open-and-click-tracking) -- tracking mechanism, HIGH confidence
- [pgvector GitHub](https://github.com/pgvector/pgvector) -- extension docs, HIGH confidence

---
*Stack research for: AI-Sanomat Yrityksille v1.1 Smart Sourcing & Polish*
*Researched: 2026-03-03*
