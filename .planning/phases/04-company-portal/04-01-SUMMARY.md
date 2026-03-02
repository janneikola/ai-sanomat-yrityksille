---
phase: 04-company-portal
plan: 01
subsystem: auth, api
tags: [jwt, magic-link, fastify, react-email, resend, middleware, next.js]

# Dependency graph
requires:
  - phase: 01-foundation-admin-setup
    provides: "JWT auth plugin, Fastify app, Drizzle schema with clients/members tables"
  - phase: 03-email-delivery-send-workflow
    provides: "Resend client, React Email template pattern, email service"
provides:
  - "Magic link auth service (generate, verify, session JWT)"
  - "Portal API routes at /api/portal/* (login, verify, members CRUD, archive, me, logout)"
  - "MagicLinkEmail branded React Email template"
  - "sendSingleEmail Resend integration"
  - "Portal-aware Next.js middleware with role-based routing"
affects: [04-company-portal]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Portal auth decorator (role=company check)", "Magic link JWT with purpose claim", "Role-based middleware routing"]

key-files:
  created:
    - api/src/services/portalAuth.ts
    - api/src/routes/portal.ts
    - api/src/emails/MagicLinkEmail.tsx
  modified:
    - api/src/plugins/auth.ts
    - api/src/integrations/resendClient.ts
    - api/src/app.ts
    - web/middleware.ts
    - web/src/lib/api.ts

key-decisions:
  - "FastifyJWT type extended with optional clientId and purpose fields for portal tokens"
  - "Magic link token includes purpose=magic-link claim to prevent session JWT reuse as magic link"
  - "Portal auth is a local decorator inside portal routes, not a global Fastify decorator"
  - "Timestamp fields serialized to ISO strings in archive endpoint response"

patterns-established:
  - "Portal auth decorator: authenticatePortal checks role=company in onRequest hook"
  - "Magic link flow: generate short-lived JWT -> email -> verify -> issue session JWT"
  - "Role-based middleware routing: portal paths check for company role, admin paths use existing logic"

requirements-completed: [PORTAL-01, PORTAL-02]

# Metrics
duration: 4min
completed: 2026-03-02
---

# Phase 4 Plan 1: Portal Backend Summary

**Magic link auth with 15min tokens via Resend, portal API with members CRUD and newsletter archive, role-based middleware routing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-02T15:28:44Z
- **Completed:** 2026-03-02T15:33:03Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Magic link authentication flow: generate token, send branded Finnish email, verify token, issue 7-day session JWT
- Portal API with full members CRUD (add, bulk import, soft-delete, list) and newsletter archive scoped to company
- Portal-aware middleware that routes company users to /portal/login and admin users to /login

## Task Commits

Each task was committed atomically:

1. **Task 1: Magic link auth service, email template, and Resend single-send** - `3e7b876` (feat)
2. **Task 2: Portal API routes and Fastify registration** - `1314196` (feat)
3. **Task 3: Portal-aware Next.js middleware** - `c410c86` (feat)

## Files Created/Modified
- `api/src/services/portalAuth.ts` - Magic link generation and verification service
- `api/src/routes/portal.ts` - All portal API routes (login, verify, members CRUD, archive, me, logout)
- `api/src/emails/MagicLinkEmail.tsx` - Branded Finnish magic link email template
- `api/src/plugins/auth.ts` - Extended FastifyJWT type with clientId and purpose
- `api/src/integrations/resendClient.ts` - Added sendSingleEmail function
- `api/src/app.ts` - Registered portal routes at /api/portal prefix
- `web/middleware.ts` - Portal-aware role-based routing with verifyAndDecode
- `web/src/lib/api.ts` - Portal-aware 401 redirect logic

## Decisions Made
- FastifyJWT type extended with optional clientId and purpose fields (backward-compatible with admin tokens)
- Magic link token includes purpose=magic-link claim to prevent session JWT from being reused as magic link
- Portal auth is a local decorator inside portal routes plugin, not a global Fastify decorator (keeps admin routes unaffected)
- Archive endpoint serializes Date objects to ISO strings for JSON response compatibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
- Set PUBLIC_URL environment variable in api/.env for magic link URL generation (defaults to http://localhost:3001)

## Next Phase Readiness
- Portal backend fully functional, ready for Plan 02 (portal frontend UI)
- All API routes operational at /api/portal/*
- Middleware correctly differentiates portal vs admin routes

## Self-Check: PASSED

All 8 files verified present. All 3 task commits verified (3e7b876, 1314196, c410c86).

---
*Phase: 04-company-portal*
*Completed: 2026-03-02*
