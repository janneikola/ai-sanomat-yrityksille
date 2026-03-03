# Phase 8: Semantic Deduplication - Research

**Researched:** 2026-03-03
**Domain:** Vector embeddings, similarity search, pgvector, OpenAI embeddings API
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEDUP-01 | System generates embeddings for news items using OpenAI text-embedding-3-small | OpenAI Node.js SDK `openai` v6.x provides `client.embeddings.create()` with `text-embedding-3-small` model. 1536 default dimensions, reducible to 512 with negligible quality loss. |
| DEDUP-02 | System detects semantically similar news items across sources using cosine similarity | pgvector `<=>` cosine distance operator with Drizzle ORM's built-in `cosineDistance()` helper. HNSW index with `vector_cosine_ops` for performance. Two-tier thresholds (>=0.95 exact duplicate, >=0.85 near-duplicate). |
| DEDUP-03 | Near-duplicate items are flagged (not silently deleted) with link to canonical item | New columns on `newsItems`: `embedding vector(1536)`, `isDuplicate boolean`, `canonicalItemId integer` FK to self. Oldest matching item becomes canonical. |
| DEDUP-04 | Admin can view deduplication decisions and override false positives | New admin page `/deduplication` with table of flagged duplicates, similarity scores, link to canonical, and "Override" button that clears duplicate flag. |
</phase_requirements>

## Summary

Phase 8 adds semantic deduplication to the news pipeline. Currently, news items are deduplicated only by URL (`onConflictDoNothing` on the `url` unique constraint in `newsItems`). This misses the common case where the same story is reported by multiple sources with different URLs but nearly identical content.

The solution uses OpenAI's `text-embedding-3-small` model to generate 1536-dimensional embedding vectors for each news item's title+summary, stores them in PostgreSQL via the `pgvector` extension, and performs cosine similarity search to detect near-duplicates. Drizzle ORM v0.45+ has native `vector()` column type and `cosineDistance()` helper, so no custom types are needed.

The architecture is a post-collection pipeline step: after news items are inserted (with URL dedup), a background process generates embeddings for items that lack them, then runs cosine similarity against recent items to flag duplicates. Flagged items are NOT deleted -- they get a `canonicalItemId` pointer and `isDuplicate` flag so the admin can review and override false positives.

**Primary recommendation:** Use `openai` npm package for embeddings, `pgvector` extension in PostgreSQL (requires Railway DB migration to pgvector-enabled image), Drizzle ORM native `vector()` column, and a two-tier similarity threshold (>=0.95 exact match, >=0.85 near-duplicate flagging).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` | ^6.25.0 | OpenAI Node.js SDK for embedding generation | Official SDK, typed, supports `text-embedding-3-small` natively |
| `pgvector` (PostgreSQL extension) | 0.7+ | Vector storage and cosine similarity search in PostgreSQL | De facto standard for vector search in Postgres, used by Supabase/Neon/Railway |
| `drizzle-orm` | ^0.45.0 (already installed) | ORM with native `vector()` column type and `cosineDistance()` | Already in project, has first-class pgvector support since v0.31+ |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `drizzle-kit` | ^0.31.0 (already installed) | Schema push for vector column migration | `db:push` handles vector column addition |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pgvector in PostgreSQL | Dedicated vector DB (Pinecone, Qdrant) | Overkill for <10K items; separate infra cost; pgvector keeps everything in one DB |
| OpenAI text-embedding-3-small | Cohere embed-multilingual-v3.0 | Better Finnish benchmarks possible, but adds another vendor; OpenAI already decided in STATE.md |
| 1536 dimensions | 512 dimensions | Negligible quality difference per Azure SQL benchmark; saves 66% storage; recommend starting with 1536 for simplicity, can reduce later |

**Installation:**
```bash
cd api && npm install openai
```

No npm package needed for pgvector -- it is a PostgreSQL extension enabled via SQL:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## Architecture Patterns

### Recommended Project Structure
```
api/src/
├── integrations/
│   └── openaiClient.ts       # OpenAI embedding client (new)
├── services/
│   └── deduplicationService.ts # Embedding generation + cosine dedup logic (new)
├── routes/
│   └── deduplication.ts       # Admin dedup review API routes (new)
├── db/
│   └── schema.ts              # Add embedding, isDuplicate, canonicalItemId to newsItems
web/src/
├── app/(admin)/
│   └── deduplication/
│       └── page.tsx           # Admin dedup review page (new)
```

### Pattern 1: Embedding Client (Lazy Init, Graceful Degradation)
**What:** Same pattern as `tavilyClient.ts` -- lazy-init client, return empty/skip if API key missing
**When to use:** All external API integrations in this project
**Example:**
```typescript
// Source: Context7 /openai/openai-node + project pattern from tavilyClient.ts
import OpenAI from 'openai';

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    client = new OpenAI({ apiKey });
  }
  return client;
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const openai = getClient();
  if (!openai) {
    console.warn('OPENAI_API_KEY not set, skipping embedding generation');
    return null;
  }

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float',
  });

  return response.data[0].embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  const openai = getClient();
  if (!openai) return texts.map(() => null);

  // OpenAI supports batch embedding in a single call (up to 2048 inputs)
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
    encoding_format: 'float',
  });

  return response.data.map((d) => d.embedding);
}
```

### Pattern 2: Drizzle ORM Vector Schema + Cosine Similarity Query
**What:** Native vector column definition and cosine distance queries
**When to use:** Schema definition and similarity search
**Example:**
```typescript
// Source: Context7 /drizzle-team/drizzle-orm-docs - vector similarity guide
import { pgTable, serial, text, integer, boolean, timestamp, vector, index } from 'drizzle-orm/pg-core';
import { cosineDistance, gt, desc, sql } from 'drizzle-orm';

