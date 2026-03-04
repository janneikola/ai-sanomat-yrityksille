---
phase: 13-ai-infographic-fallback
plan: 01
subsystem: api
tags: [gemini, og-image, newsletter, drizzle, image-generation]

# Dependency graph
requires:
  - phase: 11-og-image-extraction
    provides: "ogImageUrl column in newsItems table, populated by ogService"
  - phase: 12-structured-article-content
    provides: "structured DigestStory with sourceUrl, lead, contentBlocks"
provides:
  - "Three-tier image fallback: OG > Gemini > undefined"
  - "toImageUrl with absolute URL passthrough for OG images"
  - "Conditional Gemini generation (only for stories without OG images)"
  - "Clean no-image rendering when both OG and Gemini fail"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level exported pure function for testable URL transformation"
    - "inArray Drizzle query for batch OG image lookup by story URLs"
    - "Map-based index tracking for sparse Gemini image assignment"

key-files:
  created:
    - "api/src/services/emailService.test.ts"
  modified:
    - "api/src/services/emailService.ts"
    - "api/src/services/imageService.ts"
    - "api/src/integrations/geminiClient.ts"
    - "api/src/services/newsletterService.ts"

key-decisions:
  - "toImageUrl extracted as module-level export with baseUrl parameter for testability"
  - "PLACEHOLDER_IMAGE_URL eliminated entirely; undefined used as fallback for clean rendering"
  - "Gemini image prompts generated only for stories without OG images to save Claude API tokens"
  - "Hero image always generated via Gemini even when all stories have OG images"

patterns-established:
  - "Three-tier image fallback: ogImageMap.get() ?? geminiImageMap.get() ?? undefined"
  - "Sparse Gemini generation: only call image APIs for stories that actually need them"

requirements-completed: [IMAGE-03, IMAGE-04]

# Metrics
duration: 3min
completed: 2026-03-04
---

# Phase 13 Plan 01: AI Infographic Fallback Summary

**Three-tier image fallback with OG image passthrough, conditional Gemini generation for missing images, and clean no-image rendering on failure**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-04T13:21:43Z
- **Completed:** 2026-03-04T13:24:41Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Fixed toImageUrl to pass absolute OG image URLs through unchanged while still prefixing relative Gemini paths
- Eliminated PLACEHOLDER_IMAGE_URL constant that caused broken image tags (no actual placeholder file existed)
- Wired OG image lookup into newsletter pipeline with conditional Gemini generation only for stories without OG images
- Added 5 unit tests for toImageUrl covering absolute URLs, relative paths, and localhost base URL

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix toImageUrl for absolute URLs, eliminate PLACEHOLDER_IMAGE_URL, and add tests** - `eb4d879` (feat)
2. **Task 2: Wire OG image lookup and conditional Gemini generation into newsletterService** - `58d2551` (feat)

## Files Created/Modified
- `api/src/services/emailService.ts` - Exported toImageUrl with absolute URL passthrough and baseUrl parameter
- `api/src/services/emailService.test.ts` - 5 unit tests for toImageUrl covering all URL patterns
- `api/src/integrations/geminiClient.ts` - Removed PLACEHOLDER_IMAGE_URL export
- `api/src/services/imageService.ts` - Returns undefined instead of placeholder on generation failure; updated return types
- `api/src/services/newsletterService.ts` - OG image lookup via inArray, conditional Gemini generation, three-tier fallback merge

## Decisions Made
- toImageUrl extracted as module-level export with baseUrl parameter (instead of inline closure) for testability
- PLACEHOLDER_IMAGE_URL eliminated entirely -- undefined used as fallback for clean rendering (IMAGE-04)
- Gemini image prompts generated only for stories without OG images to save Claude API tokens
- Hero image always generated via Gemini even when all stories have OG images (no OG equivalent for hero)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 13 is the final phase in the v1.2 milestone
- All v1.2 Newsletter Quality & Design requirements are now complete (IMAGE-03, IMAGE-04 fulfilled)
- Pre-existing note: Verify Gemini billing enabled for image generation before production use (free tier is 0 IPM)

## Self-Check: PASSED

All files exist, all commits found, all content checks verified:
- toImageUrl exported with http:// and https:// passthrough
- PLACEHOLDER_IMAGE_URL removed from geminiClient.ts
- imageService returns string | undefined
- newsletterService uses inArray + ogImageMap for three-tier fallback
- 5 unit tests pass, 30 existing tests pass (zero regressions)

---
*Phase: 13-ai-infographic-fallback*
*Completed: 2026-03-04*
