# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** The AI-generated weekly digest must be genuinely useful and industry-relevant -- content quality is the entire selling point.
**Current focus:** Phase 1: Foundation and Admin Setup

## Current Position

Phase: 1 of 4 (Foundation and Admin Setup)
Plan: 2 of 2 in current phase (01-01 complete, 01-02 auto tasks complete, checkpoint pending)
Status: In progress — awaiting human verification (Task 3 checkpoint)
Last activity: 2026-03-02 -- Completed 01-02 auto tasks (Next.js admin panel)

Progress: [##########] 13% (1/8 plans fully verified)

## Performance Metrics

**Velocity:**
- Total plans completed: 1 (01-01 fully verified)
- Average duration: 11 min
- Total execution time: 0.18 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-admin-setup | 1 | 11min | 11min |

**Recent Trend:**
- Last 5 plans: 11min
- Trend: -

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

### Pending Todos

- Set up DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD in api/.env before running db:push/db:seed
- Set NEXT_PUBLIC_API_URL=http://localhost:3000 in web/.env.local for local dev

### Blockers/Concerns

- Gemini Nano Banana 2 exact API capabilities need verification before Phase 2 image generation work
- Zod 4 vs Zod 3 compatibility with fastify-type-provider-zod: RESOLVED -- use zod v3 API (standard `import { z } from 'zod'`)
- Resend free tier (100 emails/day) may require Pro plan once clients onboard
- SPF/DKIM/DMARC DNS records for mail.aisanomat.fi need 2-4 weeks of monitoring before client sends

## Session Continuity

Last session: 2026-03-02
Stopped at: Checkpoint Task 3 — human-verify full admin flow for 01-02 (Next.js admin panel)
Resume file: None
