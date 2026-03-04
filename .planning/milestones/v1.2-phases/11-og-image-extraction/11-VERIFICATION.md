---
phase: 11-og-image-extraction
verified: 2026-03-04T00:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Trigger actual news collection and query ogImageUrl from database"
    expected: "Newly inserted articles with accessible OG tags have a non-null ogImageUrl; duplicate articles (URL conflict) have no OG fetch triggered"
    why_human: "Requires live database connection and external HTTP reachability — cannot verify end-to-end pipeline programmatically in this environment"
---

# Phase 11: OG Image Extraction Verification Report

**Phase Goal:** Newly collected news articles have their source OG images stored in the database, ready to be used in newsletter generation.
**Verified:** 2026-03-04
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After news collection runs, articles with fetchable OG images have a non-null ogImageUrl in the database | VERIFIED | `fetchAndStoreOgImage` called with `.returning({ id })` row id; writes `ogImageUrl` via `db.update(newsItems).set({ ogImageUrl }).where(eq(...))` in `ogService.ts:51-53` |
| 2 | OG fetch never awaited inside the collection loop — collection speed is unaffected | VERIFIED | `newsCollectorService.ts:67` calls `fetchAndStoreOgImage(rows[0].id, item.url).catch(console.error)` with no `await` keyword |
| 3 | Generic site-wide images (URL contains 'default', 'logo', 'fallback', 'placeholder') are stored as null | VERIFIED | `isGenericImageUrl()` in `ogService.ts:12-15` filters these; 7 unit tests pass for all four patterns plus case-insensitivity |
| 4 | OG fetch failures (timeout, 404, blocked) are caught silently — article is stored normally | VERIFIED | `fetchOgImage` returns null on `error=true` from ogs; `fetchAndStoreOgImage` only updates on non-null result; `.catch(console.error)` at call site handles any thrown rejection |

**Score:** 4/4 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/src/services/ogService.ts` | fetchOgImage, fetchAndStoreOgImage, isGenericImageUrl helpers | VERIFIED | File exists, 56 lines, all three functions exported; substantive (uses `ogs`, drizzle update, generic URL filter); wired into newsCollectorService |
| `api/src/services/ogService.test.ts` | Unit tests for isGenericImageUrl | VERIFIED | File exists, 7 passing tests covering all four generic patterns and case-insensitivity; runs via `node --import tsx/esm --test` |
| `api/src/services/newsCollectorService.ts` | Modified insert with .returning() and fire-and-forget OG fetch | VERIFIED | Line 63 uses `.returning({ id: newsItems.id })`; line 67 fires `fetchAndStoreOgImage` without `await`; `rowCount` check fully replaced with `rows.length > 0` |
| `api/package.json` | open-graph-scraper in dependencies | VERIFIED | `"open-graph-scraper": "^6.11.0"` present at line 31 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `newsCollectorService.ts` | `ogService.ts` | import + fire-and-forget after insert | WIRED | Line 16: `import { fetchAndStoreOgImage } from './ogService.js'`; line 67: `fetchAndStoreOgImage(rows[0].id, item.url).catch(console.error)` — no await |
| `ogService.ts` | newsItems table | `db.update(newsItems).set({ ogImageUrl }).where(eq(newsItems.id, ...))` | WIRED | Lines 51-53: `await db.update(newsItems).set({ ogImageUrl: imageUrl }).where(eq(newsItems.id, newsItemId))` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| IMAGE-01 | 11-01-PLAN.md | Uutisartikkelin kuva haetaan ensisijaisesti lahdeartikkelin OG-metatiedoista | SATISFIED | `fetchOgImage()` uses `open-graph-scraper` to read `og:image` from article HTML; result stored in `newsItems.ogImageUrl` |
| IMAGE-02 | 11-01-PLAN.md | OG-kuvahaku kayttaa timeoutia (3-5s) eika esta digestin generointia | SATISFIED | `ogs({ timeout: 4 })` (4 seconds, within 3-5s range); fire-and-forget call without `await` means collection loop is never blocked |

No orphaned requirements detected. Both IMAGE-01 and IMAGE-02 are fully covered by Phase 11 plans and verified against implementation.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `api/src/services/deduplicationService.ts` | 24, 39, 63, 96, 191-194 | TypeScript errors — `Property 'embedding' does not exist` | Info | Pre-existing, out-of-scope: documented in SUMMARY as pre-existing errors unrelated to Phase 11. Neither `ogService.ts` nor `newsCollectorService.ts` introduce TS errors. |

No anti-patterns found in Phase 11 files (`ogService.ts`, `ogService.test.ts`, `newsCollectorService.ts`).

---

## Notes on Test Invocation

The PLAN and SUMMARY both document the test command as:

```
node --test src/services/ogService.test.ts
```

This command fails with `ERR_MODULE_NOT_FOUND` on Node 24 because the ESM/TypeScript resolver cannot locate the `.ts` file when referenced as `.js`. The correct invocation is:

```
node --import tsx/esm --test src/services/ogService.test.ts
```

All 7 tests pass with the correct command. This is a documentation issue in the plan/summary, not an implementation gap — the tests exist, are substantive, and pass.

---

## Human Verification Required

### 1. End-to-End OG Image Storage

**Test:** Trigger the `/api/admin/collect` endpoint (or scheduled news collection), then query:
```sql
SELECT id, url, og_image_url FROM news_items WHERE og_image_url IS NOT NULL ORDER BY collected_at DESC LIMIT 10;
```
**Expected:** Newly inserted articles from RSS/Beehiiv sources with accessible OG tags show non-null `og_image_url`. Duplicate articles (re-run) do not get OG fetch triggered (confirmed by `rows.length > 0` guard).
**Why human:** Requires a live PostgreSQL connection and outbound HTTP to real news sites — not verifiable statically.

---

## Gaps Summary

No gaps found. All four observable truths are verified against the actual implementation. Both required artifacts exist, are substantive, and are wired correctly. Both requirement IDs (IMAGE-01, IMAGE-02) are satisfied.

The only note is a pre-existing TypeScript error in `deduplicationService.ts` (embedding column absent from schema) which is documented in the SUMMARY as out-of-scope and does not affect Phase 11 functionality.

---

_Verified: 2026-03-04_
_Verifier: Claude (gsd-verifier)_
