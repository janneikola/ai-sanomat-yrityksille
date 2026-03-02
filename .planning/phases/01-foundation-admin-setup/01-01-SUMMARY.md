---
phase: 01-foundation-admin-setup
plan: 01
subsystem: api
tags: [fastify, drizzle-orm, postgresql, zod, jwt, bcrypt, npm-workspaces, typescript]

# Dependency graph
requires: []
provides:
  - npm workspace monorepo with api, web, packages/shared workspaces
  - PostgreSQL schema with 7 tables (clients, members, newsSources, newsItems, issues, deliveryStats, promptTemplates)
  - Fastify 5 API with JWT auth, health check, admin CRUD endpoints
  - Shared Zod schemas importable from both api and web workspaces
  - DB seed script for 6 RSS sources, Beehiiv source, 3 Finnish prompt templates
affects:
  - 01-02 (Next.js frontend consumes all API endpoints, imports shared schemas)
  - 02-content-pipeline (uses db schema, news_sources, prompt_templates, issues tables)

# Tech tracking
tech-stack:
  added:
    - fastify 5.7.x (HTTP API server)
    - "@fastify/jwt 9.x (JWT sign/verify with cookie support)"
    - "@fastify/cookie 11.x (httpOnly cookie handling)"
    - "@fastify/cors 10.x (cross-origin support)"
    - fastify-plugin 5.x (plugin encapsulation wrapper)
    - fastify-type-provider-zod 4.0.2 (Zod type provider for Fastify routes)
    - drizzle-orm 0.45.x (type-safe PostgreSQL ORM)
    - drizzle-kit 0.31.x (schema push/generate CLI)
    - pg 8.x (PostgreSQL driver)
    - zod 3.25.x (schema validation, v3 API for type provider compatibility)
    - bcrypt 5.x (admin password hashing)
    - dotenv 16.x (environment variable loading)
    - tsx 4.x (TypeScript execution for dev and scripts)
  patterns:
    - FastifyPluginAsyncZod with withTypeProvider<ZodTypeProvider>() for typed route handlers
    - fastify-plugin wrapper for auth decorator (adminPasswordHash + authenticate)
    - Service layer pattern: routes/ call services/, services/ use drizzle db
    - Shared schemas in packages/shared imported via @ai-sanomat/shared workspace alias
    - Drizzle pgTable definitions with pgEnum, serial PK, timestamp defaultNow, $onUpdate

key-files:
  created:
    - package.json (root workspace config)
    - tsconfig.base.json (shared TypeScript strict ES2022 config)
    - .env.example (all required environment variables documented)
    - api/src/db/schema.ts (7 Drizzle table definitions with 4 enums)
    - api/src/db/index.ts (pg Pool + drizzle connection)
    - api/src/db/seed.ts (6 RSS sources, Beehiiv, 3 prompt templates)
    - api/src/plugins/auth.ts (JWT + cookie + adminPasswordHash + authenticate decorator)
    - api/src/routes/auth.ts (POST /login, POST /logout, GET /me)
    - api/src/routes/clients.ts (GET/POST/GET/:id/PUT/:id /api/admin/clients)
    - api/src/routes/sources.ts (GET/POST/GET/:id/PUT/:id/PATCH/:id/toggle /api/admin/sources)
    - api/src/routes/templates.ts (GET/GET/:id/PUT/:id /api/admin/templates)
    - api/src/services/clients.ts (listClients, getClient, createClient, updateClient)
    - api/src/services/sources.ts (listSources, getSource, createSource, updateSource, toggleSource)
    - api/src/services/templates.ts (listTemplates, getTemplate, updateTemplate)
    - api/src/app.ts (buildApp factory: CORS, auth, routes, health check)
    - api/src/index.ts (server entry: dotenv, buildApp, listen on ::)
    - packages/shared/src/schemas/client.ts (createClientSchema, updateClientSchema, clientResponseSchema)
    - packages/shared/src/schemas/source.ts (createSourceSchema, updateSourceSchema, sourceResponseSchema)
    - packages/shared/src/schemas/template.ts (updateTemplateSchema, templateResponseSchema)
    - packages/shared/src/types/index.ts (inferred TypeScript types from all schemas)
    - packages/shared/src/index.ts (re-exports all schemas and types)
  modified: []

