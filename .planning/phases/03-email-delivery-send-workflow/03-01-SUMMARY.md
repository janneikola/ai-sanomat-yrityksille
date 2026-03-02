---
phase: 03-email-delivery-send-workflow
plan: 01
subsystem: email, api
tags: [resend, react-email, svix, webhook, email-delivery, fastify]

# Dependency graph
requires:
  - phase: 02-content-pipeline
    provides: "Digest generation pipeline (newsletterService, claudeClient, imageService)"
  - phase: 01-foundation-admin-setup
    provides: "Fastify app, auth plugin, DB schema with issues/members/deliveryStats tables"
provides:
  - "React Email template rendering (DigestEmail component)"
  - "Resend batch email sending integration (resendClient)"
  - "Email rendering + sending orchestration (emailService)"
  - "Webhook endpoint for Resend delivery/open/bounce events"
  - "Digest workflow API: preview, approve, send, regenerate"
  - "Dashboard stats API with per-client delivery metrics"
  - "Static image serving at /api/images/"
affects: [04-company-portal-scheduled-pipeline]

# Tech tracking
tech-stack:
  added: [resend, "@react-email/components", "@react-email/render", svix, fastify-raw-body, react, react-dom, "@fastify/static"]
  patterns: [react-email-template, batch-email-sending, webhook-signature-verification, raw-body-parsing]

key-files:
  created:
    - api/src/emails/DigestEmail.tsx
    - api/src/integrations/resendClient.ts
    - api/src/services/emailService.ts
    - api/src/routes/webhooks.ts
    - api/src/routes/dashboard.ts
  modified:
    - api/tsconfig.json
    - api/package.json
    - api/src/routes/digests.ts
    - api/src/app.ts

key-decisions:
  - "DigestEmailStory extends DigestStory with optional imageUrl -- avoids intersection type issues with TypeScript strict mode"
  - "Webhook processes events idempotently -- silently returns 200 if no matching deliveryStats record found"
  - "Raw body registered globally: false to avoid performance overhead on non-webhook routes"
  - "Dashboard stats use per-client sequential queries with SQL aggregates for clarity over a single complex join"

patterns-established:
  - "React Email template pattern: component with typed props, styles as CSSProperties objects, render() for HTML+text"
  - "Webhook verification pattern: Svix Webhook class with raw body + svix-* headers"
  - "Email delivery pattern: render once, build per-member payloads with List-Unsubscribe headers, batch send, create deliveryStats"

requirements-completed: [EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-04, EMAIL-05, EMAIL-06, EMAIL-07]

# Metrics
duration: 5min
completed: 2026-03-02
---

# Phase 3 Plan 1: Email Delivery and Send Workflow Summary

**React Email newsletter template, Resend batch sending with List-Unsubscribe headers, Svix-verified webhook processing for delivery/open/bounce tracking, and full digest approve/send/regenerate/preview workflow API**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-02T12:55:15Z
- **Completed:** 2026-03-02T13:00:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Branded Finnish newsletter template (DigestEmail.tsx) with hero image, per-story section images, unsubscribe link, and tracking pixel
- Resend batch.send() integration with auto-chunking for >100 recipients, full List-Unsubscribe + List-Unsubscribe-Post per RFC 8058
- Email service that renders HTML+plain text via React Email and orchestrates per-member sending with deliveryStats tracking
- Svix-verified webhook endpoint processing delivery, open, and bounce events -- hard bounces (Permanent) mark member as bounced
- Digest workflow endpoints: GET preview (raw HTML for iframe), POST approve, POST send, POST regenerate
- Dashboard stats API returning per-client teamSize, latestSend, and openRate metrics
- Static image serving at /api/images/ for email-embedded images

## Task Commits

Each task was committed atomically:

1. **Task 1: React Email template, Resend client, and email service** - `eabd6aa` (feat)
2. **Task 2: Webhook route, digest workflow endpoints, dashboard API, and app registration** - `eb8565b` (feat)

## Files Created/Modified
- `api/src/emails/DigestEmail.tsx` - React Email newsletter template with branded layout, stories, footer
- `api/src/integrations/resendClient.ts` - Resend SDK wrapper for batch email sending with chunking
- `api/src/services/emailService.ts` - Email rendering (HTML+text) and per-member sending orchestration
- `api/src/routes/webhooks.ts` - Public webhook endpoint for Resend events with Svix signature verification
- `api/src/routes/dashboard.ts` - Dashboard stats API with per-client delivery metrics
- `api/src/routes/digests.ts` - Extended with preview, approve, send, regenerate endpoints
- `api/src/app.ts` - Registered webhook (public), dashboard (authenticated), static images, raw body plugin
- `api/tsconfig.json` - Added jsx: react-jsx for TSX support
- `api/package.json` - Added resend, @react-email/*, svix, fastify-raw-body, react, react-dom, @fastify/static

## Decisions Made
- DigestEmailStory extends DigestStory with optional imageUrl to avoid TypeScript intersection type resolution issues with strict mode
- Webhook handler returns 200 even when no matching deliveryStats record found (idempotent, prevents Resend retries)
- Raw body plugin registered with global: false to avoid performance overhead on all routes
- Dashboard stats computed with per-client sequential queries rather than a single complex join for maintainability
- Pino logger calls use object-first syntax ({ err }, message) per Fastify strict typing requirements

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed DigestStory intersection type not resolving imageUrl**
- **Found during:** Task 1 (DigestEmail.tsx and emailService.ts)
- **Issue:** TypeScript intersection `DigestContent & { stories: Array<...> }` did not properly override the `stories` property, causing `imageUrl` to not be recognized
- **Fix:** Created dedicated `DigestEmailStory` interface extending `DigestStory` with `imageUrl`, and `DigestEmailDigest` interface using it
- **Files modified:** api/src/emails/DigestEmail.tsx, api/src/services/emailService.ts
- **Verification:** tsc --noEmit passes clean
- **Committed in:** eabd6aa (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Pino logger strict typing for error logging**
- **Found during:** Task 2 (webhooks.ts)
- **Issue:** `fastify.log.warn('message', err)` not compatible with Pino's strict overload signatures
- **Fix:** Changed to object-first syntax: `fastify.log.warn({ err }, 'message')`
- **Files modified:** api/src/routes/webhooks.ts
- **Verification:** tsc --noEmit passes clean
- **Committed in:** eb8565b (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed type issues documented above.

## User Setup Required

External services require manual configuration:
- **RESEND_API_KEY**: Resend Dashboard -> API Keys -> Create API Key (add to api/.env)
- **RESEND_WEBHOOK_SECRET**: Resend Dashboard -> Webhooks -> Add Endpoint -> Signing Secret (add to api/.env)
- **Domain setup**: Add sending domain mail.aisanomat.fi in Resend Dashboard -> Domains
- **DNS records**: Configure SPF, DKIM, DMARC as shown by Resend in domain registrar
- **Webhook endpoint**: Add webhook URL pointing to deployed /api/webhooks/resend in Resend Dashboard

## Next Phase Readiness
- Email delivery pipeline complete: render, send, track
- Ready for Phase 4: company portal and scheduled pipeline
- DNS/domain verification for mail.aisanomat.fi should be started early (2-4 week monitoring)
- Resend free tier (100 emails/day) sufficient for development; Pro plan needed for production

---
*Phase: 03-email-delivery-send-workflow*
*Plan: 01*
*Completed: 2026-03-02*
