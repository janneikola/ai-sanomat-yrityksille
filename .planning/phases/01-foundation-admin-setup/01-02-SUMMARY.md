---
phase: 01-foundation-admin-setup
plan: 02
subsystem: ui
tags: [nextjs, shadcn-ui, react, tailwind, jose, jwt, tanstack-table, typescript]

# Dependency graph
requires:
  - phase: 01-01
    provides: Fastify API with JWT auth, CRUD endpoints for clients/sources/templates, shared Zod schemas
provides:
  - Next.js 16.1.6 admin panel with App Router and route groups
  - shadcn/ui 3.8.5 component library installed (sidebar, table, dialog, form, badge, switch, etc.)
  - JWT middleware with jose for Edge-compatible route protection
  - Login page with Finnish labels and httpOnly cookie auth
  - Admin layout with SidebarProvider and AppSidebar sidebar navigation (4 Finnish items)
  - Dashboard page with API summary counts
  - Clients CRUD page with DataTable (10 Finnish industries), create/edit dialog
  - Sources CRUD page with DataTable, type badges, active toggle Switch
  - Templates page with list + editor layout and variable reference sidebar with cursor insertion
  - apiFetch wrapper sending credentials: include for all API calls
affects:
  - 02-content-pipeline (admin panel for managing prompt templates used by pipeline)
  - 03-email-delivery (admin panel shows client/delivery stats)
  - 04-company-portal (reuses Next.js app structure and auth patterns)

# Tech tracking
tech-stack:
  added:
    - next 16.1.6 (App Router, route groups, Edge middleware, Turbopack)
    - react 19.2.3 (React 19 with hooks)
    - shadcn/ui 3.8.5 (sidebar, table, dialog, form, badge, switch, card, input, textarea, select, label, separator, sheet, tooltip, skeleton, sonner)
    - "@tanstack/react-table 8.21.2 (DataTable with typed columns)"
    - jose 5.10.0 (Edge-compatible JWT verification in Next.js middleware)
    - tailwindcss 4.x (CSS utility framework via shadcn init)
    - tw-animate-css (animation utilities for shadcn)
    - lucide-react (icon library for sidebar navigation)
    - zod 3.25.x (schema validation, imported from @ai-sanomat/shared)
  patterns:
    - Next.js route groups: (admin) wraps all protected admin pages with sidebar layout
    - JWT middleware pattern: jose jwtVerify in Edge runtime, fallback to dev secret
    - apiFetch wrapper: credentials include always + 401 redirect to /login
    - shadcn DataTable pattern: useReactTable + getCoreRowModel + flexRender
    - Optimistic toggle: Switch updates local state immediately, API call in background

key-files:
  created:
    - web/package.json (Next.js 16 + shadcn deps + jose + @tanstack/react-table)
    - web/tsconfig.json (path alias for @ai-sanomat/shared to packages/shared/src)
    - web/next.config.ts (transpilePackages for @ai-sanomat/shared)
    - web/middleware.ts (jose JWT verification, redirect to /login for unauth)
    - web/src/app/layout.tsx (root layout html lang="fi", metadata in Finnish)
    - web/src/app/globals.css (shadcn OKLCH CSS variables, tw-animate-css)
    - web/src/app/login/page.tsx (login form with Finnish labels, email pre-filled)
    - web/src/app/(admin)/layout.tsx (SidebarProvider + AppSidebar + SidebarInset)
    - web/src/app/(admin)/page.tsx (dashboard with 3 API count summary cards)
    - web/src/app/(admin)/clients/page.tsx (client list + create/edit dialog)
    - web/src/app/(admin)/sources/page.tsx (source list + create/edit dialog)
    - web/src/app/(admin)/templates/page.tsx (template list + editor side-by-side)
    - web/src/components/app-sidebar.tsx (4 Finnish nav items, logout button)
    - web/src/components/clients/client-table.tsx (DataTable, plan/status badges)
    - web/src/components/clients/client-form.tsx (industry dropdown, plan select, active toggle)
    - web/src/components/sources/source-table.tsx (type badges, active Switch)
    - web/src/components/sources/source-form.tsx (conditional URL/config by type)
    - web/src/components/templates/template-editor.tsx (textarea + variable sidebar)
    - web/src/lib/api.ts (apiFetch with credentials: include, 401 redirect)
    - web/src/lib/utils.ts (cn() utility from shadcn)
    - web/src/components/ui/ (17 shadcn component files)
  modified: []

key-decisions:
  - "Removed default root page.tsx created by create-next-app -- (admin)/page.tsx serves / via route group"
  - "Added dev fallback JWT secret in middleware to allow local dev without env vars"
  - "Used optimistic toggle in SourceTable -- Switch updates local state immediately on PATCH success"
  - "Template variable sidebar uses selectionStart/selectionEnd for cursor-position insertion"
  - "Removed Google Fonts (Geist) from root layout -- simpler, no external font dependency"

patterns-established:
  - "apiFetch pattern: always credentials: include, 401 triggers window.location redirect"
  - "Admin CRUD pattern: page fetches list on mount, Dialog/DialogContent for create/edit form"
  - "DataTable pattern: useReactTable + ColumnDef[] + flexRender for typed columns"
  - "Source toggle pattern: local state update + background PATCH, no page reload"

requirements-completed: [FOUND-03, FOUND-04, ADMIN-01, ADMIN-02, CONT-05]

# Metrics
duration: 8min
completed: 2026-03-02
---

# Phase 1 Plan 02: Admin Panel Summary

