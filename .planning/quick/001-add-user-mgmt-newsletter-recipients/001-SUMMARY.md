---
phase: quick-001
plan: 01
subsystem: api, ui
tags: [fastify, drizzle, react, next.js, admin, members, newsletter]

# Dependency graph
requires: []
provides:
  - "Admin member CRUD endpoints under /api/admin/clients/:id/members"
  - "Members management card on admin client detail page"
affects: [admin-panel, newsletter-delivery]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin member routes mirror portal member routes with admin auth"

key-files:
  created: []
  modified:
    - "api/src/routes/clients.ts"
    - "web/src/app/(admin)/clients/[id]/page.tsx"

key-decisions:
  - "Reused exact same DB logic and response shapes as portal member routes for consistency"
  - "Admin sees ALL members including inactive (unlike portal which filters inactive out)"
  - "Used membersList state variable name to avoid shadowing drizzle members import"

patterns-established:
  - "Admin member endpoints follow same pattern as portal but with fastify.authenticate and URL-param clientId"

requirements-completed: [QUICK-001]

# Metrics
duration: 3min
completed: 2026-03-04
---

# Quick Task 001: Add User Management for Newsletter Recipients Summary

**Admin member CRUD API endpoints and Vastaanottajat management card on client detail page with add/bulk-import/soft-delete flows**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-04T07:24:12Z
- **Completed:** 2026-03-04T07:27:05Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Four admin API endpoints for member management (GET, POST, POST bulk, PATCH deactivate)
- Members management card on client detail page with table showing all members and status badges
- Add single member, bulk import, and soft-delete dialogs matching portal tiimi page UX patterns

## Task Commits

Each task was committed atomically:

1. **Task 1: Add admin member API endpoints to clients route** - `0c58fcb` (feat)
2. **Task 2: Add members management card to admin client detail page** - `c4a329b` (feat)

## Files Created/Modified
- `api/src/routes/clients.ts` - Added 4 admin member endpoints (GET list, POST add, POST bulk, PATCH deactivate) with drizzle-orm direct DB access and admin auth
- `web/src/app/(admin)/clients/[id]/page.tsx` - Added Members/BulkResult interfaces, member state, fetchMembers callback, 3 handlers, Vastaanottajat card with table and 3 dialogs

## Decisions Made
- Reused identical DB query patterns and response shapes from portal.ts for consistency across admin and portal member management
- Admin endpoint shows ALL members (including inactive/deactivated) for full visibility, unlike portal which filters inactive out
- Named state variable `membersList` to avoid collision with `members` drizzle table import (not needed in frontend, but clear naming convention)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Steps
- Manual testing: Start API + frontend, navigate to /clients/[id], verify Recipients card works with add/bulk/remove flows

## Self-Check: PASSED

- [x] api/src/routes/clients.ts exists
- [x] web/src/app/(admin)/clients/[id]/page.tsx exists
- [x] Commit 0c58fcb found
- [x] Commit c4a329b found
- [x] API TypeScript compiles (no new errors)
- [x] Web TypeScript compiles (zero errors)

---
*Quick Task: 001-add-user-mgmt-newsletter-recipients*
*Completed: 2026-03-04*
