---
phase: 03-email-delivery-send-workflow
plan: 02
subsystem: web, admin-ui
tags: [admin-ui, digest-workflow, dashboard, delivery-stats, nextjs]

# Dependency graph
requires:
  - phase: 03-email-delivery-send-workflow
    plan: 01
    provides: "Digest workflow API endpoints, dashboard stats API"
  - phase: 01-foundation-admin-setup
    plan: 02
    provides: "Admin panel layout, shadcn/ui components, apiFetch, sonner toasts"
provides:
  - "Client detail page with full digest workflow (generate, preview, approve, send, regenerate)"
  - "Dashboard with per-client delivery stats table (team size, latest send, open rate)"
  - "Client table with links to detail pages"
affects: [04-company-portal-scheduled-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [iframe-email-preview, status-driven-action-buttons, delivery-stats-dashboard]

key-files:
  created:
    - web/src/app/(admin)/clients/[id]/page.tsx
  modified:
    - web/src/app/(admin)/page.tsx
    - web/src/components/clients/client-table.tsx

key-decisions:
  - "Digest status drives action button visibility: ready shows approve+send and regenerate, approved shows send and regenerate, sent shows confirmation, failed shows regenerate"
  - "Email preview uses iframe with src pointing to /api/admin/digests/:id/preview for pixel-perfect rendering"
  - "Dashboard delivery stats sorted by latest send date (most recent first), clients without sends shown last"
  - "Client name in both client table and dashboard table links to /clients/[id] detail page"
  - "No sidebar changes needed -- existing isActive uses startsWith which correctly highlights for /clients/[id] routes"

patterns-established:
  - "Status-driven UI pattern: action buttons and display change based on digest status value"
  - "Iframe preview pattern: /api endpoint returns raw HTML, iframe renders it as recipients would see"

requirements-completed: [ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06]

# Metrics
duration: 3min
completed: 2026-03-02
---

# Phase 3 Plan 2: Admin Send Workflow UI and Dashboard Summary

**Client detail page with digest generate/preview/approve/send/regenerate workflow, dashboard delivery stats table, and client table navigation links**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-02T13:03:32Z
- **Completed:** 2026-03-02T13:06:13Z
- **Tasks:** 2 (auto) + 1 (checkpoint:human-verify pending)
- **Files modified:** 3

## Accomplishments
- Client detail page at /clients/[id] with client info header (name, industry, email, plan badge)
- Full digest workflow: generate button with loading spinner, status badge display, email preview iframe
- Status-driven action buttons: "Hyvaksy ja laheta" for ready digests, "Laheta" for approved, "Generoi uudelleen" for regeneration
- Email preview in 800px iframe rendering exact HTML recipients would see
- Validation report collapsible section when quality data is available
- Dashboard updated with per-client delivery stats table (client name linked, team size, latest send date, open rate)
- Summary cards retained at top of dashboard
- Client table name column now links to detail pages, plus "Nayta" (View) button in actions

## Task Commits

Each task was committed atomically:

1. **Task 1: Client detail page with digest workflow** - `bfee427` (feat)
2. **Task 2: Dashboard with delivery stats and client table links** - `cf70fd2` (feat)

## Files Created/Modified
- `web/src/app/(admin)/clients/[id]/page.tsx` - Client detail page with full digest generate/preview/approve/send/regenerate workflow
- `web/src/app/(admin)/page.tsx` - Dashboard updated with delivery stats table below summary cards
- `web/src/components/clients/client-table.tsx` - Client name links to detail page, added "Nayta" view button

## Decisions Made
- Digest status drives action button visibility (ready: approve+send+regenerate, approved: send+regenerate, sent: confirmation text, failed: error+regenerate)
- Email preview uses iframe with API endpoint src for pixel-perfect rendering
- Dashboard delivery stats sorted by latest send date, no-sends clients last
- Client name clickable in both client table and dashboard table
- Sidebar unchanged -- existing isActive(startsWith) correctly handles /clients/[id] subroutes

## Deviations from Plan

None - plan executed exactly as written.

## Checkpoint Pending

**Task 3 (checkpoint:human-verify)** is pending user verification:
- Start dev servers (api + web)
- Navigate to client detail page via Asiakkaat list
- Verify digest generation workflow UI
- Verify dashboard delivery stats table
- Test sidebar navigation

## Issues Encountered
None.

---
*Phase: 03-email-delivery-send-workflow*
*Plan: 02*
*Completed: 2026-03-02 (auto tasks; checkpoint pending)*
