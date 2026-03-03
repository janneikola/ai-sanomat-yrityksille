---
phase: 08-semantic-deduplication
verified: 2026-03-03T14:15:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 8: Semantic Deduplication Verification Report

**Phase Goal:** System detects and flags near-duplicate news items across all sources using semantic similarity, not just URL matching
**Verified:** 2026-03-03T14:15:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Every newly collected news item gets an embedding vector generated and stored in the database after collection | VERIFIED | `newsCollectorService.ts` lines 119-129: `processNewEmbeddings()` called after all collection steps in try/catch. `deduplicationService.ts` lines 55-127: fetches items with null embedding, calls `generateEmbeddings()`, stores result via `db.update().set({ embedding })`. Schema has `vector('embedding', { dimensions: 1536 })` column. |
| 2 | Near-duplicate items (cosine similarity >= 0.85) are automatically flagged with isDuplicate=true and canonicalItemId pointing to the oldest match | VERIFIED | `deduplicationService.ts` lines 102-123: After embedding each item, `findSimilarItems()` runs with threshold 0.85, finds canonical (lowest ID), sets `isDuplicate: true, canonicalItemId: canonical.id` on the newer item. Bidirectional handling present (lines 108-120). |
| 3 | High-confidence duplicates (>= 0.95) and near-duplicates (>= 0.85) use two-tier thresholds | VERIFIED | Backend defines both thresholds (`EXACT_DUPLICATE_THRESHOLD = 0.95`, `NEAR_DUPLICATE_THRESHOLD = 0.85`). The near-duplicate threshold drives flagging. The two tiers are visually distinguished in the admin UI: `page.tsx` lines 97-113 shows >= 95% as red "Tarkka kopio" badge and >= 85% as yellow "Lahes kopio" badge. Note: `EXACT_DUPLICATE_THRESHOLD` is defined but unused in backend logic -- both tiers get the same flag. The distinction is UI-only, which is acceptable for the requirement. |
| 4 | Flagged duplicates are NOT deleted -- they remain in the database with metadata for admin review | VERIFIED | `deduplicationService.ts` uses only `db.update()` to set `isDuplicate` and `canonicalItemId` flags. No `db.delete()` calls exist anywhere in the service. Schema column `isDuplicate` is boolean with default false, `canonicalItemId` is nullable integer. `getDuplicates()` queries where `isDuplicate = true` confirming items remain queryable. |
| 5 | Admin can view all deduplication decisions in a dedicated /deduplication page showing similarity scores | VERIFIED | `web/src/app/(admin)/deduplication/page.tsx` (213 lines): Full admin page with table of duplicates. Columns: Uutinen (title link), Alkuperainen (canonical link), Samankaltaisuus (similarity badge), Keratty (date), Toiminnot (actions). Fetches from `GET /api/admin/deduplication`. Similarity scores computed from embeddings in `getDuplicates()` (cosine similarity calculated client-side from vectors). Sidebar nav item "Duplikaatit" with Copy icon added at `app-sidebar.tsx` line 26. |
| 6 | Admin can override false positives by clearing the isDuplicate flag from the admin panel | VERIFIED | `page.tsx` lines 83-95: `handleOverride()` calls `POST /api/admin/deduplication/:itemId/override` with confirmation dialog. On success, removes row from table and shows toast. `deduplication.ts` route lines 44-66: receives itemId param, calls `overrideDuplicate()`. `deduplicationService.ts` lines 132-139: `overrideDuplicate()` sets `isDuplicate: false, canonicalItemId: null`. |
| 7 | Embedding generation gracefully skips when OPENAI_API_KEY is not set (never crashes) | VERIFIED | `openaiClient.ts` lines 5-13: `getClient()` returns null when API key missing. `generateEmbedding()` returns null with console.warn. `generateEmbeddings()` returns array of nulls. All API calls wrapped in try/catch returning null on error. `deduplicationService.ts` lines 80-83: checks if all embeddings are null and returns `{ embedded: 0, duplicatesFound: 0 }`. `newsCollectorService.ts` lines 119-129: entire dedup step wrapped in try/catch so failures never block collection. |
| 8 | Existing news items without embeddings are handled correctly (nullable embedding column, isNotNull filter in queries) | VERIFIED | Schema: `embedding: vector('embedding', { dimensions: 1536 })` is nullable (no `.notNull()`). `findSimilarItems()` line 39: `isNotNull(newsItems.embedding)` filter in where clause. `processNewEmbeddings()` line 63: `isNull(newsItems.embedding)` to find items needing embedding. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `api/src/integrations/openaiClient.ts` | OpenAI embedding client with lazy init and graceful degradation | VERIFIED | 65 lines, exports `generateEmbedding` and `generateEmbeddings`, lazy-init pattern matching tavilyClient.ts |
| `api/src/services/deduplicationService.ts` | Embedding generation pipeline and cosine similarity dedup logic | VERIFIED | 217 lines, exports `processNewEmbeddings`, `findSimilarItems`, `overrideDuplicate`, `getDuplicates` |
| `api/src/db/schema.ts` | newsItems table with embedding vector(1536), isDuplicate boolean, canonicalItemId integer columns + HNSW index | VERIFIED | Lines 92-108: all three columns present, HNSW index with `vector_cosine_ops` on third argument callback |
| `api/src/db/enablePgvector.ts` | Script to enable pgvector extension before drizzle-kit push | VERIFIED | 24 lines, exports `enablePgvector()`, standalone CLI runner, uses `db.execute(sql\`CREATE EXTENSION IF NOT EXISTS vector\`)` |
| `api/src/routes/deduplication.ts` | Admin API: list duplicates, override false positives, trigger embedding backfill | VERIFIED | 88 lines, three routes: GET `/deduplication`, POST `/deduplication/:itemId/override`, POST `/deduplication/process`. All with `onRequest: [fastify.authenticate]` |
| `web/src/app/(admin)/deduplication/page.tsx` | Admin deduplication review page with duplicate table and override button | VERIFIED | 213 lines (exceeds min_lines: 80). Full table with similarity badges, override buttons, loading/empty states, process trigger button |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `newsCollectorService.ts` | `deduplicationService.ts` | collectAllNews calls processNewEmbeddings after all news collection | WIRED | Line 13: `import { processNewEmbeddings } from './deduplicationService.js'`. Lines 121: `await processNewEmbeddings()` called after RSS/Beehiiv and web search steps, wrapped in try/catch. |
| `deduplicationService.ts` | `openaiClient.ts` | processNewEmbeddings calls generateEmbeddings for batch embedding | WIRED | Line 5: `import { generateEmbeddings } from '../integrations/openaiClient.js'`. Line 77: `await generateEmbeddings(texts)` called in processNewEmbeddings. |
| `deduplicationService.ts` | `schema.ts` | cosineDistance query against newsItems.embedding column | WIRED | Line 2: `import { cosineDistance } from 'drizzle-orm'`. Line 4: `import { newsItems } from '../db/schema.js'`. Line 24: `cosineDistance(newsItems.embedding, embedding)` used in similarity SQL expression. |
| `deduplication/page.tsx` | `deduplication.ts` routes | fetch calls to /api/admin/deduplication endpoints | WIRED | Line 51: `apiFetch('/api/admin/deduplication')` for GET list. Line 69: `apiFetch('/api/admin/deduplication/process', { method: 'POST' })`. Line 87: `apiFetch(\`/api/admin/deduplication/${itemId}/override\`, { method: 'POST' })`. |
| `app.ts` | `deduplication.ts` | Route registration | WIRED | Line 19: `import deduplicationRoutes from './routes/deduplication.js'`. Line 66: `await app.register(deduplicationRoutes, { prefix: '/api/admin' })`. |
| `app-sidebar.tsx` | `/deduplication` page | Navigation link | WIRED | Line 5: `Copy` icon imported from lucide-react. Line 26: `{ title: 'Duplikaatit', href: '/deduplication', icon: Copy }` in navItems array. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| DEDUP-01 | 08-01-PLAN | System generates embeddings for news items using OpenAI text-embedding-3-small | SATISFIED | `openaiClient.ts` uses `text-embedding-3-small` model (line 29). `deduplicationService.ts` generates embeddings for `title + summary` text and stores in DB. Pipeline runs automatically post-collection. |
| DEDUP-02 | 08-01-PLAN | System detects semantically similar news items across sources using cosine similarity | SATISFIED | `findSimilarItems()` uses `cosineDistance()` from drizzle-orm with pgvector. HNSW index on embedding column. Threshold 0.85 for near-duplicate detection. 14-day window for comparison scope. |
| DEDUP-03 | 08-01-PLAN | Near-duplicate items are flagged (not silently deleted) with link to canonical item | SATISFIED | `processNewEmbeddings()` sets `isDuplicate: true` and `canonicalItemId` pointing to oldest match. No delete operations. Items remain in DB for admin review. |
| DEDUP-04 | 08-01-PLAN | Admin can view deduplication decisions and override false positives | SATISFIED | Admin page at `/deduplication` shows table with similarity scores. Override button calls API to clear `isDuplicate` flag. Sidebar navigation added. |