// Schema addition to newsItems:
export const newsItems = pgTable('news_items', {
  id: serial('id').primaryKey(),
  // ... existing columns ...
  embedding: vector('embedding', { dimensions: 1536 }),
  isDuplicate: boolean('is_duplicate').notNull().default(false),
  canonicalItemId: integer('canonical_item_id').references(() => newsItems.id),
}, (table) => [
  index('news_items_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
]);

// Similarity search:
async function findSimilarItems(embedding: number[], threshold: number, excludeId: number) {
  const similarity = sql<number>`1 - (${cosineDistance(newsItems.embedding, embedding)})`;

  return db
    .select({ id: newsItems.id, title: newsItems.title, similarity })
    .from(newsItems)
    .where(
      and(
        gt(similarity, threshold),
        isNotNull(newsItems.embedding),
        ne(newsItems.id, excludeId)
      )
    )
    .orderBy(desc(similarity))
    .limit(5);
}
```

### Pattern 3: Post-Collection Dedup Pipeline
**What:** Run embedding generation and dedup as a pipeline step after news collection, not inline during insert
**When to use:** After `collectAllNews()` completes
**Example:**
```typescript
// In scheduler.ts or as part of collectAllNews:
// 1. Collect news (existing) -> URL dedup via onConflictDoNothing
// 2. Generate embeddings for items without them
// 3. Run cosine similarity dedup on newly-embedded items
// 4. Flag duplicates (set isDuplicate=true, canonicalItemId=oldest match)

async function processNewEmbeddings() {
  // Fetch items without embeddings (batch)
  const unembedded = await db.select()
    .from(newsItems)
    .where(isNull(newsItems.embedding))
    .limit(100);

  if (unembedded.length === 0) return;

  // Generate embeddings in batch
  const texts = unembedded.map(item =>
    `${item.title}${item.summary ? ' ' + item.summary : ''}`
  );
  const embeddings = await generateEmbeddings(texts);

  // Store embeddings + check for duplicates
  for (let i = 0; i < unembedded.length; i++) {
    const item = unembedded[i];
    const embedding = embeddings[i];
    if (!embedding) continue;

    await db.update(newsItems)
      .set({ embedding })
      .where(eq(newsItems.id, item.id));

    // Check for near-duplicates against existing embedded items
    const similar = await findSimilarItems(embedding, 0.85, item.id);
    if (similar.length > 0) {
      // Canonical = the oldest (lowest ID) match
      const canonical = similar.reduce((min, s) => s.id < min.id ? s : min);
      await db.update(newsItems)
        .set({ isDuplicate: true, canonicalItemId: canonical.id })
        .where(eq(newsItems.id, item.id));
    }
  }
}
```

### Anti-Patterns to Avoid
- **Inline embedding during insert:** Do NOT call OpenAI API inside the news collection loop. It would slow collection, fail on API errors, and block other sources. Keep collection fast; embed async after.
- **Silently deleting duplicates:** Requirements explicitly say flag, not delete. The `isDuplicate` + `canonicalItemId` pattern preserves all data.
- **Single threshold for all decisions:** Use two tiers -- >=0.95 for high-confidence auto-flagging, >=0.85 for "likely duplicate" flagging with admin review.
- **Comparing against ALL items:** Only compare against items from the last 14 days (configurable). Old news items are irrelevant for dedup.
- **Embedding entire article content:** Title + summary is sufficient for dedup. Content field can be very long and would waste tokens.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vector storage | Custom array column + manual math | pgvector extension | Handles indexing, distance operators, optimized C code |
| Cosine distance in SQL | Raw SQL string building | `cosineDistance()` from drizzle-orm | Type-safe, handles array-to-JSON conversion |
| Embedding generation | HTTP fetch to OpenAI API | `openai` npm package | Handles auth, retries, types, batch support |
| HNSW index creation | Manual CREATE INDEX SQL | Drizzle schema with `index().using('hnsw')` | Managed by drizzle-kit push |

**Key insight:** pgvector + Drizzle ORM give you a complete vector similarity solution without any external vector database. The entire stack stays in PostgreSQL.

## Common Pitfalls

### Pitfall 1: Railway PostgreSQL Missing pgvector Extension
**What goes wrong:** `CREATE EXTENSION vector` fails because the standard Railway PostgreSQL image does not include pgvector binaries.
**Why it happens:** Railway's default PostgreSQL service uses a standard image without pgvector compiled. The extension must be present in the filesystem before `CREATE EXTENSION` works.
**How to avoid:** Deploy Railway's pgvector template (pgvector/pgvector:pg17 or pg18) and migrate data with `pg_dump`/`pg_restore`. Alternatively, check if the current Railway PostgreSQL already supports the extension by running `CREATE EXTENSION IF NOT EXISTS vector;` -- it may work if Railway has updated their base image.
**Warning signs:** Error `could not open extension control file "/usr/share/postgresql/XX/extension/vector.control"` when running CREATE EXTENSION.

### Pitfall 2: Drizzle-kit and pgvector Extension Lifecycle
**What goes wrong:** `drizzle-kit push` cannot create the pgvector extension. It only manages tables/columns/indexes, not extensions.
**Why it happens:** PostgreSQL extensions are a server-level concern, not a schema migration concern. Drizzle-kit does not have `CREATE EXTENSION` capability.
**How to avoid:** Run `CREATE EXTENSION IF NOT EXISTS vector;` manually (or in a seed/init script) BEFORE running `drizzle-kit push`. The vector column type and HNSW index will then work.
**Warning signs:** `drizzle-kit push` error about unknown type "vector".

### Pitfall 3: Embedding Null Handling
**What goes wrong:** News items inserted before Phase 8 have no embeddings. Queries that assume all items have embeddings fail or return wrong results.
**Why it happens:** The `embedding` column is nullable (must be, since existing rows have no embedding).
**How to avoid:** Always filter with `isNotNull(newsItems.embedding)` in similarity queries. Backfill existing items with a one-time migration script.
**Warning signs:** Similarity queries returning items with `null` similarity scores.

### Pitfall 4: OpenAI API Rate Limits on Batch Embeddings
**What goes wrong:** Generating embeddings for hundreds of news items at once hits OpenAI rate limits.
**Why it happens:** text-embedding-3-small has rate limits (varies by tier: 1M-10M tokens/min). A backfill of existing items could trigger this.
**How to avoid:** Batch in groups of 50-100 items with small delays. OpenAI supports array input (up to 2048 items per call), but respect the token-per-minute limit. For backfill, use the Batch API (50% cheaper, higher limits).
**Warning signs:** 429 Too Many Requests errors from OpenAI.

### Pitfall 5: Finnish Content Embedding Quality
**What goes wrong:** News items with Finnish titles/summaries might produce lower-quality embeddings than English content, leading to false negatives in dedup.
**Why it happens:** text-embedding-3-small's multilingual MIRACL score improved to 44% (from 31.4%), but Finnish is not individually benchmarked. Finnish is an agglutinative language with complex morphology.
**How to avoid:** Use title + summary for embeddings (not just title). Start with 0.85 near-duplicate threshold (lower than the 0.95 commonly used for English). Monitor false positive/negative rates in admin UI and adjust thresholds. Most AI news articles have English terms mixed in, which helps.
**Warning signs:** Semantically identical Finnish articles not flagged as duplicates.

### Pitfall 6: Self-Referencing Foreign Key in newsItems
**What goes wrong:** Adding `canonicalItemId` as a self-referencing FK on `newsItems` can cause issues with bulk deletes or cascading.
**Why it happens:** If a canonical item is deleted, all items pointing to it lose their reference.
**How to avoid:** Use `SET NULL` on delete for the `canonicalItemId` FK. When showing dedup UI, handle the case where canonical item no longer exists.
**Warning signs:** FK constraint violations when deleting news items.

## Code Examples

Verified patterns from official sources:

### OpenAI Embedding Generation (Batch)
```typescript
// Source: Context7 /openai/openai-node
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Single embedding
const single = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'AI tekoaly uutinen otsikko',
  encoding_format: 'float',
});
const vector = single.data[0].embedding; // number[1536]

