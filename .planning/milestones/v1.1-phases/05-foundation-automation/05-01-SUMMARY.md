---
phase: 05-foundation-automation
plan: 01
subsystem: api
tags: [drizzle, node-cron, scheduling, health-tracking, admin-notifications, resend]

# Dependency graph
requires:
  - phase: 03-email-delivery-send-workflow
    provides: emailService with sendSingleEmail, resendClient integration
  - phase: 02-content-pipeline
    provides: newsletterService with generateClientDigest, newsCollectorService
provides:
  - scheduleService with isDueToday, getPeriodNumber, getNextScheduledDate, processScheduledDigests
  - sourceHealthService with computeHealthStatus, logFetchAttempt, updateSourceHealth, checkAutoDisable
  - sendAdminNotification for automated admin email alerts
  - schedule columns on clients table (frequency, day, biweeklyWeek, paused)
  - health columns on newsSources table (consecutiveFailures, lastSuccessAt, lastItemCount, lastItemsAt)
  - periodNumber on issues table for deduplication
  - schedulerRuns and sourceHealthLogs tables
  - PUT /clients/:id/schedule endpoint
  - startup catch-up for Railway deploy resilience
affects: [05-02, 06-template-personalization, 07-feedback-analytics]

# Tech tracking
tech-stack:
  added: []
  patterns: [pure-function-scheduling-logic, health-status-computation, admin-notification-pattern, startup-catch-up-pattern]

key-files:
  created:
    - api/src/services/scheduleService.ts
    - api/src/services/scheduleService.test.ts
    - api/src/services/sourceHealthService.ts
    - api/src/services/sourceHealthService.test.ts
  modified:
    - api/src/db/schema.ts
    - api/src/services/emailService.ts
    - api/src/services/newsletterService.ts
    - api/src/services/newsCollectorService.ts
    - api/src/services/clients.ts
    - api/src/services/sources.ts
    - api/src/routes/clients.ts
    - api/src/scheduler.ts
    - api/src/index.ts
    - packages/shared/src/schemas/client.ts
    - packages/shared/src/schemas/source.ts

key-decisions:
  - "Pure functions for isDueToday/getPeriodNumber/computeHealthStatus enable easy unit testing without DB"
  - "Dynamic import for generateClientDigest in processScheduledDigests avoids circular dependency"
  - "Admin notification silently catches errors to never block scheduling pipeline"
  - "Source health columns co-located on newsSources table (not separate join) for query simplicity"

patterns-established:
  - "Computed fields pattern: healthStatus and nextScheduledDate calculated in service layer, not stored"
  - "Health tracking wrapper: every source fetch logs attempt and updates aggregates"
  - "Startup catch-up: 30s delayed check after server start for Railway deploy resilience"

requirements-completed: [SCHED-01, SCHED-02, SCHED-03, SCHED-04, HEALTH-01, HEALTH-02, HEALTH-04]

# Metrics
duration: 8min
completed: 2026-03-03
---

# Phase 5 Plan 1: Foundation Automation Summary

**Database-driven digest scheduling with per-client frequency/day config, source health tracking with auto-disable at 5 failures, and admin notification emails via Resend**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-03T10:30:09Z
- **Completed:** 2026-03-03T10:38:15Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Database-driven scheduling: clients have configurable frequency (weekly/biweekly/monthly), preferred day, and pause control
- Source health tracking wraps every fetch with logging, auto-disables at 5 consecutive failures, notifies admin at yellow/red thresholds
- Startup catch-up detects missed scheduler runs after Railway deploys and runs them automatically
- Period-based deduplication prevents duplicate digest generation (year + periodNumber)
- 25 unit tests pass covering all scheduling logic and health status computation

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): Failing tests** - `419d7d4` (test)
2. **Task 1 (TDD GREEN): Schema, services, shared types** - `0bd21f0` (feat)
3. **Task 2: Scheduler cron, catch-up, health tracking** - `1c499dc` (feat)

## Files Created/Modified
- `api/src/db/schema.ts` - Added scheduleFrequencyEnum, schedule columns on clients, health columns on newsSources, periodNumber on issues, schedulerRuns and sourceHealthLogs tables
- `api/src/services/scheduleService.ts` - NEW: isDueToday, getPeriodNumber, getNextScheduledDate, processScheduledDigests, checkAndRunMissedSchedule
- `api/src/services/scheduleService.test.ts` - NEW: 16 unit tests for scheduling logic
- `api/src/services/sourceHealthService.ts` - NEW: computeHealthStatus, logFetchAttempt, updateSourceHealth, checkAutoDisable, checkHealthTransitionNotification
- `api/src/services/sourceHealthService.test.ts` - NEW: 9 unit tests for health computation
- `api/src/services/emailService.ts` - Added sendAdminNotification function
- `api/src/services/newsletterService.ts` - Extracted getISOWeekNumber, added sinceDate param, sets periodNumber
- `api/src/services/newsCollectorService.ts` - Wrapped per-source fetch with health tracking
- `api/src/services/clients.ts` - Added computed nextScheduledDate, updateClientSchedule function
- `api/src/services/sources.ts` - Added computed healthStatus to all source responses
- `api/src/routes/clients.ts` - Added PUT /clients/:id/schedule endpoint
- `api/src/scheduler.ts` - Added 07:00 EET digest cron alongside existing 06:00 collection
- `api/src/index.ts` - Added 30s delayed startup catch-up
- `packages/shared/src/schemas/client.ts` - Added schedule fields to updateClientSchema and clientResponseSchema
- `packages/shared/src/schemas/source.ts` - Added health fields to sourceResponseSchema

## Decisions Made
- Pure functions for isDueToday/getPeriodNumber/computeHealthStatus enable unit testing without database
- Dynamic import for generateClientDigest in processScheduledDigests avoids circular dependency
- Admin notification errors are silently caught to never block the scheduling pipeline
- Source health columns stored directly on newsSources (not separate table) for query simplicity
- Computed fields (healthStatus, nextScheduledDate) calculated in service layer, not persisted

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed TypeScript errors in source and client routes**
- **Found during:** Task 1 (schema + service implementation)
- **Issue:** Adding health/schedule fields to shared response schemas caused TS errors in existing routes that return DB rows without computed fields
- **Fix:** Updated sources.ts service to add computed `healthStatus` via `computeHealthStatus()`, updated clients.ts to add computed `nextScheduledDate` via `getNextScheduledDate()`, including createClient
- **Files modified:** api/src/services/sources.ts, api/src/services/clients.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** 0bd21f0 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required fix to make TypeScript compile after schema changes. No scope creep.

## Issues Encountered
None - execution proceeded smoothly.

## User Setup Required

Set `ADMIN_EMAIL` environment variable to the admin's email address for receiving automated notifications (draft ready, generation failure, source auto-disable). Defaults to `admin@aisanomat.fi` if not set.

## Next Phase Readiness
- Scheduling infrastructure complete, ready for plan 05-02 if applicable
- Client schedule management endpoint available for frontend integration
- Source health data available in API responses for dashboard display

---
*Phase: 05-foundation-automation*
*Completed: 2026-03-03*
