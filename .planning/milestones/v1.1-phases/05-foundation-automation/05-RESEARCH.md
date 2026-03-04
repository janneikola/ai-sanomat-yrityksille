# Phase 5: Foundation Automation - Research

**Researched:** 2026-03-03
**Domain:** Cron scheduling, database-driven state machines, source health monitoring
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Three fixed frequency options: weekly, bi-weekly, monthly
- Preferred day: day of week only (no time config) -- daily cron runs once in the morning
- Default for new clients: Weekly, Monday
- Bi-weekly: based on even/odd ISO week number (admin picks which)
- Monthly: first occurrence of the preferred weekday each month
- Separate pause/resume toggle -- schedule config preserved when paused
- Admin dashboard shows next scheduled generation date per client on the client list
- Schedule configured on the client detail page (not a separate page)
- Auto-generated digests land in 'draft' status -- admin must approve before sending
- Email notification sent to admin when a draft is ready, with direct link to preview page
- On generation failure: create issue with status 'failed' + email admin. No auto-retry
- Minimum 5 news items threshold before generating -- skip if fewer
- If below threshold: email admin, retry next day (not next period)
- News window: only items collected since client's last digest (avoids repeating stories)
- First digest for a new client: use last 7 days of collected news
- Period identification: year + period number (weekly: week number, bi-weekly: bi-week 1-26, monthly: month 1-12)
- Multiple due clients processed sequentially (not parallel) -- respects API rate limits
- Manual generation trigger (existing button) remains alongside auto-schedule
- Green/yellow/red color dot on the existing source list, next to source name
- Additional info: last successful fetch timestamp shown alongside dot
- Thresholds based on consecutive failures: Green 0-1, Yellow 2-3, Red 4+
- Stale detection: source fetches OK but 0 items for 7+ days = yellow warning
- Source list filterable by health status: All / Healthy / Warning / Failing
- Source detail page shows recent fetch log (last 10-20 attempts with status, items count, errors)
- 5 consecutive failures triggers auto-disable (source set to isActive=false)
- Email sent per event: when source turns yellow, turns red, or gets auto-disabled
- Auto-disabled sources require manual re-enable by admin (no auto-recovery)
- Notification emails sent from same sender address as newsletters (via Resend)
- On server startup: check if today's scheduled run was missed, execute if so (handles Railway deploys)
- 30-second delay after boot before catch-up check (lets DB initialize)
- Database timestamp tracks last scheduler run to prevent double execution
- Database migration applies default schedule (Weekly/Monday) to all existing active clients
- All migrated clients start with schedule paused -- admin explicitly unpauses when ready
- Scheduler runs logged to a database table: timestamp, clients processed, successes, failures, skips
- Last 30 runs displayed as a section on the admin dashboard

### Claude's Discretion
- Exact notification email content/formatting (simple functional emails)
- Database table structure for scheduler_runs and source_health_logs
- Run log table column design
- How to handle edge cases in period number calculation
- Exact cron schedule time (e.g. 06:00 or 07:00 EET)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCHED-01 | System auto-generates draft digests on each client's configured schedule (weekly/bi-weekly/monthly) | Daily cron checks DB for due clients, calls existing `generateClientDigest()`, period-based dedup prevents duplicates |
| SCHED-02 | Admin can configure per-client send frequency (weekly, bi-weekly, monthly) and preferred day/time | New columns on `clients` table (scheduleFrequency, scheduleDay, scheduleBiweeklyWeek, schedulePaused), schedule config UI on client detail page |
| SCHED-03 | Scheduling uses database-driven state (survives Railway deploys), not in-memory cron | Single daily cron triggers DB query for due clients; `scheduler_runs` table tracks last run timestamp; startup catch-up check |
| SCHED-04 | System prevents duplicate generation if digest already exists for current period | Period identification via year + periodNumber on `issues` table; check before generating; `onConflictDoNothing` pattern |
| HEALTH-01 | System tracks per-source health metrics (last success, consecutive failures, items per fetch) | New columns on `newsSources` (consecutiveFailures, lastSuccessAt, lastItemCount); `source_health_logs` table for history |
| HEALTH-02 | Stale and failing sources detected automatically with configurable thresholds | Consecutive failure thresholds (0-1 green, 2-3 yellow, 4+ red); stale = 0 items for 7+ days despite successful fetches |
| HEALTH-03 | Admin panel shows source health status (green/yellow/red) on source list | Computed health status from DB columns returned in source API response; colored dot in source table UI |
| HEALTH-04 | Persistently failing sources are auto-disabled with admin notification | 5 consecutive failures triggers `isActive=false`; email via existing Resend integration |
</phase_requirements>