// Batch embedding (multiple texts in one API call)
const batch = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: ['Text 1', 'Text 2', 'Text 3'],
  encoding_format: 'float',
});
const vectors = batch.data.map(d => d.embedding); // number[][1536]
```

### Drizzle ORM Vector Column + HNSW Index
```typescript
// Source: Context7 /drizzle-team/drizzle-orm-docs - vector similarity guide
import { index, pgTable, serial, text, vector, boolean, integer } from 'drizzle-orm/pg-core';

export const newsItems = pgTable('news_items', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  url: text('url').notNull().unique(),
  summary: text('summary'),
  embedding: vector('embedding', { dimensions: 1536 }),
  isDuplicate: boolean('is_duplicate').notNull().default(false),
  canonicalItemId: integer('canonical_item_id'),
}, (table) => [
  index('news_items_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
]);
```

### Cosine Similarity Search with Drizzle
```typescript
// Source: Context7 /drizzle-team/drizzle-orm-docs - cosineDistance guide
import { cosineDistance, gt, desc, sql, and, isNotNull, ne } from 'drizzle-orm';

const similarity = sql<number>`1 - (${cosineDistance(newsItems.embedding, queryEmbedding)})`;

const similar = await db
  .select({
    id: newsItems.id,
    title: newsItems.title,
    url: newsItems.url,
    similarity,
  })
  .from(newsItems)
  .where(
    and(
      gt(similarity, 0.85),
      isNotNull(newsItems.embedding),
      ne(newsItems.id, currentItemId)
    )
  )
  .orderBy(desc(similarity))
  .limit(5);
