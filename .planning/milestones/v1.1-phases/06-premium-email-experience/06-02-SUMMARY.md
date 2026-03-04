---
phase: 06-premium-email-experience
plan: 02
subsystem: feedback
tags: [jwt, feedback, satisfaction, dashboard, email-personalization]
dependency_graph:
  requires:
    - phase: 06-01
      provides: premium-email-template with feedbackUrls prop placeholder
  provides:
    - feedbackVotes table with UNIQUE constraint
    - feedback service (vote recording, URL generation, satisfaction queries)
    - public vote endpoint (JWT-verified, no auth)
    - per-member email rendering with personalized feedback URLs
    - admin satisfaction dashboard (per-issue and per-client)
  affects: [emailService, DigestEmail, admin-dashboard]
tech_stack:
  added: []
  patterns: [jwt-signed-action-links, upsert-on-conflict, per-member-email-rendering]
key_files:
  created:
    - api/src/services/feedbackService.ts
    - api/src/services/feedbackService.test.ts
    - api/src/routes/feedback.ts
  modified:
    - api/src/db/schema.ts
    - api/src/services/emailService.ts
    - api/src/routes/digests.ts
    - api/src/routes/dashboard.ts
    - api/src/plugins/auth.ts
    - api/src/app.ts
    - web/src/app/(admin)/page.tsx
key_decisions:
  - JWT feedback tokens use 90-day expiry (not 15-min like auth tokens) for long email shelf life
  - UPSERT via ON CONFLICT DO UPDATE for idempotent vote recording (change vote without errors)
  - Per-member email rendering (not shared HTML) to embed unique feedback URLs per recipient
  - FastifyJWT payload type extended with optional feedback fields to support multi-purpose tokens
  - Satisfaction flagging requires minimum 3 votes to avoid noise from small sample sizes
patterns_established:
  - "JWT-signed action links: embed action data in JWT payload, verify at public endpoint, no auth needed"
  - "Per-member email rendering: when email content differs per recipient, render inside member loop"
  - "Pure function unit testing: computeSatisfaction tested independently from DB"
requirements_completed: [FEED-01, FEED-02, FEED-03, FEED-04]
metrics:
  duration: 5min
  completed: "2026-03-03T12:26:20Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 7
---

# Phase 6 Plan 02: One-Click Email Feedback System Summary

**JWT-signed thumbs up/down vote links in emails with UPSERT vote recording, public vote endpoint, per-member email rendering, and admin satisfaction dashboard with flagging**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-03T12:20:33Z
- **Completed:** 2026-03-03T12:26:20Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- feedbackVotes table with voteTypeEnum and UNIQUE(memberId, issueId) constraint
- Complete feedback service: generateFeedbackUrls, recordVote (UPSERT), computeSatisfaction (pure), getSatisfactionByIssue, getSatisfactionByClient
- Public GET /api/feedback/vote?token=... endpoint verifies JWT, checks purpose='feedback', records vote, redirects to aisanomat.fi
- Per-member email rendering in sendDigestToClient with personalized feedback URLs
- Admin dashboard "Lukijapalaute" card with per-digest satisfaction table and per-client summary
- Low-satisfaction digests (below 50% with 3+ votes) flagged with "Tarkista" badge
- 7 unit tests for computeSatisfaction covering all edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests** - `5fc6e56` (test)
2. **Task 1 (GREEN): Schema, service, route, registration** - `6eac243` (feat)
3. **Task 2: Email wiring and admin dashboard** - `09ec504` (feat)

## Files Created/Modified

- `api/src/db/schema.ts` - Added voteTypeEnum and feedbackVotes table with UNIQUE constraint
- `api/src/services/feedbackService.ts` - NEW: Vote recording, URL generation, satisfaction queries
- `api/src/services/feedbackService.test.ts` - NEW: 7 unit tests for computeSatisfaction
- `api/src/routes/feedback.ts` - NEW: Public vote endpoint with JWT verification
- `api/src/app.ts` - Registered feedbackRoutes as public route at /api prefix
- `api/src/plugins/auth.ts` - Extended FastifyJWT payload type with feedback token fields
- `api/src/services/emailService.ts` - Per-member rendering with feedback URLs, optional app parameter
- `api/src/routes/digests.ts` - Pass fastify instance to sendDigestToClient
- `api/src/routes/dashboard.ts` - Added GET /dashboard/satisfaction endpoint
- `web/src/app/(admin)/page.tsx` - Added "Lukijapalaute" satisfaction card with tables and flagging

## Decisions Made

1. **JWT feedback tokens 90-day expiry**: Emails may sit in inboxes for weeks; 90-day expiry ensures votes work long after delivery
2. **UPSERT on conflict**: Using ON CONFLICT DO UPDATE means clicking the link again (or changing vote) never errors
3. **Per-member email rendering**: Each member needs unique feedback URLs, so email is rendered per-member instead of once-for-all
4. **Optional app parameter**: sendDigestToClient accepts optional FastifyInstance for backward compatibility; without it, feedback URLs are simply not included
5. **Minimum 3 votes for flagging**: Prevents false alarms from 1 negative vote on 2 total

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] FastifyJWT type declaration incompatible with feedback payload**
- **Found during:** Task 1 (GREEN phase, TypeScript compilation)
- **Issue:** FastifyJWT payload type requires `email` and `role` fields, but feedback tokens use `memberId`, `issueId`, `vote` instead
- **Fix:** Extended FastifyJWT interface with optional feedback fields; used typed sign wrapper in feedbackService to bypass strict payload typing
- **Files modified:** api/src/plugins/auth.ts, api/src/services/feedbackService.ts
- **Verification:** TypeScript compiles clean
- **Committed in:** 6eac243 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Type-safe JWT signing with multi-purpose payload support. No scope creep.

## Issues Encountered

None beyond the auto-fixed JWT type issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 6 (Premium Email Experience) is fully complete
- Email template, featured posts, feedback system all operational
- Ready for Phase 7+ (smart sourcing, embedding, X monitoring)

---
*Phase: 06-premium-email-experience*
*Completed: 2026-03-03*
