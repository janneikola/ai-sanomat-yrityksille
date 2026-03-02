# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** The AI-generated weekly digest must be genuinely useful and industry-relevant -- content quality is the entire selling point.
**Current focus:** Phase 3: Email Delivery and Send Workflow

## Current Position

Phase: 3 of 4 (Email Delivery and Send Workflow) — IN PROGRESS
Plan: 1 of 2 in current phase
Status: Plan 03-01 complete (email delivery backend) -- ready for Plan 03-02
Last activity: 2026-03-02 -- Completed 03-01 (email delivery and send workflow)

Progress: [##############################################] 71% (5/7 plans fully verified)

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: ~14 min
- Total execution time: ~1.2 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-admin-setup | 2 | ~56min | ~28min |
| 02-content-pipeline | 2 | 9min | ~5min |
| 03-email-delivery-send-workflow | 1 | 5min | 5min |

**Recent Trend:**
- Last 5 plans: ~45min, 5min, 4min, 5min
- Trend: consistent fast execution

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
- 02-02: Claude structured outputs via output_config.format for guaranteed JSON -- no prompt-based extraction
- 02-02: All JSON schemas use additionalProperties: false at every object level with all properties required
- 02-02: Model ID stored as CLAUDE_MODEL env var (default: claude-sonnet-4-5-20250929) for easy updates
- 02-02: Images generated sequentially (not Promise.all) to avoid Gemini rate limits
- 02-02: Validation prompt includes all 26 humanizer AI-pattern rules inline
- 03-01: DigestEmailStory extends DigestStory with optional imageUrl -- avoids intersection type issues with TypeScript strict mode
- 03-01: Webhook processes events idempotently -- silently returns 200 if no matching deliveryStats record
- 03-01: Raw body registered global: false to avoid performance overhead on non-webhook routes
- 03-01: Dashboard stats use per-client sequential queries with SQL aggregates for clarity
- 03-01: Pino logger calls use object-first syntax ({ err }, message) per Fastify strict typing

### Pending Todos

- Set up DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD in api/.env before running db:push/db:seed
- Set NEXT_PUBLIC_API_URL=http://localhost:3000 in web/.env.local for local dev
- Set BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID in api/.env for Beehiiv source collection
- Set ANTHROPIC_API_KEY in api/.env for Claude digest generation
- Set GEMINI_API_KEY in api/.env for Gemini image generation
- Optional: Set IMAGE_STORAGE_PATH (default: ./uploads) and CLAUDE_MODEL (default: claude-sonnet-4-5-20250929)
- Set RESEND_API_KEY in api/.env for Resend email sending
- Set RESEND_WEBHOOK_SECRET in api/.env for webhook signature verification
- Configure mail.aisanomat.fi domain in Resend Dashboard with SPF/DKIM/DMARC DNS records

### Blockers/Concerns

- Gemini Nano Banana 2 exact API capabilities: RESOLVED -- using gemini-2.5-flash-preview-05-20 with @google/genai SDK
- Zod 4 vs Zod 3 compatibility with fastify-type-provider-zod: RESOLVED -- use zod v3 API (standard `import { z } from 'zod'`)
- Resend free tier (100 emails/day) may require Pro plan once clients onboard
- SPF/DKIM/DMARC DNS records for mail.aisanomat.fi need 2-4 weeks of monitoring before client sends

## Session Continuity

Last session: 2026-03-02
Stopped at: Completed 03-01-PLAN.md -- Email delivery backend complete, ready for Plan 03-02
Resume file: None