## Summary

Phase 5 adds two capabilities to the existing system: (1) automated digest generation on per-client schedules, and (2) source health monitoring with auto-disable. Both build directly on existing infrastructure -- the `node-cron` scheduler in `scheduler.ts`, the `generateClientDigest()` pipeline in `newsletterService.ts`, the `collectAllNews()` loop in `newsCollectorService.ts`, and the Resend email integration.

The scheduling system is database-driven by design: a single daily cron job queries the `clients` table to find who is due today, generates their digests sequentially, and logs each run. The `issues` table already has `weekNumber` and `year` columns which need to be generalized to `periodNumber` + `year` to support bi-weekly (1-26) and monthly (1-12) frequencies alongside weekly (1-53). Railway's deploy-on-push model means the process restarts frequently, so a startup catch-up check ensures no scheduled runs are missed.

Source health tracking wraps the existing `collectAllNews()` per-source loop. Each fetch attempt is logged to a `source_health_logs` table, and aggregate health columns on `newsSources` (consecutiveFailures, lastSuccessAt, lastItemCount) enable fast health status computation without querying the log table on every request.

**Primary recommendation:** Extend existing tables with new columns (no new frameworks needed), add two new tables (`scheduler_runs`, `source_health_logs`), generalize `issues.weekNumber` to `issues.periodNumber`, and wrap existing service functions with scheduling and health tracking logic.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node-cron | ^4.2.1 | Daily cron scheduling | Already in use in `scheduler.ts`; lightweight, zero-dep, timezone support via `timezone` option |
| drizzle-orm | ^0.45.0 | ORM for schema + queries | Already in use; `pgTable`, `pgEnum`, typed queries |
| drizzle-kit | ^0.31.0 | Schema push to DB | Already in use; `drizzle-kit push` for dev speed |
| resend | ^6.9.3 | Admin notification emails | Already in use for newsletter delivery; `sendSingleEmail()` exists |
| zod | ^3.25.0 | Request/response validation | Already in use in shared schemas and Fastify routes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.484.0 | Health status icons | Already in use in admin UI; use `Circle` icon with color classes for health dots |
| sonner | ^2.0.7 | Toast notifications | Already in use in admin UI for success/error feedback |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node-cron daily check | Per-client cron jobs | Per-client crons don't survive Railway redeploys; single daily cron + DB query is resilient |
| node-cron | bull/bullmq job queue | Overkill for sequential daily processing; requires Redis; project already uses node-cron |
| Raw ISO week calc | date-fns `getISOWeek()` | Adding date-fns for one function is unnecessary; existing `getWeekNumber()` in newsletterService.ts works |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
api/src/
├── db/schema.ts                  # ADD: schedule columns on clients, health columns on newsSources,
│                                 #      new scheduler_runs + source_health_logs tables,
│                                 #      generalize issues.weekNumber -> periodNumber,
│                                 #      new scheduleFrequencyEnum, scheduleDayEnum
├── scheduler.ts                  # EXTEND: add digest scheduling cron alongside news collection cron,
│                                 #         add startup catch-up function
├── services/
│   ├── newsletterService.ts      # MODIFY: news window filtering (since last digest), period number calc,
│   │                             #         minimum 5-item threshold check
│   ├── newsCollectorService.ts   # WRAP: per-source health tracking around existing fetch loop
│   ├── scheduleService.ts        # NEW: isDueToday(), getNextScheduledDate(), getPeriodNumber(),
│   │                             #      processScheduledDigests(), logSchedulerRun()
│   ├── sourceHealthService.ts    # NEW: computeHealthStatus(), logFetchAttempt(), checkAutoDisable(),
│   │                             #      getSourceHealthLogs()
│   └── emailService.ts           # EXTEND: add admin notification email functions (draft ready, source alert)
├── routes/
│   ├── clients.ts                # EXTEND: schedule config endpoints (PUT schedule on existing client route)
│   ├── sources.ts                # EXTEND: health data in list response, health log endpoint, filter by status
│   ├── dashboard.ts              # EXTEND: add scheduler run log endpoint, next-scheduled-date per client
│   └── scheduler.ts              # NEW (optional): manual trigger/status endpoint
├── index.ts                      # EXTEND: add 30s delayed startup catch-up check
packages/shared/src/
├── schemas/client.ts             # EXTEND: add schedule fields to response schema
├── schemas/source.ts             # EXTEND: add health fields to response schema
└── types/index.ts                # EXTEND: export new types
web/src/
├── app/(admin)/clients/[id]/page.tsx  # EXTEND: schedule config section
├── app/(admin)/sources/page.tsx       # EXTEND: health dots, filter by status
├── app/(admin)/page.tsx               # EXTEND: scheduler run log section
```

### Pattern 1: Database-Driven Schedule Check
**What:** Single daily cron queries DB for clients due today, processes sequentially
**When to use:** When scheduling must survive process restarts (Railway deploys)
**Example:**
```typescript
// api/src/services/scheduleService.ts
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clients, issues, schedulerRuns } from '../db/schema.js';

