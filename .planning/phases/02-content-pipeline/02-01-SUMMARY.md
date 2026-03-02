---
phase: 02-content-pipeline
plan: 01
subsystem: api, integrations
tags: [rss-parser, node-cron, beehiiv, fastify, drizzle, next.js, sonner]

# Dependency graph
requires:
  - phase: 01-foundation-admin-setup
    provides: Fastify API with auth, Drizzle schema with newsItems/newsSources tables, admin panel with sidebar
provides:
  - RSS feed collection integration (rss-parser with 15s timeout)
  - Beehiiv API v2 client with Unix timestamp handling
  - News collector service orchestrating all sources with error isolation
  - Daily cron scheduler (06:00 Helsinki time)
  - News CRUD API routes (list, create, collect, delete)
  - Admin news page with table, inline add form, and collect trigger
  - Shared Zod schemas for news items
affects: [02-content-pipeline, 03-email-delivery]

# Tech tracking
tech-stack:
  added: [rss-parser ^3.13.0, node-cron ^4.2.1, @types/node-cron]
  patterns: [integration client wrapper, service orchestrator with error isolation, sequential source processing]

key-files:
  created:
    - api/src/integrations/rssCollector.ts
    - api/src/integrations/beehiivClient.ts
    - api/src/services/newsCollectorService.ts
    - api/src/scheduler.ts
    - api/src/routes/news.ts
    - packages/shared/src/schemas/news.ts
    - web/src/app/(admin)/news/page.tsx
  modified:
    - api/src/app.ts
    - api/src/index.ts
    - api/package.json
    - packages/shared/src/index.ts
    - web/src/components/app-sidebar.tsx
    - web/src/app/(admin)/layout.tsx

key-decisions:
  - "Beehiiv response typed with explicit BeehiivPost interface for strict TypeScript compatibility"
  - "Toaster from sonner added to admin layout for toast notification support across all admin pages"
  - "Sidebar icon Newspaper moved to Uutiset, Rss icon used for Uutislahteet to differentiate navigation items"
  - "News stub route created in Task 1 for compilation, replaced with full implementation in Task 2"

patterns-established:
  - "Integration client pattern: thin wrappers in api/src/integrations/ with typed interfaces"
  - "Sequential source processing: for-loop over sources (not Promise.all) to avoid rate limits"
  - "Silent dedup: onConflictDoNothing on unique URL constraint for all news insertions"
  - "Admin page pattern: inline form toggle, sonner toasts, loading states with Loader2"

requirements-completed: [CONT-01, CONT-02, CONT-03, CONT-04]

# Metrics
duration: 5min
completed: 2026-03-02
---

# Phase 2 Plan 01: News Collection Summary

**RSS/Beehiiv news collection with daily cron scheduler, manual entry API, URL deduplication, and admin news management page**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-02T10:56:29Z
- **Completed:** 2026-03-02T11:01:14Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Built RSS feed collector with rss-parser (15s timeout, User-Agent header, URL filtering)
- Built Beehiiv API v2 client with correct Unix timestamp conversion (seconds to milliseconds)
- News collector service orchestrates all active sources sequentially with per-source error isolation and silent URL deduplication
- Daily cron job registered at 06:00 Helsinki time, plus manual trigger API
- Full news CRUD routes: list, manual add (with dedup), collect trigger, delete
- Admin news page with sortable table, inline add form, and collect button with sonner toast feedback
- Sidebar updated with Uutiset navigation link

## Task Commits

Each task was committed atomically:

1. **Task 1: Integration clients, news collector service, and scheduler** - `6eba654` (feat)
2. **Task 2: News API routes, shared schemas, and admin news page** - `eeff8d6` (feat)

## Files Created/Modified
- `api/src/integrations/rssCollector.ts` - RSS feed fetcher with 15s timeout and User-Agent
- `api/src/integrations/beehiivClient.ts` - Beehiiv API v2 posts fetcher with typed response
- `api/src/services/newsCollectorService.ts` - Orchestrates collection from all active sources
- `api/src/scheduler.ts` - Daily cron job (06:00 Helsinki) and manual trigger
- `api/src/routes/news.ts` - GET/POST/DELETE news routes with Zod validation
- `packages/shared/src/schemas/news.ts` - CreateNewsItem, NewsItemResponse, CollectionResult schemas
- `packages/shared/src/index.ts` - Added news schema re-export
- `web/src/app/(admin)/news/page.tsx` - Admin news page with table, add form, collect button
- `web/src/components/app-sidebar.tsx` - Added Uutiset nav link, reassigned icons
- `web/src/app/(admin)/layout.tsx` - Added Toaster for sonner toast support
- `api/src/app.ts` - Registered news routes plugin
- `api/src/index.ts` - Starts scheduler after server boot
- `api/package.json` - Added rss-parser and node-cron dependencies

## Decisions Made
- Typed Beehiiv API response with explicit `BeehiivPost` interface instead of `Record<string, unknown>` for strict TypeScript mode compatibility
- Added Toaster from sonner to admin layout (was missing) so toast notifications work on all admin pages
- Used `Newspaper` icon for Uutiset and `Rss` icon for Uutislahteet to differentiate sidebar navigation
- Created stub news route in Task 1 so app.ts import compiles before full route implementation in Task 2

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Beehiiv client TypeScript strict mode errors**
- **Found during:** Task 1 (Beehiiv client implementation)
- **Issue:** `res.json()` returns `unknown` in strict mode, causing type errors on property access
- **Fix:** Defined explicit `BeehiivPost` and `BeehiivResponse` interfaces for typed casting
- **Files modified:** api/src/integrations/beehiivClient.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 6eba654 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added Toaster to admin layout**
- **Found during:** Task 2 (Admin news page)
- **Issue:** Sonner toasts require a `<Toaster />` component in the component tree, but it was not present in any layout
- **Fix:** Added `<Toaster />` from `@/components/ui/sonner` to the admin layout
- **Files modified:** web/src/app/(admin)/layout.tsx
- **Verification:** TypeScript compiles, sonner toasts will render
- **Committed in:** eeff8d6 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None - both tasks compiled and verified on first attempt after the type fix.

## User Setup Required

This plan requires Beehiiv API credentials for the Beehiiv source collection to work:
- `BEEHIIV_API_KEY` - From Beehiiv Dashboard -> Settings -> Integrations -> API Keys
- `BEEHIIV_PUBLICATION_ID` - From Beehiiv Dashboard -> Settings -> General -> Publication ID

These should be added to `api/.env`. RSS collection and manual news entry work without additional configuration.

## Next Phase Readiness
- News items will be collected in the database, ready for digest generation (02-02)
- The newsCollectorService returns structured results that can be extended with source-specific metrics
- All integration client patterns established for future Claude and Gemini clients

---
*Phase: 02-content-pipeline*
*Completed: 2026-03-02*
