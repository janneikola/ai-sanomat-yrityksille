# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** The AI-generated weekly digest must be genuinely useful and industry-relevant -- content quality is the entire selling point.
**Current focus:** Phase 2: Content Pipeline

## Current Position

Phase: 2 of 4 (Content Pipeline) — IN PROGRESS
Plan: 1 of 2 in current phase (02-01 complete)
Status: 02-01 complete — ready for 02-02 (digest generation)
Last activity: 2026-03-02 -- Completed 02-01 (news collection, scheduler, admin news page)

Progress: [##############################] 43% (3/7 plans fully verified)

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: ~20 min
- Total execution time: ~1.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-admin-setup | 2 | ~56min | ~28min |
| 02-content-pipeline | 1 | 5min | 5min |

**Recent Trend:**
- Last 5 plans: 11min, ~45min, 5min
- Trend: improving

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: 4 phases (quick depth), content pipeline before email delivery, company portal last (no clients yet)
- Research: Use Next.js 16 instead of 15, node-cron instead of BullMQ, Drizzle ORM for database
- 01-01: Use zod (v3 API) not zod/v4 -- fastify-type-provider-zod 4.0.2 peer dep requires zod v3, types incompatible with zod/v4
- 01-01: withTypeProvider<ZodTypeProvider>() required inside each plugin for typed handler request.body/params
- 01-01: Removed rootDir from api/tsconfig.json to allow cross-package @ai-sanomat/shared imports without TS6059
- 01-01: Admin password hashed once at startup (bcrypt 10 rounds) stored as fastify decorator
- 01-01: drizzle-kit push for MVP dev, :: host binding for Railway
- 01-02: Removed default root page.tsx -- (admin)/page.tsx serves / via Next.js route group
- 01-02: Dev fallback JWT secret in middleware for local dev without env vars
- 01-02: Optimistic toggle in SourceTable -- Switch updates local state on PATCH success
- 01-02: shadcn toast deprecated, using sonner component instead
- 01-02: API proxied through Next.js rewrites -- CORS prevented httpOnly cookie forwarding to cross-origin Fastify; rewrites make calls same-origin (commit 61a0496)
- 02-01: Beehiiv response typed with explicit BeehiivPost interface for strict TypeScript compatibility
- 02-01: Toaster from sonner added to admin layout for toast notification support
- 02-01: Sidebar icon Newspaper moved to Uutiset, Rss icon for Uutislahteet
- 02-01: Integration client pattern established in api/src/integrations/ with typed interfaces

### Pending Todos

- Set up DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD in api/.env before running db:push/db:seed
- Set NEXT_PUBLIC_API_URL=http://localhost:3000 in web/.env.local for local dev
- Set BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID in api/.env for Beehiiv source collection

### Blockers/Concerns

- Gemini Nano Banana 2 exact API capabilities need verification before Phase 2 image generation work
- Zod 4 vs Zod 3 compatibility with fastify-type-provider-zod: RESOLVED -- use zod v3 API (standard `import { z } from 'zod'`)
- Resend free tier (100 emails/day) may require Pro plan once clients onboard
- SPF/DKIM/DMARC DNS records for mail.aisanomat.fi need 2-4 weeks of monitoring before client sends

## Session Continuity

Last session: 2026-03-02
Stopped at: Completed 02-01-PLAN.md — News collection pipeline complete, ready for 02-02 digest generation
Resume file: None