key-decisions:
  - "Use zod (v3 API) not zod/v4 for fastify-type-provider-zod compatibility -- fastify-type-provider-zod 4.0.2 has peerDep on zod ^3.14.2, types don't match zod/v4 output types"
  - "Use withTypeProvider<ZodTypeProvider>() inside each route plugin for proper handler type inference"
  - "Remove rootDir from api/tsconfig.json to allow cross-package imports from packages/shared without TS6059 errors"
  - "Admin password hashed once at server startup with bcrypt (10 rounds) and stored in memory as fastify decorator"
  - "drizzle-kit push for MVP dev speed (not generate + migrate)"
  - "Fastify host :: for Railway IPv6 binding requirement"

patterns-established:
  - "Fastify route plugin pattern: const f = fastify.withTypeProvider<ZodTypeProvider>(); f.route({...})"
  - "Auth protection: onRequest: [fastify.authenticate] on each admin route"
  - "Error responses use { error: string } format consistently"
  - "Service functions accept typed data from Zod inference, return Drizzle row types"
  - "Seed script uses onConflictDoNothing() for idempotent runs"

requirements-completed: [FOUND-01, FOUND-02, FOUND-05]

# Metrics
duration: 11min
completed: 2026-03-02
---

# Phase 1 Plan 01: Backend Foundation Summary

**Fastify 5 API with bcrypt JWT auth, 7-table Drizzle/PostgreSQL schema, shared Zod schemas, and full admin CRUD (clients/sources/templates) in npm monorepo**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-02T06:44:58Z
- **Completed:** 2026-03-02T06:56:00Z
- **Tasks:** 2
- **Files modified:** 32

## Accomplishments
- npm workspace monorepo with api, web (placeholder), packages/shared workspaces resolving correctly
- PostgreSQL schema: 7 tables with 4 enums, foreign keys, and timestamps (clients, members, newsSources, newsItems, issues, deliveryStats, promptTemplates)
- Fastify 5 API: health check, login/logout/me auth endpoints, CRUD for clients/sources/templates — all admin routes JWT-protected
- DB seed: 6 RSS sources (OpenAI, Anthropic, Google AI, TechCrunch, The Verge, Ars Technica), Beehiiv source, 3 Finnish prompt templates
- Shared Zod schemas importable from @ai-sanomat/shared by both api and future web workspace

## Task Commits

Each task was committed atomically:

1. **Task 1: Monorepo structure, database schema, and shared Zod schemas** - `12aba70` (feat)
2. **Task 2: Fastify API server with auth, CRUD routes, and services** - `9f06fc8` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `package.json` - Root workspace config (api, web, packages/*)
- `tsconfig.base.json` - Shared TypeScript strict/ES2022 config
- `.env.example` - All environment variables documented
- `api/src/db/schema.ts` - 7 Drizzle tables with 4 enums
- `api/src/db/seed.ts` - Idempotent seed: 6 RSS + Beehiiv + 3 prompt templates
- `api/src/plugins/auth.ts` - JWT cookie auth + adminPasswordHash decorator
- `api/src/routes/auth.ts` - POST /login (bcrypt), /logout, GET /me
- `api/src/routes/clients.ts` - 4 CRUD endpoints with shared Zod schemas
- `api/src/routes/sources.ts` - 5 endpoints including PATCH toggle
- `api/src/routes/templates.ts` - 3 endpoints (read-only list + edit)
- `api/src/services/*.ts` - 3 service files wrapping Drizzle queries
- `api/src/app.ts` - Fastify factory: CORS, auth, routes, /health
- `api/src/index.ts` - Server entry with dotenv and :: host for Railway
- `packages/shared/src/schemas/*.ts` - Zod schemas for client, source, template
- `packages/shared/src/types/index.ts` - TypeScript type inference from all schemas

## Decisions Made
- Switched from `zod/v4` to `zod` (v3 API) for all imports: `fastify-type-provider-zod` v4.0.2 uses zod v3 peer dependency and types don't match v4 output types. Runtime type inference breaks with zod/v4 imports.
- Used `fastify.withTypeProvider<ZodTypeProvider>()` inside each plugin function for typed handlers (not `FastifyPluginAsyncZod` alone).
- Removed `rootDir` from api/tsconfig.json: TypeScript TS6059 errors when @ai-sanomat/shared is resolved outside api/src; removing rootDir allows cross-package references.
- Admin password hashed once at startup (bcrypt 10 rounds) stored as fastify decorator for efficiency.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Switched zod/v4 to zod (v3) for fastify-type-provider-zod compatibility**
- **Found during:** Task 2 (CRUD routes implementation)
- **Issue:** `fastify-type-provider-zod` v4.0.2 has peer dep on `zod ^3.14.2`. Its `ZodTypeProvider` interface uses `z.ZodTypeAny` from the zod v3 import. Schemas created with `zod/v4` don't extend v3's `z.ZodTypeAny`, causing TypeScript to type `request.body` and `request.params` as `unknown`.
- **Fix:** Changed all `import { z } from 'zod/v4'` to `import { z } from 'zod'` across shared schemas and route files. The plan specified `zod/v4` but the installed library version doesn't support it.
- **Files modified:** packages/shared/src/schemas/client.ts, source.ts, template.ts, types/index.ts, api/src/routes/auth.ts, clients.ts, sources.ts, templates.ts
- **Verification:** `npx tsc --noEmit -p api/tsconfig.json` passes cleanly
- **Committed in:** 9f06fc8 (Task 2 commit)

**2. [Rule 1 - Bug] Removed rootDir from api/tsconfig.json**
- **Found during:** Task 2 (first tsc check)
- **Issue:** `rootDir: ./src` in api/tsconfig.json caused TS6059 errors when TypeScript followed @ai-sanomat/shared path alias to packages/shared/src (outside rootDir).
- **Fix:** Removed `rootDir` from api/tsconfig.json. TypeScript can resolve cross-package files without rootDir restriction.
- **Files modified:** api/tsconfig.json
- **Verification:** tsc --noEmit passes without TS6059
- **Committed in:** 9f06fc8 (Task 2 commit)

**3. [Rule 1 - Bug] Added withTypeProvider<ZodTypeProvider>() inside route plugins**
- **Found during:** Task 2 (handler type errors)
- **Issue:** Using `FastifyPluginAsyncZod` type alone doesn't propagate the ZodTypeProvider to handler functions. `request.body`, `request.params` remain `unknown`.
- **Fix:** Added `const f = fastify.withTypeProvider<ZodTypeProvider>()` inside each route plugin and used `f.route()` instead of `fastify.route()`.
- **Files modified:** api/src/routes/auth.ts, clients.ts, sources.ts, templates.ts
- **Verification:** request.body and request.params are fully typed in handlers
- **Committed in:** 9f06fc8 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3x Rule 1 - Bug)
**Impact on plan:** All fixes necessary for TypeScript correctness. The zod/v4 deviation is a library version mismatch between the research recommendation and the actual installed version. No scope creep.

## Issues Encountered
- `api/drizzle.config.ts` in the `include` array caused TS6059 when `rootDir: ./src` was set - fixed by removing the file from include (drizzle-kit uses it directly with its own TSX loader, not the project tsconfig).

## User Setup Required
None - no external service configuration required for the API skeleton. Database connection requires `DATABASE_URL` environment variable before running `db:push` and `db:seed`.

## Next Phase Readiness
- API is ready for Plan 02 (Next.js frontend): all endpoints documented with Zod schemas
- Before Plan 02: user needs PostgreSQL database, run `npm run db:push` then `npm run db:seed`
- Health check available at GET /health for Railway service monitoring
- `drizzle-kit push` will create all 7 tables + 4 enums in one command

## Self-Check: PASSED

All 11 required files exist on disk. Both task commits (12aba70, 9f06fc8) confirmed in git log.

---
*Phase: 01-foundation-admin-setup*
*Completed: 2026-03-02*