export function isDueToday(
  frequency: 'weekly' | 'biweekly' | 'monthly',
  preferredDay: number, // 0=Sun, 1=Mon, ..., 6=Sat
  biweeklyWeek: 'even' | 'odd' | null,
  today: Date = new Date()
): boolean {
  const dayOfWeek = today.getDay();
  if (dayOfWeek !== preferredDay) return false;

  if (frequency === 'weekly') return true;

  if (frequency === 'biweekly') {
    const isoWeek = getISOWeekNumber(today);
    const isEven = isoWeek % 2 === 0;
    return biweeklyWeek === 'even' ? isEven : !isEven;
  }

  if (frequency === 'monthly') {
    // First occurrence of preferred weekday in month
    return today.getDate() <= 7;
  }

  return false;
}

export function getPeriodNumber(
  frequency: 'weekly' | 'biweekly' | 'monthly',
  date: Date = new Date()
): number {
  if (frequency === 'weekly') return getISOWeekNumber(date);
  if (frequency === 'biweekly') return Math.ceil(getISOWeekNumber(date) / 2);
  if (frequency === 'monthly') return date.getMonth() + 1;
  return 0;
}
```

### Pattern 2: Health Tracking Wrapper
**What:** Wrap existing per-source fetch loop with health logging and auto-disable
**When to use:** Adding observability to existing collection without restructuring
**Example:**
```typescript
// Inside the existing collectAllNews() for-loop, wrap each source fetch:
async function collectWithHealthTracking(source: NewsSource) {
  const startTime = Date.now();
  try {
    const items = await fetchSourceItems(source);
    const itemCount = items.length;

    // Log success
    await logFetchAttempt(source.id, true, itemCount, null);

    // Reset consecutive failures, update lastSuccessAt
    await db.update(newsSources).set({
      consecutiveFailures: 0,
      lastSuccessAt: new Date(),
      lastItemCount: itemCount,
    }).where(eq(newsSources.id, source.id));

    // Check stale: success but 0 items for 7+ days
    if (itemCount === 0) {
      await checkStaleWarning(source);
    }

    return items;
  } catch (error) {
    // Log failure
    await logFetchAttempt(source.id, false, 0, String(error));

    // Increment consecutive failures
    const newFailures = (source.consecutiveFailures ?? 0) + 1;
    await db.update(newsSources).set({
      consecutiveFailures: newFailures,
    }).where(eq(newsSources.id, source.id));

    // Check auto-disable threshold (5 consecutive)
    if (newFailures >= 5) {
      await autoDisableSource(source);
    }
    // Send notification at threshold transitions (2=yellow, 4=red)
    await checkHealthTransitionNotification(source, newFailures);

    throw error;
  }
}
```

### Pattern 3: Period-Based Deduplication
**What:** Generalize `weekNumber` to `periodNumber` to support all frequencies
**When to use:** Preventing duplicate digests regardless of schedule frequency
**Example:**
```typescript
// Before generating, check if digest already exists for this period
const periodNumber = getPeriodNumber(client.scheduleFrequency);
const year = new Date().getFullYear();

