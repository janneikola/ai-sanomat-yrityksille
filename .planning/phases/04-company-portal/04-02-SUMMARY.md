---
phase: 04-company-portal
plan: 02
subsystem: ui
tags: [next.js, react, shadcn, portal, magic-link, team-management, sidebar]

# Dependency graph
requires:
  - phase: 04-company-portal
    provides: "Portal API routes (login, verify, members CRUD, archive, me, logout), magic link auth service, portal-aware middleware"
  - phase: 01-foundation-admin-setup
    provides: "shadcn/ui components (sidebar, table, dialog, card, badge, button, input, textarea, sonner), apiFetch, admin layout pattern"
provides:
  - "Portal login page at /portal/login with magic link request form"
  - "Token verification page at /portal/verify with session exchange and redirect"
  - "Portal layout with branded sidebar (company name, plan badge, navigation)"
  - "Team management page at /tiimi with add, bulk import, and remove member dialogs"
  - "Newsletter archive page at /arkisto with sent issue cards"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["Portal route group (portal) with dedicated sidebar layout", "Portal public pages outside route group at /portal/*", "Branded sidebar with API-fetched company info"]

key-files:
  created:
    - web/src/app/portal/login/page.tsx
    - web/src/app/portal/verify/page.tsx
    - web/src/app/(portal)/layout.tsx
    - web/src/app/(portal)/tiimi/page.tsx
    - web/src/app/(portal)/arkisto/page.tsx
    - web/src/components/portal-sidebar.tsx
  modified: []

key-decisions:
  - "Portal login and verify pages placed outside (portal) route group -- public pages need no sidebar"
  - "Inactive members filtered out from team table for cleaner UX (soft-deleted members hidden)"
  - "Portal sidebar fetches company info from /api/portal/me on mount for dynamic branding"
  - "Archive page displays issues as cards sorted by most recent first (API default)"

patterns-established:
  - "Portal route group pattern: (portal) group with PortalSidebar, separate from (admin) group"
  - "Public portal pages at /portal/* outside route groups for standalone login/verify flow"
  - "Bulk import dialog with textarea for comma-separated email input"

requirements-completed: [PORTAL-01, PORTAL-02]

# Metrics
duration: 3min
completed: 2026-03-02
---

# Phase 4 Plan 2: Portal Frontend Summary

**Company portal UI with magic link login flow, team member management (add/bulk/remove), newsletter archive, and branded sidebar with dynamic company info**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-02T15:38:23Z
- **Completed:** 2026-03-02T15:40:16Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Magic link login page at /portal/login with branded card layout and Finnish labels, plus token verification page at /portal/verify with auto-redirect
- Team member management at /tiimi with full CRUD: add single member dialog, bulk import via comma-separated emails, remove with confirmation dialog, status badges
- Newsletter archive at /arkisto displaying sent issues as cards with week number and Finnish-locale dates
- Branded portal sidebar with dynamic company name, plan badge, navigation, and logout

## Task Commits

Each task was committed atomically:

1. **Task 1: Portal login and verify pages** - `06d7e6f` (feat)
2. **Task 2: Portal layout, sidebar, team management, and archive pages** - `cd26941` (feat)

## Files Created/Modified
- `web/src/app/portal/login/page.tsx` - Centered login card with email form, submits to /api/portal/login, shows success message
- `web/src/app/portal/verify/page.tsx` - Token exchange from URL params, redirects to /tiimi on success, error state for expired links
- `web/src/app/(portal)/layout.tsx` - Portal layout with SidebarProvider, PortalSidebar, and Toaster
- `web/src/app/(portal)/tiimi/page.tsx` - Team members table with add-single, bulk-import, and remove-member dialogs
- `web/src/app/(portal)/arkisto/page.tsx` - Newsletter archive with card list of sent issues
- `web/src/components/portal-sidebar.tsx` - Portal-branded sidebar with company info, plan badge, navigation, and logout

## Decisions Made
- Portal login and verify pages placed outside the (portal) route group since they are public pages that should not have the sidebar
- Inactive members (soft-deleted) filtered out from the team table for cleaner UX
- Portal sidebar dynamically fetches company name and plan from /api/portal/me endpoint on mount
- Archive page uses simple card layout with week/year display, sorted most recent first

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Portal frontend uses the same API endpoints configured in Plan 04-01.

## Next Phase Readiness
- All 4 phases are now complete
- The full AI-Sanomat platform is functional: admin panel, content pipeline, email delivery, and company portal
- Remaining non-code tasks: Railway deployment (FOUND-04), DNS records for mail.aisanomat.fi (EMAIL-03)

## Self-Check: PASSED

All 6 files verified present. Both task commits verified (06d7e6f, cd26941).

---
*Phase: 04-company-portal*
*Completed: 2026-03-02*