No orphaned requirements. All four DEDUP requirements from REQUIREMENTS.md are mapped to Phase 8 and claimed by 08-01-PLAN.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `api/src/services/deduplicationService.ts` | 8 | `EXACT_DUPLICATE_THRESHOLD = 0.95` defined but unused in backend logic | Info | Two-tier distinction is visual-only in UI. Backend flags all items above 0.85 identically. Functionally correct -- the threshold exists for future behavioral differentiation if needed. |

No blockers or warnings found. No TODOs, FIXMEs, or placeholder comments in any phase files.

### Human Verification Required

### 1. Embedding Generation with Real API Key

**Test:** Set `OPENAI_API_KEY` in `api/.env`, insert a news item, run `POST /api/admin/deduplication/process`, verify the item gets an embedding stored in the database.
**Expected:** API returns `{ embedded: 1, duplicatesFound: 0 }` for first item. Database row has non-null embedding column.
**Why human:** Requires live OpenAI API key and running database with pgvector extension.

### 2. Duplicate Detection Accuracy

**Test:** Insert two news items with nearly identical titles/summaries but different URLs. Run deduplication process. Check that one is flagged as duplicate of the other.
**Expected:** Second item has `isDuplicate: true` and `canonicalItemId` pointing to first item's ID.
**Why human:** Requires running database with pgvector and live API calls to validate cosine similarity thresholds.