const existing = await db.select().from(issues)
  .where(and(
    eq(issues.clientId, client.id),
    eq(issues.periodNumber, periodNumber),
    eq(issues.year, year),
  ));

if (existing.length > 0) {
  console.log(`Digest already exists for client ${client.id}, period ${periodNumber}/${year}`);
  return; // Skip -- dedup
}
```

### Pattern 4: Startup Catch-Up Check
**What:** After 30s boot delay, check if today's scheduled run was missed
**When to use:** Railway redeploys that kill the process mid-schedule
**Example:**
```typescript
// api/src/index.ts
async function start() {
  const app = await buildApp();
  await app.listen({ port, host: '::' });
  startScheduler();

  // Catch-up check after 30s delay (lets DB initialize)
  setTimeout(async () => {
    try {
      await checkAndRunMissedSchedule();
    } catch (error) {
      console.error('Startup catch-up check failed:', error);
    }
  }, 30_000);
}

async function checkAndRunMissedSchedule() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [lastRun] = await db.select()
    .from(schedulerRuns)
    .orderBy(desc(schedulerRuns.startedAt))
    .limit(1);

  if (!lastRun || new Date(lastRun.startedAt) < today) {
    console.log('Missed schedule detected, running catch-up...');
    await processScheduledDigests();
  }
}
```

### Anti-Patterns to Avoid
- **In-memory schedule state:** Never store schedule timing in process memory. Railway deploys kill the process; all state must be in PostgreSQL.
- **Per-client cron jobs:** Do not create individual `cron.schedule()` calls per client. A single daily cron that queries the DB is simpler and survives restarts.
- **Parallel digest generation:** Do not use `Promise.all()` for multiple clients. Sequential processing respects Claude API rate limits.
- **Silent health failures:** Never swallow fetch errors without logging them. Every fetch attempt must be recorded for health tracking.
- **Computed-only health status:** Store `consecutiveFailures` and `lastSuccessAt` on the `newsSources` row for fast reads. Don't compute from `source_health_logs` on every API call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron scheduling | Custom setTimeout loops | node-cron `cron.schedule()` | Already in use; handles timezone, missed-fire edge cases |
| Email sending | Raw SMTP/fetch | Resend `sendSingleEmail()` | Already integrated; handles deliverability, auth |
| ISO week number | New implementation | Existing `getWeekNumber()` in newsletterService.ts | Already tested, correct ISO 8601 implementation |
| DB schema changes | Raw SQL ALTER TABLE | `drizzle-kit push` | Project convention; type-safe, auto-generates SQL |
| Next scheduled date calc | Complex date math | Simple weekday-forward loop | Max 7 iterations to find next occurrence of a weekday |

**Key insight:** This phase is primarily about wiring existing components together with new database state. No new external services or complex algorithms are needed. The `generateClientDigest()` function already handles the full generation pipeline -- the scheduler just needs to call it for the right clients at the right time.

## Common Pitfalls

### Pitfall 1: Railway Process Restarts
**What goes wrong:** Cron jobs scheduled in memory are lost when Railway redeploys the service.
**Why it happens:** Railway rebuilds and restarts the container on every push; node-cron state is in-memory only.
**How to avoid:** Database-driven scheduling. The cron just triggers a DB query; all schedule state lives in PostgreSQL. Add startup catch-up check with 30s delay.
**Warning signs:** Digests stop generating after deploys; scheduler_runs table shows gaps.

### Pitfall 2: Duplicate Digest Generation
**What goes wrong:** Two digests generated for the same client in the same period.
**Why it happens:** Race condition if scheduler runs twice (catch-up + cron overlap), or manual trigger during scheduled run.
**How to avoid:** Check for existing issue with matching `clientId + periodNumber + year` before generating. The `scheduler_runs` table with `startedAt` timestamp prevents double runs on the same day.
**Warning signs:** Multiple draft digests for same client in same week.

### Pitfall 3: Generalizing weekNumber to periodNumber
**What goes wrong:** Existing data has `weekNumber` values; renaming the column breaks queries that reference it.
**Why it happens:** `drizzle-kit push` may drop and recreate the column instead of renaming.
**How to avoid:** Add `periodNumber` as a new column, migrate data from `weekNumber`, then drop `weekNumber` after verification. Or simply rename in schema and let `drizzle-kit push` handle the ALTER. Test with existing data first.
**Warning signs:** Null `periodNumber` values on existing issues; broken digest list in admin UI.

### Pitfall 4: News Window Calculation
**What goes wrong:** Auto-generated digest includes news items already covered in previous digest, or misses recent items.
**Why it happens:** Using a fixed time window (e.g., "last 7 days") instead of "since last digest".
**How to avoid:** Query for the most recent `sent` or `approved` issue for the client, use its `createdAt` as the lower bound for `newsItems.collectedAt`. For first-ever digest, fall back to 7 days.
**Warning signs:** Repeated stories across consecutive digests; empty digests despite available news.

### Pitfall 5: Health Status vs. Stale Detection Conflict
**What goes wrong:** A source that fetches successfully but returns 0 items shows as "green" (0 consecutive failures) even though it's stale.
**Why it happens:** Stale detection is a separate concern from failure tracking. `consecutiveFailures = 0` means "no errors", not "producing content".
**How to avoid:** Track `lastItemCount` and `lastSuccessAt` separately. Health computation checks both: if `consecutiveFailures >= 4` -> red; else if `consecutiveFailures >= 2` -> yellow; else if `lastItemCount === 0 AND daysSince(lastSuccessAt) >= 7` -> yellow (stale); else green.
**Warning signs:** Sources showing green but contributing no news items to digests.

### Pitfall 6: Bi-weekly Period Number Edge Cases
**What goes wrong:** ISO week 53 exists in some years, causing bi-week number 27 which is outside expected 1-26 range.
**Why it happens:** ISO 8601 allows week 53 when the year starts or ends on a Thursday.
**How to avoid:** Cap bi-week number: `Math.min(Math.ceil(isoWeek / 2), 26)`. Or treat week 53 as belonging to bi-week 26. Document this edge case.
**Warning signs:** Dedup check fails for year-end digests; period number exceeds expected range.

## Code Examples

### Database Schema Additions
```typescript
// api/src/db/schema.ts -- new enums and columns

