---
phase: 05-foundation-automation
plan: 02
subsystem: ui
tags: [admin-ui, schedule-config, source-health, scheduler-history, fastify, next.js, shadcn]

# Dependency graph
requires:
  - phase: 05-foundation-automation
    provides: scheduleService, sourceHealthService, schedule/health columns, schedulerRuns/sourceHealthLogs tables, PUT /clients/:id/schedule endpoint
provides:
  - Admin schedule config UI on client detail page (frequency, day, biweekly, pause/resume)
  - Source list with health status dots, filtering, and expandable health logs
  - Dashboard scheduler run log and next scheduled date per client
  - GET /sources with healthStatus filter query param
  - GET /sources/:id/health-logs endpoint
  - GET /dashboard/scheduler-runs endpoint
  - GET /dashboard/stats with nextScheduledDate, scheduleFrequency, schedulePaused
affects: [06-template-personalization, 07-feedback-analytics]

# Tech tracking
tech-stack:
  added: []
  patterns: [health-filter-bar, expandable-table-rows, schedule-config-inline-editing]

key-files:
  created: []
  modified:
    - api/src/routes/sources.ts
    - api/src/routes/dashboard.ts
    - api/src/services/sources.ts
    - web/src/app/(admin)/clients/[id]/page.tsx
    - web/src/app/(admin)/sources/page.tsx
    - web/src/components/sources/source-table.tsx
    - web/src/app/(admin)/page.tsx

key-decisions:
  - "Client-side health filtering via API query param for simplicity (compute healthStatus in service layer, filter in route handler)"
  - "Expandable table rows for health logs instead of separate detail page (keeps source list as single view)"
  - "Inline schedule config on client detail page (not dialog) for direct editing"

patterns-established:
  - "Expandable table row pattern: click chevron to fetch and display nested data inline"
  - "Filter bar pattern: toggle buttons with colored dots for visual status filtering"
  - "Schedule config pattern: Select dropdowns with conditional biweekly field visibility"

requirements-completed: [SCHED-02, HEALTH-01, HEALTH-02, HEALTH-03]

# Metrics
duration: 5min
completed: 2026-03-03
---

# Phase 5 Plan 2: Admin UI for Schedule Config, Source Health Display, and Scheduler History Summary

**Admin UI with per-client schedule configuration (frequency/day/pause), source list with green/yellow/red health dots and expandable fetch logs, and dashboard scheduler run history table**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-03T10:42:03Z
- **Completed:** 2026-03-03T10:47:03Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Client detail page has "Aikataulu" card with frequency/day/biweekly selectors, pause/resume toggle, and next scheduled date display
- Source list with health status filter bar (Kaikki/Kunnossa/Varoitus/Virhe) and expandable health log rows showing last 20 fetch attempts
- Dashboard shows "Seuraava generointi" column per client and "Ajastushistoria" card with last 30 scheduler runs
- API extended with healthStatus query filter on GET /sources, health-logs endpoint, and scheduler-runs endpoint

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend API routes** - `b9f1707` (feat)
2. **Task 2: Admin UI** - `5c0b678` (feat)

## Files Created/Modified
- `api/src/routes/sources.ts` - Added healthStatus query param filter on GET /sources, added GET /sources/:id/health-logs endpoint
- `api/src/routes/dashboard.ts` - Added GET /dashboard/scheduler-runs endpoint, extended GET /dashboard/stats with nextScheduledDate/scheduleFrequency/schedulePaused
- `api/src/services/sources.ts` - Added getSourceHealthLogs() function querying sourceHealthLogs table
- `web/src/app/(admin)/clients/[id]/page.tsx` - Added "Aikataulu" card with schedule config (frequency, day, biweekly week, pause/resume, next date, save)
- `web/src/app/(admin)/sources/page.tsx` - Added health status filter bar with Kaikki/Kunnossa/Varoitus/Virhe buttons
- `web/src/components/sources/source-table.tsx` - Added health dot, "Viimeisin haku" column, expandable health log rows with nested table
- `web/src/app/(admin)/page.tsx` - Added "Seuraava generointi" column to client summary, added "Ajastushistoria" card with scheduler runs table

## Decisions Made
- Health filtering done via API query param (compute in service, filter in route) for clean separation
- Expandable table rows for health logs keeps source list as a single page view
- Inline schedule editing (not dialog) for a more direct editing experience on client detail page

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - execution proceeded smoothly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 5 (Foundation Automation) complete: scheduling infrastructure + admin UI all in place
- Source health monitoring fully visible to admin with filtering and log history
- Client schedule management operational with pause/resume and next date display
- Ready for Phase 6 (Template Personalization) or Phase 7 (Feedback Analytics)

## Self-Check: PASSED

All 7 modified files exist on disk. Both task commits (b9f1707, 5c0b678) verified in git log. Must-have artifact keywords (scheduleFrequency, healthStatus, schedulerRuns, scheduler-runs) confirmed present in target files.

---
*Phase: 05-foundation-automation*
*Completed: 2026-03-03*