### 3. Admin Override Flow

**Test:** Navigate to `/deduplication` in admin panel, find a flagged duplicate, click "Ei duplikaatti", confirm the dialog.
**Expected:** Row disappears from table, toast shows "Duplikaattimerkinta poistettu", item's `isDuplicate` is false in DB.
**Why human:** UI interaction flow requiring browser and running app.

### 4. Collection Pipeline Integration

**Test:** Trigger daily news collection via scheduler or manual trigger. Check logs for deduplication step output.
**Expected:** Logs show "Deduplication: N items embedded, M duplicates found" after collection completes. Collection never fails even if dedup fails.
**Why human:** Requires full pipeline execution with live services.

### 5. pgvector Extension on Production Database

**Test:** Run `npx tsx src/db/enablePgvector.ts` followed by `npx drizzle-kit push` on the production Railway database.
**Expected:** pgvector extension created, schema changes applied (embedding column, HNSW index, isDuplicate, canonicalItemId).
**Why human:** Requires production database access and potentially Railway PostgreSQL migration to pgvector-enabled image.

### Gaps Summary

No gaps found. All 8 observable truths are verified with complete evidence in the codebase. All 6 artifacts exist, are substantive (well beyond minimum line counts), and are fully wired into the application. All 4 DEDUP requirements are satisfied. All key links are verified as connected. The anti-pattern scan found only one informational note (unused constant) with no impact on functionality.

The phase goal -- "System detects and flags near-duplicate news items across all sources using semantic similarity, not just URL matching" -- is achieved through a complete pipeline: OpenAI embedding generation, pgvector storage with HNSW indexing, cosine similarity search, automatic flagging with canonical item linking, admin review UI with override capability, and graceful degradation when API key is missing.

---

_Verified: 2026-03-03T14:15:00Z_
_Verifier: Claude (gsd-verifier)_
