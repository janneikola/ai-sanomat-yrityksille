---
phase: 12-structured-article-content
plan: 01
subsystem: email, api
tags: [react-email, zod, structured-content, email-template, prompt-engineering]

# Dependency graph
requires:
  - phase: 10-foundation-branding
    provides: DigestStory type with optional lead/contentBlocks, digestJsonSchema support
provides:
  - Updated viikkokatsaus_generointi prompt template with lead + contentBlocks instructions
  - Shared Zod schema with contentBlockSchema discriminated union
  - Conditional structured content rendering in DigestEmail (lead + bullets vs businessImpact fallback)
  - Email HTML byte-length logging with 80KB warning threshold
affects: [13-ai-hero-image]

# Tech tracking
tech-stack:
  added: []
  patterns: [structured-content-fallback, email-size-monitoring, discriminated-union-validation]

key-files:
  created: []
  modified:
    - api/src/db/seed.ts
    - packages/shared/src/schemas/digest.ts
    - api/src/emails/DigestEmail.tsx
    - api/src/services/emailService.ts

key-decisions:
  - "Use story.lead as the structured-vs-fallback discriminator (not contentBlocks presence)"
  - "Inline styles for ul/li bullet elements for Outlook Word engine compatibility"
  - "Buffer.byteLength with utf-8 for accurate Finnish multi-byte character size measurement"

patterns-established:
  - "Structured content fallback: check story.lead to decide rendering path, keep businessImpact for backward compat"
  - "Email size monitoring: log byte length before every send, warn at 80KB (Gmail clips at 102KB)"

requirements-completed: [CONTENT-01, CONTENT-02, CONTENT-03, CONTENT-04]

# Metrics
duration: 2min
completed: 2026-03-04
---

# Phase 12 Plan 01: Structured Article Content Summary

**Structured newsletter stories with lead sentences, bullet points, and visual hierarchy via prompt template + email template updates with backward-compatible fallback and email size monitoring**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T12:50:43Z
- **Completed:** 2026-03-04T12:53:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended prompt template with explicit lead/contentBlocks instructions and example JSON for Claude structured output
- Added Zod schema validation for structured content with discriminated union (lead/bullets block types)
- Implemented conditional email rendering: lead + bullets for new digests, businessImpact fallback for old digests
- Added Buffer.byteLength logging with 80KB warning threshold to prevent Gmail clipping

## Task Commits

Each task was committed atomically:

1. **Task 1: Update prompt template and shared Zod schema for structured content** - `af110b7` (feat)
2. **Task 2: Render structured content in DigestEmail and add email size logging** - `9844f22` (feat)

## Files Created/Modified
- `api/src/db/seed.ts` - Updated viikkokatsaus_generointi prompt template with lead/contentBlocks instructions and JSON example
- `packages/shared/src/schemas/digest.ts` - Added contentBlockSchema discriminated union, extended digestStorySchema with optional lead and contentBlocks
- `api/src/emails/DigestEmail.tsx` - Conditional rendering of structured content (Heading h3, bold lead, bullet list) with businessImpact fallback
- `api/src/services/emailService.ts` - Added Buffer.byteLength logging and 80KB warning threshold before email return

## Decisions Made
- Used `story.lead` as the discriminator for structured vs fallback rendering (presence of lead implies structured content)
- Used inline styles (not Tailwind classes) on `<ul>` and `<li>` elements for Outlook Word engine compatibility
- Used `Buffer.byteLength(html, 'utf-8')` instead of `html.length` because Finnish text uses multi-byte UTF-8 characters
- Added comment noting that `onConflictDoNothing` means existing production templates must be updated manually via admin UI

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in `api/src/services/deduplicationService.ts` (missing `embedding` column) -- these are unrelated to this plan and were not introduced by these changes. Logged as out-of-scope.

## User Setup Required

None - no external service configuration required. However, for existing production deployments, the prompt template must be updated manually via the admin UI at `/templates` since `onConflictDoNothing` skips existing rows.

## Next Phase Readiness
- Structured content rendering is complete and backward-compatible
- Phase 13 (AI Hero Image) can proceed independently
- Production prompt template needs manual update for existing deployments

## Self-Check: PASSED

All files exist, all commits verified, all content patterns confirmed present.

---
*Phase: 12-structured-article-content*
*Completed: 2026-03-04*
