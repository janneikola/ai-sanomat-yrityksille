---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Smart Sourcing & Polish
status: complete
last_updated: "2026-03-03T16:52:16Z"
progress:
  total_phases: 9
  completed_phases: 9
  total_plans: 16
  completed_plans: 16
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03)

**Core value:** The AI-generated weekly digest must be genuinely useful and industry-relevant -- content quality is the entire selling point.
**Current focus:** v1.1 Smart Sourcing & Polish -- COMPLETE

## Current Position

Phase: 9 of 9 (X/Twitter Monitoring) -- COMPLETE
Plan: 2 of 2 in current phase (09-02 complete)
Status: v1.1 Milestone Complete
Last activity: 2026-03-03 -- Plan 09-02 complete (Admin X monitoring page, sidebar nav, dashboard budget card)

Progress: [##################] 100% (16/16 total plans across all milestones)

## Performance Metrics

**Velocity:**
- Total plans completed: 16
- Average duration: ~8 min
- Total execution time: ~2h 9min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-admin-setup | 2 | ~56min | ~28min |
| 02-content-pipeline | 2 | 9min | ~5min |
| 03-email-delivery-send-workflow | 2 | 8min | 4min |
| 04-company-portal | 2 | 7min | ~4min |
| 05-foundation-automation | 2 | 13min | ~7min |
| 06-premium-email-experience | 2 | 9min | ~5min |
| 07-web-search-integration | 1 | 5min | 5min |
| 08-semantic-deduplication | 1 | 5min | 5min |
| 09-x-twitter-monitoring | 2 | 9min | ~5min |

**Recent Trend:**
- Last 5 plans: 5min, 5min, 5min, 5min, 4min
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
- 06-01: Tailwind with pixelBasedPreset for email-safe px units (no rem in output)
- 06-01: Dark mode via CSS class selectors + @media prefers-color-scheme in Head style tag
- 06-01: Featured posts queried at render time from existing Beehiiv data -- no new collector needed
- 06-02: JWT feedback tokens with 90-day expiry and purpose='feedback' for multi-purpose token support
- 06-02: Per-member email rendering (not shared HTML) to embed unique feedback URLs per recipient
- 06-02: Satisfaction flagging requires minimum 3 votes to avoid noise from small samples
- Research: Database-driven scheduling is non-negotiable (Railway deploys destroy in-memory cron state)
- 07-01: Tavily SDK with graceful fallback (empty array when API key missing, never crash)
- 07-01: Shared "Web Search" news_source row for health tracking (not per-client sources)
- 07-01: 24h search cache TTL with queryHash as lowercase trimmed query string
- 07-01: AI relevance keyword filter with 16 Finnish+English terms
- Research: Tavily over Serper (returns extracted content in one call, no separate scraping needed)
- Research: OpenAI text-embedding-3-small for embeddings (Anthropic has no embeddings model)
- Research: pgvector in existing PostgreSQL (dataset too small for dedicated vector DB)
- Research: X API pay-per-use tier (not $200/month Basic -- budget cap in code from day one)
- 08-01: No FK constraint on canonicalItemId (self-referencing cascade complexity avoided)
- 08-01: Two-tier dedup thresholds (0.95 exact, 0.85 near-duplicate) for Finnish content tolerance
- 08-01: Embedding pipeline as post-collection step in try/catch (never blocks collection)
- 08-01: Client-side cosine similarity in getDuplicates for display (avoids extra pgvector query)
- 09-01: Apify Tweet Scraper V2 via direct HTTP (no SDK) -- matches tavilyClient pattern
- 09-01: APIFY_TOKEN env var (Apify official convention, not APIFY_API_KEY)
- 09-01: Engagement threshold for keyword search: likeCount >= 5 OR retweetCount >= 2
- 09-01: Budget cap soft: warns at 80% and 100% but never blocks fetching ($50/month default)
- 09-01: Cost formula: $0.40 per 1,000 tweets (Apify pay-per-result model)
- 09-01: dueClients query hoisted for reuse between web search and X search blocks
- 09-02: Dialog-based CRUD forms for X accounts and searches (cleaner than inline for multi-field forms)
- 09-02: AtSign icon for X-seuranta sidebar (Twitter icon deprecated after X rebrand)
- 09-02: Dashboard fetches X budget independently (not bundled into dashboard stats endpoint)
- 09-02: Dashboard grid expanded from 3-col to 4-col for X budget card

### Pending Todos

- Set up DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD in api/.env before running db:push/db:seed
- Set NEXT_PUBLIC_API_URL=http://localhost:3000 in web/.env.local for local dev
- Configure mail.aisanomat.fi domain in Resend Dashboard with SPF/DKIM/DMARC DNS records
- Set ADMIN_EMAIL in api/.env for admin notifications (defaults to admin@aisanomat.fi)
- Set TAVILY_API_KEY in api/.env for web search (https://app.tavily.com, free tier = 1,000 credits/month)
- Set OPENAI_API_KEY in api/.env for semantic deduplication (https://platform.openai.com/api-keys, $0.02/1M tokens)
- Run `cd api && npx tsx src/db/enablePgvector.ts && npx drizzle-kit push` to enable pgvector and apply schema
- Set APIFY_TOKEN in api/.env for X/Twitter collection (https://console.apify.com/account/integrations)
- Optionally set X_MONTHLY_BUDGET in api/.env (default $50/month)
- Run `npx drizzle-kit push` to apply x_account/x_search enum values and xBudgetUsage table

### Blockers/Concerns

- Resend free tier (100 emails/day) may require Pro plan once clients onboard
- SPF/DKIM/DMARC DNS records for mail.aisanomat.fi need 2-4 weeks of monitoring before client sends
- Finnish language embedding quality for text-embedding-3-small is unverified (monitor via admin dedup page, adjust 0.85 threshold if needed)
- X monitoring uses Apify ($0.40/1K tweets) -- monitor estimated vs actual Apify billing

## Session Continuity

Last session: 2026-03-03
Stopped at: Completed 09-02-PLAN.md -- v1.1 milestone complete
Resume file: N/A (all plans complete)