// New enums
export const scheduleFrequencyEnum = pgEnum('schedule_frequency', ['weekly', 'biweekly', 'monthly']);
export const scheduleDayEnum = pgEnum('schedule_day', ['0', '1', '2', '3', '4', '5', '6']);
// 0=Sunday, 1=Monday, ..., 6=Saturday (matches JS Date.getDay())

// Add to clients table:
// scheduleFrequency: scheduleFrequencyEnum('schedule_frequency').notNull().default('weekly'),
// scheduleDay: scheduleDayEnum('schedule_day').notNull().default('1'), // Monday
// scheduleBiweeklyWeek: varchar('schedule_biweekly_week', { length: 4 }), // 'even' | 'odd' | null
// schedulePaused: boolean('schedule_paused').notNull().default(true),

// Add to newsSources table:
// consecutiveFailures: integer('consecutive_failures').notNull().default(0),
// lastSuccessAt: timestamp('last_success_at'),
// lastItemCount: integer('last_item_count'),

// Rename issues.weekNumber -> issues.periodNumber (or add new column)
// periodNumber: integer('period_number').notNull(),

// New table: scheduler_runs
export const schedulerRuns = pgTable('scheduler_runs', {
  id: serial('id').primaryKey(),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  clientsProcessed: integer('clients_processed').notNull().default(0),
  successes: integer('successes').notNull().default(0),
  failures: integer('failures').notNull().default(0),
  skips: integer('skips').notNull().default(0),
  notes: text('notes'), // JSON array of per-client results
});