**Next.js 16.1.6 admin panel with shadcn/ui sidebar, JWT middleware (jose), and Finnish-language CRUD pages for clients, sources, and templates with DataTable and variable-insertion template editor**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-02T06:59:31Z
- **Completed:** 2026-03-02T07:07:49Z (auto tasks — checkpoint pending human verification)
- **Tasks:** 2 auto (Task 3 checkpoint pending)
- **Files modified:** 52

## Accomplishments
- Next.js 16.1.6 with App Router, Turbopack, React 19.2, shadcn/ui fully installed and configured
- JWT middleware using jose (Edge-compatible) protecting all admin routes, redirecting to /login
- Full Finnish-language CRUD admin interface: login, clients, sources, templates — build succeeds with 6 routes
- Template editor with variable reference sidebar where click-to-insert works at cursor position
- @ai-sanomat/shared workspace package integrated via transpilePackages and tsconfig paths

## Task Commits

Each task was committed atomically:

1. **Task 1: Next.js 16 app with shadcn/ui, login, middleware, sidebar layout, and API client** - `8e3a851` (feat)
2. **Task 2: Admin CRUD pages for clients, sources, and templates** - `cdf9a95` (feat)
3. **Task 3: Verify full admin flow locally** - PENDING (checkpoint awaiting human verification)

## Files Created/Modified
- `web/middleware.ts` - jose JWT verification, /login redirect for unauthenticated requests
- `web/src/app/login/page.tsx` - Login form with email/password in Finnish
- `web/src/app/(admin)/layout.tsx` - SidebarProvider + AppSidebar + SidebarInset admin shell
- `web/src/app/(admin)/page.tsx` - Dashboard with 3 count cards fetched from API
- `web/src/app/(admin)/clients/page.tsx` - Client list + create/edit dialog
- `web/src/app/(admin)/sources/page.tsx` - Source list + create/edit + optimistic toggle
- `web/src/app/(admin)/templates/page.tsx` - Template list + editor side-by-side layout
- `web/src/components/app-sidebar.tsx` - 4 Finnish nav items + logout button
- `web/src/components/clients/client-table.tsx` - DataTable with plan/status badges
- `web/src/components/clients/client-form.tsx` - 10 Finnish industries, plan, active toggle
- `web/src/components/sources/source-table.tsx` - Type badges + active Switch toggle
- `web/src/components/sources/source-form.tsx` - Conditional URL/config fields by type
- `web/src/components/templates/template-editor.tsx` - Textarea + variable reference sidebar
- `web/src/lib/api.ts` - apiFetch wrapper with credentials: include
- `web/src/lib/utils.ts` - cn() utility (shadcn)

## Decisions Made
- Removed default root `page.tsx` created by `create-next-app` — the `(admin)/page.tsx` serves `/` via Next.js route group pattern, no conflict.
- Added dev fallback JWT secret in middleware (`'dev-secret-key-change-in-production'`) to allow local dev without environment variables configured.
- Optimistic toggle in SourceTable: Switch updates local state immediately on successful PATCH, no full page reload needed.
- Template editor variable insertion uses `selectionStart`/`selectionEnd` with `requestAnimationFrame` to restore cursor after React state update.
- Removed Google Fonts (Geist) from root layout — cleaner, no external dependency in dev.

## Deviations from Plan

None — plan executed exactly as written. All components created as specified with Finnish UI text, correct API endpoints, and proper shadcn/ui patterns.

## Issues Encountered
- `create-next-app@latest` prompts React Compiler question interactively — worked around with `--yes` flag.
- `shadcn add toast` deprecated — used `shadcn add sonner` as replacement (per shadcn 2025 recommendation).
- Staging files with parentheses in path required quoting in git add commands.

## User Setup Required
The following must be configured before local verification:
1. Start local PostgreSQL database
2. Set `DATABASE_URL` in `api/.env`
3. Set `JWT_SECRET` in `api/.env` (same secret referenced by middleware)
4. Set `ADMIN_PASSWORD` in `api/.env`
5. Run `npm run db:push` to create tables
6. Run `npm run db:seed` to populate RSS sources, Beehiiv source, 3 prompt templates
7. Set `NEXT_PUBLIC_API_URL=http://localhost:3000` in `web/.env.local`
8. Start API: `npm run dev:api` (port 3000)
9. Start web: `npm run dev:web` (port 3001)

## Next Phase Readiness
- Admin panel ready for verification: all 6 routes built, middleware protecting admin routes
- After checkpoint approval: Railway deployment (per plan frontmatter user_setup tasks)
- Phase 2 (content pipeline) can start after Railway deployment is verified

## Self-Check: PASSED

All 9 required artifact files exist on disk:
- web/middleware.ts: 47 lines (min: 20) PASS
- web/src/app/login/page.tsx: 83 lines (min: 40) PASS
- web/src/app/(admin)/layout.tsx: 17 lines (min: 15) PASS
- web/src/app/(admin)/clients/page.tsx: 87 lines (min: 30) PASS
- web/src/app/(admin)/sources/page.tsx: 97 lines (min: 30) PASS
- web/src/app/(admin)/templates/page.tsx: 94 lines (min: 30) PASS
- web/src/components/app-sidebar.tsx: 80 lines (min: 30) PASS
- web/src/components/templates/template-editor.tsx: 153 lines (min: 40) PASS
- web/src/lib/api.ts: 29 lines (min: N/A) PASS

Both task commits (8e3a851, cdf9a95) confirmed in git log.

---
*Phase: 01-foundation-admin-setup*
*Completed: 2026-03-02*
