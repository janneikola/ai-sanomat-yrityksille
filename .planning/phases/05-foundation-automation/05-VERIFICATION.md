---
phase: 05-foundation-automation
verified: 2026-03-03T12:00:00Z
status: passed
score: 9/9 must-haves verified
gaps: []
human_verification:
  - test: "Trigger a real digest generation via scheduler to confirm admin email is received"
    expected: "Admin receives an email at ADMIN_EMAIL with subject containing client name and 'katsausluonnos valmis'"
    why_human: "sendAdminNotification uses Resend API with a real ADMIN_EMAIL env var — cannot verify email delivery programmatically without live credentials"
  - test: "Let a news source fail 5 times in staging and confirm it gets auto-disabled"
    expected: "isActive is set to false in DB, admin receives email 'Uutislahde deaktivoitu'"
    why_human: "Requires real consecutive fetch failures accumulating across actual cron runs"
  - test: "Deploy to Railway and wait past 07:00 EET while ADMIN_EMAIL is set"
    expected: "Startup catch-up fires within 30s; if no scheduler run found for today, processScheduledDigests runs"
    why_human: "Startup catch-up depends on Railway deploy timing and live DB; cannot simulate programmatically"
---

# Phase 5: Foundation Automation Verification Report

**Phase Goal:** System generates draft digests automatically on each client's schedule and monitors source reliability without manual intervention
**Verified:** 2026-03-03
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Daily cron at 07:00 EET queries DB for clients due today and generates draft digests sequentially | VERIFIED | `api/src/scheduler.ts` line 26–43: `cron.schedule('0 7 * * *', ...)` calls `processScheduledDigests()` with `timezone: 'Europe/Helsinki'` |
| 2 | Clients have configurable schedule (weekly/bi-weekly/monthly) with preferred day of week | VERIFIED | `api/src/db/schema.ts` lines 44–47: `scheduleFrequency`, `scheduleDay`, `scheduleBiweeklyWeek`, `schedulePaused` columns on `clients` table |
| 3 | Duplicate digest generation is prevented by period-based deduplication (year + periodNumber) | VERIFIED | `api/src/services/scheduleService.ts` lines 143–158: queries issues by `clientId + periodNumber + year`, skips if found |
| 4 | Startup catch-up check (30s delay) detects and runs missed scheduled digests after Railway deploy | VERIFIED | `api/src/index.ts` lines 19–26: `setTimeout(checkAndRunMissedSchedule, 30_000)`; `checkAndRunMissedSchedule` in scheduleService.ts lines 238–257 |
| 5 | Each news source fetch attempt is logged with success/failure, item count, and error message | VERIFIED | `api/src/services/newsCollectorService.ts` lines 65–66, 76–77: `logFetchAttempt(source.id, true/false, items.length/0, error)` called in both success and catch branches |
| 6 | Sources with 5 consecutive failures are automatically disabled | VERIFIED | `api/src/services/sourceHealthService.ts` lines 88–111: `checkAutoDisable` sets `isActive = false` when `consecutiveFailures >= 5`; called from `newsCollectorService.ts` line 78 |
| 7 | Admin receives email notification when a draft digest is ready or when a source is auto-disabled | VERIFIED | `api/src/services/emailService.ts` lines 142–169: `sendAdminNotification` sends via Resend; called in `scheduleService.ts` line 199 (success) and `sourceHealthService.ts` line 106 (auto-disable) |
| 8 | News window filters items collected since client's last digest (first digest uses last 7 days) | VERIFIED | `api/src/services/scheduleService.ts` lines 161–175: queries latest sent/approved issue, uses `createdAt` as `sinceDate`; fallback is `Date.now() - 7 days` |
| 9 | Minimum 5 news items threshold before generating; if below, skip with retry next day | VERIFIED | `api/src/services/scheduleService.ts` lines 183–191: counts `availableNews.length < 5` → sends admin notification, increments skips, continues loop |

