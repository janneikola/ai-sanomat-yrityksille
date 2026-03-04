# Phase 5: Foundation Automation - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

System auto-generates draft digests on each client's configured schedule and monitors source reliability without manual intervention. Admin retains full control over approval and sending. New source types (web search, X/Twitter) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Schedule Configuration
- Three fixed frequency options: weekly, bi-weekly, monthly
- Preferred day: day of week only (no time config) — daily cron runs once in the morning
- Default for new clients: Weekly, Monday
- Bi-weekly: based on even/odd ISO week number (admin picks which)
- Monthly: first occurrence of the preferred weekday each month
- Separate pause/resume toggle — schedule config preserved when paused
- Admin dashboard shows next scheduled generation date per client on the client list
- Schedule configured on the client detail page (not a separate page)

### Auto-Generation Behavior
- Auto-generated digests land in 'draft' status — admin must approve before sending
- Email notification sent to admin when a draft is ready, with direct link to preview page
- On generation failure: create issue with status 'failed' + email admin. No auto-retry
- Minimum 5 news items threshold before generating — skip if fewer
- If below threshold: email admin, retry next day (not next period)
- News window: only items collected since client's last digest (avoids repeating stories)
- First digest for a new client: use last 7 days of collected news
- Period identification: year + period number (weekly: week number, bi-weekly: bi-week 1-26, monthly: month 1-12)
- Multiple due clients processed sequentially (not parallel) — respects API rate limits
- Manual generation trigger (existing button) remains alongside auto-schedule

### Source Health Display
- Green/yellow/red color dot on the existing source list, next to source name
- Additional info: last successful fetch timestamp shown alongside dot
- Thresholds based on consecutive failures: Green 0-1, Yellow 2-3, Red 4+
- Stale detection: source fetches OK but 0 items for 7+ days = yellow warning
- Source list filterable by health status: All / Healthy / Warning / Failing
- Source detail page shows recent fetch log (last 10-20 attempts with status, items count, errors)

### Auto-Disable & Notifications
- 5 consecutive failures triggers auto-disable (source set to isActive=false)
- Email sent per event: when source turns yellow, turns red, or gets auto-disabled
- Auto-disabled sources require manual re-enable by admin (no auto-recovery)
- Notification emails sent from same sender address as newsletters (via Resend)

### Scheduler Recovery
- On server startup: check if today's scheduled run was missed, execute if so (handles Railway deploys)
- 30-second delay after boot before catch-up check (lets DB initialize)
- Database timestamp tracks last scheduler run to prevent double execution

### Existing Client Migration
- Database migration applies default schedule (Weekly/Monday) to all existing active clients
- All migrated clients start with schedule paused — admin explicitly unpauses when ready

### Generation Run Logging
- Scheduler runs logged to a database table: timestamp, clients processed, successes, failures, skips
- Last 30 runs displayed as a section on the admin dashboard

### Claude's Discretion
- Exact notification email content/formatting (simple functional emails)
- Database table structure for scheduler_runs and source_health_logs
- Run log table column design
- How to handle edge cases in period number calculation
- Exact cron schedule time (e.g. 06:00 or 07:00 EET)

</decisions>

<specifics>
## Specific Ideas

- Daily cron should check DB for due clients — not hardcoded per-client crons
- The existing `generateClientDigest()` in newsletterService.ts should be reused by the scheduler — it already handles the full pipeline
- The `issues` table's `weekNumber` + `year` columns should be generalized to support period-based dedup across all frequencies
- Source health tracking should wrap the existing `newsCollectorService.collectAllNews()` loop — each source fetch attempt gets logged

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `api/src/scheduler.ts`: Existing node-cron setup (daily 06:00 EET) — extend with digest scheduling cron
- `api/src/services/newsletterService.ts`: `generateClientDigest(clientId)` — full generation pipeline, reuse as-is for auto-generation
- `api/src/services/newsCollectorService.ts`: `collectAllNews()` — wrap with health tracking per source
- `api/src/services/emailService.ts`: Resend integration — reuse for admin notification emails
- `api/src/routes/digests.ts`: Existing digest CRUD routes — extend or complement for schedule-related data
- `api/src/routes/sources.ts`: Source CRUD + toggle routes — extend with health data in responses

### Established Patterns
- Drizzle ORM with pgTable schema definitions in `api/src/db/schema.ts`
- Fastify + Zod type provider for route validation
- Service layer (business logic) separate from routes (HTTP)
- Sequential processing for external API calls (rate limit safety)
- `onConflictDoNothing` for deduplication

### Integration Points
- `api/src/db/schema.ts`: Add schedule columns to clients table, health columns to newsSources, new tables for health logs and scheduler runs
- `api/src/scheduler.ts`: Add digest scheduling cron alongside existing news collection cron
- `api/src/app.ts`: Register any new route files
- `api/src/index.ts`: Startup catch-up check after server boot
- Admin frontend (when it exists): client detail page gets schedule config section, sources page gets health indicators, dashboard gets run log

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-foundation-automation*
*Context gathered: 2026-03-03*