```

### pgvector Extension Setup (SQL)
```sql
-- Source: Context7 /pgvector/pgvector
-- Run ONCE before drizzle-kit push (manually or in init script)
CREATE EXTENSION IF NOT EXISTS vector;

-- HNSW index (created by drizzle-kit push from schema definition)
CREATE INDEX IF NOT EXISTS "news_items_embedding_idx"
  ON "news_items" USING hnsw (embedding vector_cosine_ops);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| URL-only dedup (`onConflictDoNothing`) | Semantic embedding + cosine similarity | Phase 8 addition | Catches ~30-50% more duplicates across different sources |
| Custom vector math in application code | pgvector extension in PostgreSQL | pgvector 0.5+ (2023) | 10-100x faster similarity search, proper indexing |
| `text-embedding-ada-002` (1536d, $0.10/1M) | `text-embedding-3-small` (1536d, $0.02/1M) | Jan 2024 | 5x cheaper, better multilingual, Matryoshka dimension reduction |
| IVFFlat indexes | HNSW indexes | pgvector 0.5+ | Better recall, no need for pre-training with data, handles inserts without reindexing |
| Drizzle `customType` for vector | Native `vector()` from `drizzle-orm/pg-core` | drizzle-orm 0.31+ | No workarounds needed, built-in distance helpers |