**Score: 9/9 truths verified**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/src/db/schema.ts` | Schedule columns on clients, health columns on newsSources, schedulerRuns table, sourceHealthLogs table, periodNumber on issues | VERIFIED | All confirmed: `scheduleFrequencyEnum` (line 32), schedule columns (lines 44–47), health columns (lines 75–78), `periodNumber` (line 104), `schedulerRuns` table (lines 130–139), `sourceHealthLogs` table (lines 142–149) |
| `api/src/services/scheduleService.ts` | Exports: isDueToday, getPeriodNumber, getNextScheduledDate, processScheduledDigests | VERIFIED | All four functions confirmed exported and substantive; 108 lines of logic + DB interactions |
| `api/src/services/sourceHealthService.ts` | Exports: computeHealthStatus, logFetchAttempt, checkAutoDisable | VERIFIED | All three functions confirmed; `computeHealthStatus` is pure function tested by 9 unit tests |
| `api/src/scheduler.ts` | Digest scheduling cron at 07:00 EET alongside existing 06:00 collection cron | VERIFIED | Two `cron.schedule` calls confirmed: `'0 6 * * *'` (line 7) and `'0 7 * * *'` (line 26), both with `timezone: 'Europe/Helsinki'` |
| `api/src/services/emailService.ts` | sendAdminNotification function | VERIFIED | Function at lines 142–169: uses `process.env.ADMIN_EMAIL`, sends via `sendSingleEmail`, strips HTML for plain text |
| `api/src/services/newsletterService.ts` | Sets periodNumber on new issues, supports windowed news queries | VERIFIED | Lines 128–136: reads `scheduleFrequency`, calls `getPeriodNumber()`, inserts with `periodNumber`; lines 88–102: optional `sinceDate` filter |
| `api/src/routes/clients.ts` | PUT /clients/:id/schedule endpoint | VERIFIED | Lines 89–114: full route with Zod schema validation, calls `updateClientSchedule` |
| `api/src/services/clients.ts` | updateClientSchedule function, nextScheduledDate computed | VERIFIED | Lines 72–98: updates schedule fields; all service functions compute `nextScheduledDate` via `getNextScheduledDate()` |
| `web/src/app/(admin)/clients/[id]/page.tsx` | Schedule configuration section with frequency, day, biweekly week selectors, pause/resume | VERIFIED | Lines 466–567: "Aikataulu" Card with Select dropdowns for frequency, day, conditional biweekly week; pause/resume toggle; next date display; Save button calling `PUT /api/admin/clients/${clientId}/schedule` |
| `web/src/components/sources/source-table.tsx` | Health status dots and filter controls | VERIFIED | Lines 31–35: `HEALTH_COLORS` map; lines 143–153: `Circle` icon with health color class; lines 176–186: "Viimeisin haku" column; lines 73–104: expandable health log rows |
| `web/src/app/(admin)/page.tsx` | Scheduler run log section and nextScheduledDate column on dashboard | VERIFIED | Lines 209–255: "Ajastushistoria" Card with Table; lines 178–199: "Seuraava generointi" column rendering `formatNextScheduled()` |
| `api/src/routes/sources.ts` | Health data in source list response, health log endpoint, filter by health status | VERIFIED | Lines 20–21: `healthStatus` query param; lines 29–34: filter applied; lines 98–125: `GET /sources/:id/health-logs` route |
| `api/src/routes/dashboard.ts` | Scheduler run log endpoint, nextScheduledDate per client | VERIFIED | Lines 108–137: `GET /dashboard/scheduler-runs` returns last 30 runs; lines 79–90: computes `nextScheduledDate` per client |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `api/src/scheduler.ts` | `api/src/services/scheduleService.ts` | import processScheduledDigests | WIRED | Line 3: `import { processScheduledDigests } from './services/scheduleService.js'`; used at line 31 inside cron callback |
| `api/src/services/scheduleService.ts` | `api/src/services/newsletterService.ts` | calls generateClientDigest(clientId, sinceDate) | WIRED | Lines 195–196: dynamic import `const { generateClientDigest } = await import('./newsletterService.js')` then called with `clientId, sinceDate` |
| `api/src/services/newsCollectorService.ts` | `api/src/services/sourceHealthService.ts` | wraps per-source fetch with health tracking | WIRED | Lines 7–11: imports `logFetchAttempt, updateSourceHealth, checkAutoDisable, checkHealthTransitionNotification`; called at lines 65–66 (success) and 76–79 (failure) |
| `api/src/index.ts` | `api/src/services/scheduleService.ts` | 30s delayed startup catch-up | WIRED | Line 4: `import { checkAndRunMissedSchedule } from './services/scheduleService.js'`; used at line 22 inside `setTimeout` callback |
| `web/src/app/(admin)/clients/[id]/page.tsx` | `/api/admin/clients/:id/schedule` | apiFetch PUT | WIRED | Lines 213–225: `apiFetch<ClientResponse>('/api/admin/clients/${clientId}/schedule', { method: 'PUT', body: JSON.stringify({...}) })` |
| `web/src/app/(admin)/sources/page.tsx` | `/api/admin/sources` | apiFetch GET with healthStatus filter | WIRED | Lines 34–37: conditional URL `?healthStatus=${healthFilter}` when filter is not 'all'; result passed to `SourceTable` |
| `web/src/app/(admin)/page.tsx` | `/api/admin/dashboard/scheduler-runs` | apiFetch GET | WIRED | Lines 93–99: `apiFetch<SchedulerRun[]>('/api/admin/dashboard/scheduler-runs')`; stored in `schedulerRuns` state, rendered at lines 235–249 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SCHED-01 | 05-01 | System auto-generates draft digests on each client's configured schedule (weekly/bi-weekly/monthly) | SATISFIED | `processScheduledDigests()` in `scheduleService.ts` queries active unpaused clients, calls `isDueToday()`, generates sequentially |
| SCHED-02 | 05-01, 05-02 | Admin can configure per-client send frequency (weekly, bi-weekly, monthly) and preferred day/time | SATISFIED | `PUT /clients/:id/schedule` API + "Aikataulu" card UI with Select dropdowns in `clients/[id]/page.tsx` |
| SCHED-03 | 05-01 | Scheduling uses database-driven state (survives Railway deploys), not in-memory cron | SATISFIED | Schedule config stored in DB (`scheduleFrequency`, `scheduleDay`, etc. on `clients` table); startup catch-up reads from `schedulerRuns` table |
| SCHED-04 | 05-01 | System prevents duplicate generation if digest already exists for current period | SATISFIED | `scheduleService.ts` lines 143–158: checks `clientId + periodNumber + year` uniqueness before generating |
| HEALTH-01 | 05-01, 05-02 | System tracks per-source health metrics (last success, consecutive failures, items per fetch) | SATISFIED | `consecutiveFailures`, `lastSuccessAt`, `lastItemCount`, `lastItemsAt` columns on `newsSources`; logged via `logFetchAttempt` + `updateSourceHealth` |
| HEALTH-02 | 05-01, 05-02 | Stale and failing sources are detected automatically with configurable thresholds | SATISFIED | `computeHealthStatus()` detects: inactive → red, failures >= 4 → red, failures >= 2 → yellow, stale (0 items for 7+ days) → yellow |
| HEALTH-03 | 05-02 | Admin panel shows source health status (green/yellow/red) on source list | SATISFIED | `source-table.tsx` Circle icon with `HEALTH_COLORS` based on `source.healthStatus`; `sources/page.tsx` filter bar with Kaikki/Kunnossa/Varoitus/Virhe |
| HEALTH-04 | 05-01 | Persistently failing sources are auto-disabled with admin notification | SATISFIED | `checkAutoDisable()` at >= 5 consecutive failures: sets `isActive = false`, calls `sendAdminNotification` with source name |

**All 8 requirement IDs from PLAN frontmatter are accounted for. No orphaned requirements.**

REQUIREMENTS.md traceability table confirms SCHED-01 through SCHED-04 and HEALTH-01 through HEALTH-04 all mapped to Phase 5 with status "Complete".

---

### Anti-Patterns Found

No blockers or stubs detected. Checked all 15 modified files for `TODO`, `FIXME`, `PLACEHOLDER`, empty returns, and console.log-only handlers.

One notable pattern that is intentional (not a stub): `sendAdminNotification` silently catches errors (does not rethrow) — this is a documented design decision to prevent admin notification failures from blocking the scheduling pipeline.

---

### Human Verification Required

#### 1. Admin email delivery on digest generation

**Test:** Configure `ADMIN_EMAIL` env var, unpause a client, trigger `processScheduledDigests()` via a test cron invocation or manual API call
**Expected:** Admin receives email with subject "AI-Sanomat: {client name} - katsausluonnos valmis" and a link to the issue
**Why human:** Requires live Resend API credentials and an actual ADMIN_EMAIL mailbox; email delivery cannot be verified programmatically in this repo

#### 2. Source auto-disable after 5 consecutive failures

**Test:** Configure a source with an unreachable URL, let the 06:00 collection cron run 5 times
**Expected:** After the 5th failure, `isActive` becomes `false` in DB and admin receives email "Uutislahde deaktivoitu - {source name}"
**Why human:** Requires accumulating real consecutive failures across multiple cron runs; cannot simulate in unit tests (DB calls are live)

#### 3. Railway deploy startup catch-up

**Test:** Deploy to Railway after 07:00 EET with at least one active unpaused client with >= 5 news items
**Expected:** Within 30 seconds of startup, `checkAndRunMissedSchedule` detects no `schedulerRuns` entry for today and calls `processScheduledDigests()`
**Why human:** Depends on Railway deploy timing, live DB state, and real cron run history

---

### Gaps Summary

No gaps found. All 9 observable truths are verified. All 14 required artifacts exist, are substantive, and are wired into the system. All 7 key links are confirmed. All 8 requirement IDs (SCHED-01, SCHED-02, SCHED-03, SCHED-04, HEALTH-01, HEALTH-02, HEALTH-03, HEALTH-04) are satisfied with evidence.

TypeScript compilation: clean (`npx tsc --noEmit` exits with no output).
Unit tests: 25/25 passing (16 schedule logic + 9 health status tests).
Next.js build: clean with no errors or warnings.

The phase goal — "System generates draft digests automatically on each client's schedule and monitors source reliability without manual intervention" — is achieved. The automation pipeline is fully wired from cron trigger through DB-driven schedule evaluation, deduplication, news windowing, digest generation, and admin notification, with source health tracking on every fetch attempt.

---

_Verified: 2026-03-03_
_Verifier: Claude (gsd-verifier)_
