---
phase: 10-foundation-branding
plan: 01
subsystem: database, email, types
tags: [drizzle, react-email, dark-mode, og-image, content-blocks, logo]

# Dependency graph
requires:
  - phase: 04-company-portal
    provides: "email rendering pipeline (DigestEmail, emailService)"
provides:
  - "ogImageUrl nullable column on newsItems table"
  - "LeadBlock, BulletsBlock, ContentBlock union types"
  - "DigestStory with optional lead and contentBlocks fields"
  - "Logo PNG rendering in email header with dark mode protection"
  - "logoUrl prop and construction in email pipeline"
affects: [11-og-image-extraction, 12-structured-content, 13-hero-image]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "White island pattern for dark mode logo protection in email"
    - "Optional type extension for backward-compatible schema evolution"

key-files:
  created:
    - "api/uploads/images/.gitkeep"
  modified:
    - "api/src/db/schema.ts"
    - "api/src/types/digest.ts"
    - "api/src/emails/DigestEmail.tsx"
    - "api/src/services/emailService.ts"

key-decisions:
  - "Logo rendered above AI-Sanomat text heading, not replacing it"
  - "White island uses #FAFAFA (off-white) to avoid aggressive Outlook dark mode inversion"
  - "contentBlocks and lead fields optional in both TypeScript and JSON schema for backward compatibility"
  - "logoUrl always constructed (not conditional) -- renders only if logo file exists at path"

patterns-established:
  - "Dark mode island: wrap images in .email-*-island with forced light background"
  - "Optional field extension: add optional fields to existing interfaces + JSON schemas without breaking existing data"

requirements-completed: [BRAND-01, BRAND-02]

# Metrics
duration: 2min
completed: 2026-03-04
---

# Phase 10 Plan 01: Foundation & Branding Summary

**ogImageUrl column on newsItems, ContentBlock types for structured content, and AI-Sanomat logo in email header with dark mode white island protection**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T09:11:29Z
- **Completed:** 2026-03-04T09:13:51Z
- **Tasks:** 2
- **Files modified:** 4 (+1 created)

## Accomplishments
- Added ogImageUrl nullable text column to newsItems table for Phase 11 OG image extraction
- Extended DigestStory with optional lead/contentBlocks fields and ContentBlock union types for Phase 12 structured content
- Added AI-Sanomat logo PNG rendering in email header with #FAFAFA white island for dark mode protection
- Logo URL constructed via existing toImageUrl helper for absolute hosted PNG URL

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend DB schema and TypeScript types** - `0dc8a47` (feat)
2. **Task 2: Add logo to email header with dark mode protection** - `4a8b2b7` (feat)

**Plan metadata:** (pending final docs commit)

## Files Created/Modified
- `api/src/db/schema.ts` - Added ogImageUrl nullable text column to newsItems table
- `api/src/types/digest.ts` - Added LeadBlock, BulletsBlock, ContentBlock types; extended DigestStory with optional lead and contentBlocks
- `api/src/emails/DigestEmail.tsx` - Logo Img in white island above text header, dark mode CSS for logo island
- `api/src/services/emailService.ts` - logoUrl construction via toImageUrl, passed as prop to DigestEmail
- `api/uploads/images/.gitkeep` - Placeholder directory for logo.png file

## Decisions Made
- Logo rendered above AI-Sanomat text heading (not replacing it) -- per locked decision in CONTEXT.md
- White island uses #FAFAFA background (off-white) -- avoids aggressive Outlook dark mode color inversion
- contentBlocks and lead are optional in both TypeScript interface and JSON schema -- old digests validate without these fields
- logoUrl is always constructed by emailService -- the DigestEmail component conditionally renders only when truthy

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in `api/src/services/deduplicationService.ts` (8 errors referencing non-existent `embedding` column) -- confirmed these exist on the unmodified codebase. Not caused by this plan's changes, not fixed (out of scope).
- Schema push (`drizzle-kit push`) skipped as DATABASE_URL is not set locally -- column will be created on next deploy

## User Setup Required

Logo PNG asset must be placed at `api/uploads/images/logo.png` before sending newsletters with the logo. Requirements per STATE.md:
- Dimensions: ~320x80px
- Format: PNG with transparent background
- Size: under 10KB
- The file will be served at `{PUBLIC_URL}/api/images/logo.png` via existing fastify-static config

## Next Phase Readiness
- ogImageUrl column ready for Phase 11 (OG image extraction) to populate
- ContentBlock types ready for Phase 12 (structured content) to generate
- Logo branding active in all new newsletters once logo.png is placed
- Existing newsletters render without errors (backward compatible)

## Self-Check: PASSED

All files verified present, all commits verified in git log.

---
*Phase: 10-foundation-branding*
*Completed: 2026-03-04*