// New table: source_health_logs
export const sourceHealthLogs = pgTable('source_health_logs', {
  id: serial('id').primaryKey(),
  sourceId: integer('source_id').notNull().references(() => newsSources.id),
  success: boolean('success').notNull(),
  itemCount: integer('item_count').notNull().default(0),
  errorMessage: text('error_message'),
  fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
});
```

### Admin Notification Email
```typescript
// api/src/services/emailService.ts -- add notification functions

export async function sendAdminNotification(subject: string, body: string) {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@aisanomat.fi';
  await sendSingleEmail({
    from: 'AI-Sanomat <noreply@mail.aisanomat.fi>',
    to: adminEmail,
    subject,
    html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">${subject}</h2>
      <div style="color: #333; line-height: 1.6;">${body}</div>
      <hr style="margin-top: 24px; border: none; border-top: 1px solid #eee;" />
      <p style="color: #999; font-size: 12px;">AI-Sanomat automaattinen ilmoitus</p>
    </div>`,
    text: `${subject}\n\n${body.replace(/<[^>]*>/g, '')}\n\n---\nAI-Sanomat automaattinen ilmoitus`,
  });
}

// Usage examples:
// Draft ready: sendAdminNotification('Uusi katsausluonnos: ClientName', '<p>Katsaus viikolle 10/2026...</p><a href="...">Esikatsele</a>')
// Source warning: sendAdminNotification('Uutislahde varoitus: SourceName', '<p>Lahde on epaonnistunut 3 kertaa perakkain...</p>')
// Source disabled: sendAdminNotification('Uutislahde poistettu kaytosta: SourceName', '<p>5 perakkkaista epaonnistumista...</p>')
```

### Health Status Computation
```typescript
// api/src/services/sourceHealthService.ts

export type HealthStatus = 'green' | 'yellow' | 'red';

export function computeHealthStatus(source: {
  consecutiveFailures: number;
  lastSuccessAt: Date | null;
  lastItemCount: number | null;
  isActive: boolean;
}): HealthStatus {
  if (!source.isActive) return 'red';
  if (source.consecutiveFailures >= 4) return 'red';
  if (source.consecutiveFailures >= 2) return 'yellow';

  // Stale detection: fetches OK but 0 items for 7+ days
  if (
    source.lastSuccessAt &&
    source.lastItemCount === 0
  ) {
    const daysSinceSuccess = Math.floor(
      (Date.now() - new Date(source.lastSuccessAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceSuccess >= 7) return 'yellow';
  }

  return 'green';
}
```

### Next Scheduled Date Calculation
```typescript
// api/src/services/scheduleService.ts

export function getNextScheduledDate(
  frequency: 'weekly' | 'biweekly' | 'monthly',
  preferredDay: number, // 0-6
  biweeklyWeek: 'even' | 'odd' | null,
  fromDate: Date = new Date()
): Date {
  const result = new Date(fromDate);
  result.setHours(6, 0, 0, 0); // Morning run time

  // Advance to next occurrence of preferred day
  for (let i = 1; i <= 35; i++) { // Max 35 days for monthly
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== preferredDay) continue;

    if (frequency === 'weekly') return result;

    if (frequency === 'biweekly') {
      const week = getISOWeekNumber(result);
      const isEven = week % 2 === 0;
      if ((biweeklyWeek === 'even' && isEven) || (biweeklyWeek === 'odd' && !isEven)) {
        return result;
      }
      continue;
    }

    if (frequency === 'monthly') {
      // First occurrence of weekday in month
      if (result.getDate() <= 7) return result;
      continue;
    }
  }

  return result; // Fallback
}
```

### Scheduler Extension
```typescript
// api/src/scheduler.ts -- extended

import cron from 'node-cron';
import { collectAllNews } from './services/newsCollectorService.js';
import { processScheduledDigests } from './services/scheduleService.js';

export function startScheduler() {
  // Existing: daily news collection at 06:00 EET
  cron.schedule('0 6 * * *', async () => {
    console.log('Starting daily news collection...');
    try {
      const result = await collectAllNews();
      console.log(`Collection complete: ${result.collected} new items`);
    } catch (error) {
      console.error('News collection failed:', error);
    }
  }, { timezone: 'Europe/Helsinki' });

  // NEW: digest scheduling at 07:00 EET (1 hour after collection)
  cron.schedule('0 7 * * *', async () => {
    console.log('Starting scheduled digest generation...');
    try {
      await processScheduledDigests();
    } catch (error) {
      console.error('Scheduled digest generation failed:', error);
    }
  }, { timezone: 'Europe/Helsinki' });

  console.log('Scheduler started: collection 06:00, digests 07:00 EET');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| In-memory cron state | Database-driven scheduling | Standard for containerized deployments | Essential for Railway/Docker where processes restart |
| Fixed weekly schedule | Configurable per-client frequency | This phase | Enables flexible client plans |
| Manual source monitoring | Automated health tracking | This phase | Admin gets proactive alerts instead of discovering broken sources |

**Deprecated/outdated:**
- node-cron v3 API: v4 uses `timezone` option key (not `scheduled`/`recoverMissedExecutions`). The project already uses v4 syntax correctly.
- `issues.weekNumber`: Will be generalized to `periodNumber` to support bi-weekly and monthly frequencies.

## Open Questions

1. **Column rename vs. add+migrate for `weekNumber` -> `periodNumber`**
   - What we know: `drizzle-kit push` may handle column rename as drop+add, losing data. The column currently stores ISO week numbers for existing issues.
   - What's unclear: Whether `drizzle-kit push` can detect a rename or will it drop the column.
   - Recommendation: Add `periodNumber` as a new column with a default of `weekNumber` value, keep `weekNumber` temporarily, verify data migration, then drop `weekNumber` in a subsequent push. Alternatively, just keep `weekNumber` name but use it for all period types (rename is cosmetic; the meaning is clear from context with the new `scheduleFrequency` column).

2. **ADMIN_EMAIL environment variable**
   - What we know: Notification emails need a recipient. The admin's email is currently used for login (hardcoded).
   - What's unclear: Whether to use the login email or a separate env var.
   - Recommendation: Use `ADMIN_EMAIL` env var with a sensible fallback. This keeps notification target configurable without coupling to auth.

3. **Stale detection nuance: what counts as "last success with items"?**
   - What we know: Stale = fetches OK but 0 items for 7+ days. The `lastSuccessAt` updates on every successful fetch, even with 0 items.
   - What's unclear: Should `lastSuccessAt` only update when items > 0, or always on success?
   - Recommendation: Track both `lastSuccessAt` (any successful fetch) and `lastNonEmptyFetchAt` (successful fetch with items > 0). Stale detection uses `lastNonEmptyFetchAt`. This avoids the ambiguity. OR simpler: `lastSuccessAt` always updates, and add a separate `lastItemsAt` timestamp that only updates when items > 0. Use `lastItemsAt` for stale detection.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `api/src/scheduler.ts`, `api/src/services/newsletterService.ts`, `api/src/services/newsCollectorService.ts`, `api/src/db/schema.ts`, `api/src/services/emailService.ts`, `api/src/routes/digests.ts`, `api/src/routes/sources.ts`, `api/src/routes/dashboard.ts`, `api/src/routes/clients.ts`
- Context7 `/websites/nodecron` - node-cron v4 API: `cron.schedule()` with `timezone` option, `ScheduledTask` controls
- Context7 `/drizzle-team/drizzle-orm-docs` - pgTable column definitions, pgEnum, timestamp defaults, foreign key references

### Secondary (MEDIUM confidence)
- [ISO week number calculation in JavaScript](https://weeknumber.com/how-to/javascript) - verified against existing `getWeekNumber()` in newsletterService.ts
- [Day.js IsoWeek plugin](https://day.js.org/docs/en/plugin/iso-week) - alternative approach (not recommended, existing implementation sufficient)

### Tertiary (LOW confidence)
- None -- all findings verified against codebase and Context7

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - patterns directly extend existing code; database-driven approach verified against Railway deployment model
- Pitfalls: HIGH - identified from codebase analysis (Railway restarts, race conditions, ISO week edge cases)

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable -- no moving targets, all libraries pinned)