**Deprecated/outdated:**
- `text-embedding-ada-002`: Superseded by text-embedding-3-small (better quality, 5x cheaper)
- IVFFlat index type: HNSW is now recommended for datasets under 1M rows (no list training needed)
- Custom Drizzle types for pgvector: Native `vector()` type available since drizzle-orm v0.31

## Open Questions

1. **Railway PostgreSQL pgvector availability**
   - What we know: Railway's standard PostgreSQL image may NOT include pgvector binaries. Dedicated pgvector templates exist (pgvector/pgvector:pg17, pg18). Migration via pg_dump/pg_restore is the documented path.
   - What's unclear: Whether the current project's Railway PostgreSQL instance already supports `CREATE EXTENSION vector`. This needs to be tested.
   - Recommendation: Try `CREATE EXTENSION IF NOT EXISTS vector;` on the current instance first. If it fails, deploy a new Railway PostgreSQL with pgvector template and migrate data. Document this as a prerequisite step in the plan.

2. **Finnish text embedding quality for dedup**
   - What we know: text-embedding-3-small improved multilingual MIRACL from 31.4% to 44%. Finnish is not individually benchmarked. Most AI news has mixed Finnish+English content.
   - What's unclear: The actual false negative rate for Finnish-only articles.
   - Recommendation: Start with 0.85 threshold (slightly lower than typical 0.90-0.95 for English), monitor via admin UI, adjust based on real data. The admin override feature (DEDUP-04) provides a safety net.

3. **Backfill strategy for existing news items**
   - What we know: Existing news items have no embeddings. OpenAI batch API is 50% cheaper for non-urgent work.
   - What's unclear: How many existing items there are and whether backfill is worth the cost.
   - Recommendation: Include a one-time backfill script that processes existing items in batches of 100. For a typical deployment with <1000 items, cost is negligible (~$0.01).

## Sources

### Primary (HIGH confidence)
- Context7 /pgvector/pgvector - Vector column creation, HNSW index, cosine distance queries
- Context7 /drizzle-team/drizzle-orm-docs - Native `vector()` type, `cosineDistance()` helper, HNSW index schema
- Context7 /openai/openai-node - `client.embeddings.create()` API, text-embedding-3-small usage

### Secondary (MEDIUM confidence)
- [Railway pgvector deployment](https://railway.com/deploy/pgvector-latest) - Railway pgvector template availability
- [Railway pgvector Help Station](https://station.railway.com/questions/enable-pgvector-extension-for-postgre-sql-e861e033) - Extension enable process on Railway
- [OpenAI text-embedding-3-small model page](https://platform.openai.com/docs/models/text-embedding-3-small) - 1536 dimensions, 8191 max tokens
- [OpenAI pricing](https://openai.com/api/pricing/) - $0.02/1M tokens for text-embedding-3-small
- [Azure SQL embedding dimensions benchmark](https://devblogs.microsoft.com/azure-sql/embedding-models-and-dimensions-optimizing-the-performance-resource-usage-ratio/) - 1536 vs 512 negligible quality difference
- [NVIDIA NeMo semantic dedup guide](https://docs.nvidia.com/nemo-framework/user-guide/25.07/datacuration/semdedup.html) - Threshold tuning best practices

### Tertiary (LOW confidence)
- Finnish language embedding quality: No specific benchmarks found. Recommendation based on general multilingual MIRACL improvement and the fact that AI news articles contain significant English terminology.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via Context7 with current documentation and code examples
- Architecture: HIGH - Drizzle ORM native pgvector support verified with official guide; pattern matches existing project conventions
- Pitfalls: MEDIUM - Railway pgvector availability needs runtime verification; Finnish embedding quality is unverified but mitigated by admin override feature

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable domain; pgvector and OpenAI embeddings API are mature)
