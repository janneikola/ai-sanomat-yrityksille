---
phase: 11-og-image-extraction
plan: 01
subsystem: api
tags: [open-graph-scraper, og-image, news-collection, fire-and-forget]

# Dependency graph
requires:
  - phase: 10-foundation-branding
    provides: ogImageUrl column in newsItems schema
provides:
  - ogService.ts with fetchOgImage, fetchAndStoreOgImage, isGenericImageUrl exports
  - Non-blocking OG image fetch wired into news collection pipeline
affects: [13-ai-infographic-fallback]

# Tech tracking
tech-stack:
  added: [open-graph-scraper@6.11.0]
  patterns: [fire-and-forget async, generic URL pattern filtering]

key-files:
  created: [api/src/services/ogService.ts, api/src/services/ogService.test.ts]
  modified: [api/src/services/newsCollectorService.ts, api/package.json]

key-decisions:
  - "Extracted isGenericImageUrl as testable pure function to avoid ESM mocking complexity"
  - "Used .returning({ id }) instead of rowCount to get inserted row ID for OG fetch"

patterns-established:
  - "Generic URL filter: lowercase URL checked against pattern array ['default', 'logo', 'fallback', 'placeholder']"
  - "Fire-and-forget with .catch(console.error): non-blocking async call pattern for background tasks"

requirements-completed: [IMAGE-01, IMAGE-02]

# Metrics
duration: 2min
completed: 2026-03-04
---

# Phase 11 Plan 01: OG Image Extraction Summary

**OG image fetching service with open-graph-scraper, generic URL filtering, and non-blocking fire-and-forget integration into news collection pipeline**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T12:02:28Z
- **Completed:** 2026-03-04T12:04:53Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created ogService.ts with fetchOgImage, fetchAndStoreOgImage, and isGenericImageUrl exports
- Installed open-graph-scraper v6.11.0 with 4-second timeout and custom User-Agent
- Wired non-blocking OG fetch into newsCollectorService.ts using .returning() and fire-and-forget pattern
- Generic site-wide images (containing "default", "logo", "fallback", "placeholder") automatically filtered to null
- 7 unit tests for isGenericImageUrl passing, existing 9 sourceHealthService tests unaffected

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ogService.ts** (TDD)
   - `27f5d1d` (test) - Failing tests for isGenericImageUrl
   - `0dd7283` (feat) - ogService implementation + open-graph-scraper dependency
2. **Task 2: Wire OG fetch into newsCollectorService.ts** - `13c9bc3` (feat)

_Note: Task 1 followed TDD with RED and GREEN commits._

## Files Created/Modified
- `api/src/services/ogService.ts` - OG image fetching service with fetchOgImage, fetchAndStoreOgImage, isGenericImageUrl
- `api/src/services/ogService.test.ts` - 7 unit tests for generic URL pattern detection
- `api/src/services/newsCollectorService.ts` - Modified insert to use .returning(), fire-and-forget OG fetch
- `api/package.json` - Added open-graph-scraper dependency

## Decisions Made
- Extracted isGenericImageUrl as a pure exported function for direct testability, avoiding complex ESM mocking of the ogs module
- Used .returning({ id: newsItems.id }) to get the inserted row ID, replacing the previous rowCount-based check

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in deduplicationService.ts (embedding column references not in schema) -- these are unrelated to this plan and were not modified. Logged as out-of-scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- OG image URLs will be automatically populated for newly collected articles
- Phase 13 (AI Infographic Fallback) can use ogImageUrl from the database
- No manual intervention required -- OG fetch is fully automated and silent on failure

## Self-Check: PASSED

- [x] ogService.ts exists
- [x] ogService.test.ts exists
- [x] 11-01-SUMMARY.md exists
- [x] Commit 27f5d1d (RED) found
- [x] Commit 0dd7283 (GREEN) found
- [x] Commit 13c9bc3 (Task 2) found

---
*Phase: 11-og-image-extraction*
*Completed: 2026-03-04*
