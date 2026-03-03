# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03)

**Core value:** The AI-generated weekly digest must be genuinely useful and industry-relevant -- content quality is the entire selling point.
**Current focus:** v1.1 Smart Sourcing & Polish -- Phase 6: Premium Email Experience

## Current Position

Phase: 6 of 9 (Premium Email Experience)
Plan: 1 of 2 in current phase
Status: Ready
Last activity: 2026-03-03 -- Plan 05-02 complete (admin UI for schedule, health, scheduler history)

Progress: [##########........] 67% (10/15 total plans across all milestones)

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: ~10 min
- Total execution time: ~1.6 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-admin-setup | 2 | ~56min | ~28min |
| 02-content-pipeline | 2 | 9min | ~5min |
| 03-email-delivery-send-workflow | 2 | 8min | 4min |
| 04-company-portal | 2 | 7min | ~4min |
| 05-foundation-automation | 2 | 13min | ~7min |

**Recent Trend:**
- Last 5 plans: 4min, 3min, 8min, 5min
- Trend: consistent fast execution

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v1.1 Roadmap: 5 phases (quick depth), scheduling+health first, template+feedback together, X monitoring last (highest cost/complexity)
- 05-01: Pure functions for isDueToday/getPeriodNumber/computeHealthStatus enable unit testing without DB
- 05-01: Dynamic import for generateClientDigest avoids circular dependency in scheduleService
- 05-01: Admin notification errors silently caught to never block scheduling pipeline
- 05-01: Source health columns co-located on newsSources (not separate table) for query simplicity
- 05-02: Health filtering via API query param (compute in service, filter in route handler) for clean separation
- 05-02: Expandable table rows for health logs keeps source list as single page view
- 05-02: Inline schedule config on client detail page (not dialog) for direct editing
- Research: Database-driven scheduling is non-negotiable (Railway deploys destroy in-memory cron state)
- Research: Tavily over Serper (returns extracted content in one call, no separate scraping needed)
- Research: OpenAI text-embedding-3-small for embeddings (Anthropic has no embeddings model)
- Research: pgvector in existing PostgreSQL (dataset too small for dedicated vector DB)
- Research: X API pay-per-use tier (not $200/month Basic -- budget cap in code from day one)

### Pending Todos

- Set up DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD in api/.env before running db:push/db:seed
- Set NEXT_PUBLIC_API_URL=http://localhost:3000 in web/.env.local for local dev
- Configure mail.aisanomat.fi domain in Resend Dashboard with SPF/DKIM/DMARC DNS records
- Set ADMIN_EMAIL in api/.env for admin notifications (defaults to admin@aisanomat.fi)
- New for v1.1: X_BEARER_TOKEN, TAVILY_API_KEY, OPENAI_API_KEY env vars needed in later phases

### Blockers/Concerns

- Resend free tier (100 emails/day) may require Pro plan once clients onboard
- SPF/DKIM/DMARC DNS records for mail.aisanomat.fi need 2-4 weeks of monitoring before client sends
- Finnish language embedding quality for text-embedding-3-small is unverified (Phase 8 concern)
- X API pay-per-use pricing details may have evolved since Feb 2026 launch (Phase 9 concern)

## Session Continuity

Last session: 2026-03-03
Stopped at: Completed 05-02-PLAN.md -- Phase 5 complete, ready for Phase 6
Resume file: None
