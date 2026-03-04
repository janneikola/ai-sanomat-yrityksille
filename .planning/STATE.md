---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Newsletter Quality & Design
status: active
last_updated: "2026-03-04"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** The AI-generated weekly digest must be genuinely useful and industry-relevant -- content quality is the entire selling point.
**Current focus:** v1.2 Newsletter Quality & Design

## Current Position

Phase: Not started (defining requirements)
Status: Defining requirements
Last activity: 2026-03-04 — Milestone v1.2 started

## Milestones

- ✅ v1.0 Full Platform — Phases 1-4 (shipped 2026-03-03)
- ✅ v1.1 Smart Sourcing & Polish — Phases 5-9 (shipped 2026-03-04)
- ◆ v1.2 Newsletter Quality & Design — Phases 10+ (active)

## Accumulated Context

### Pending Todos

- Set up DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD in api/.env before running db:push/db:seed
- Set NEXT_PUBLIC_API_URL=http://localhost:3000 in web/.env.local for local dev
- Configure mail.aisanomat.fi domain in Resend Dashboard with SPF/DKIM/DMARC DNS records
- Set ADMIN_EMAIL in api/.env for admin notifications (defaults to admin@aisanomat.fi)
- Set TAVILY_API_KEY in api/.env for web search
- Set OPENAI_API_KEY in api/.env for semantic deduplication
- Run `cd api && npx tsx src/db/enablePgvector.ts && npx drizzle-kit push` to enable pgvector and apply schema
- Set APIFY_TOKEN in api/.env for X/Twitter collection
- Fix INT-01: Health dot key mismatch in X monitoring page
- Fix INT-02: Duplicate items not filtered during digest generation

### Blockers/Concerns

- Resend free tier (100 emails/day) may require Pro plan once clients onboard
- SPF/DKIM/DMARC DNS records for mail.aisanomat.fi need 2-4 weeks of monitoring before client sends
- Finnish language embedding quality for text-embedding-3-small is unverified
- X monitoring uses Apify ($0.40/1K tweets) -- monitor estimated vs actual Apify billing

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 001 | Add user management to customer where admin user for the company can add recipients for the newsletter | 2026-03-04 | c977f51 | [001-add-user-mgmt-newsletter-recipients](./quick/001-add-user-mgmt-newsletter-recipients/) |

### Decisions

- Admin member endpoints reuse portal member route patterns with admin auth (quick-001)
- Admin sees all members including inactive for full visibility (quick-001)

## Session Continuity

Last session: 2026-03-04
Stopped at: Completed quick-001 (admin member management)
Resume file: N/A
