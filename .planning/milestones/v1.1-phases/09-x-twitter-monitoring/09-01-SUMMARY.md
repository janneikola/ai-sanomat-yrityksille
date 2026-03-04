---
phase: 09-x-twitter-monitoring
plan: 01
subsystem: api
tags: [apify, twitter, x, budget-tracking, fastify, drizzle]

# Dependency graph
requires:
  - phase: 07-web-search-integration
    provides: "webSearchService on-demand pattern, newsCollectorService pipeline, tavilyClient integration pattern"
  - phase: 08-semantic-deduplication
    provides: "processNewEmbeddings post-collection hook, pgvector embedding pipeline"
provides:
  - "Apify Tweet Scraper V2 HTTP client (xClient.ts)"
  - "X influencer timeline collection service (xCollectorService.ts)"
  - "X per-client keyword search service (xSearchService.ts)"
  - "X budget tracking service (xBudgetService.ts)"
  - "Admin CRUD + budget API routes at /api/admin/x-monitoring/*"
  - "x_account and x_search source types in schema"
  - "xBudgetUsage table for Apify cost tracking"
affects: [admin-ui, x-monitoring-frontend]

# Tech tracking
tech-stack:
  added: [apify-rest-api-v2]
  patterns: [direct-http-integration, soft-budget-cap, dual-source-type-pattern]

key-files:
  created:
    - api/src/integrations/xClient.ts
    - api/src/services/xCollectorService.ts
    - api/src/services/xSearchService.ts
    - api/src/services/xBudgetService.ts
    - api/src/routes/xMonitoring.ts
  modified:
    - api/src/db/schema.ts
    - packages/shared/src/schemas/source.ts
    - api/src/services/newsCollectorService.ts
    - api/src/app.ts

key-decisions:
  - "Apify Tweet Scraper V2 via direct HTTP (no SDK) -- matches tavilyClient pattern"
  - "Engagement threshold for keyword search: likeCount >= 5 OR retweetCount >= 2 (low to catch breaking news)"
  - "Budget cap soft: warns at 80% and 100% but never blocks fetching"
  - "Cost formula: $0.40 per 1,000 tweets (Apify pay-per-result model)"
  - "APIFY_TOKEN env var (Apify official convention, not APIFY_API_KEY)"
  - "dueClients query hoisted out of web search block for reuse by X search"

patterns-established:
  - "Soft budget cap pattern: track costs, warn at thresholds, never block operations"
  - "Dual source type pattern: x_account (global daily collection) + x_search (per-client on-demand)"
  - "Tweet URL normalization: always x.com/{user}/status/{id} format"

requirements-completed: [SRC-01, SRC-02, SRC-06, SRC-07]

# Metrics
duration: 5min
completed: 2026-03-03
---

# Phase 9 Plan 01: X/Twitter Monitoring Summary

**Apify Tweet Scraper V2 integration with influencer daily collection, per-client keyword search, budget tracking at $0.40/1K tweets, and admin CRUD API routes**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-03T16:39:10Z
- **Completed:** 2026-03-03T16:44:10Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Complete Apify integration client with graceful degradation when APIFY_TOKEN not set
- X influencer collection integrated into daily cron pipeline alongside RSS/Beehiiv
- Per-client keyword search matching web search on-demand pattern for due clients
- Budget tracking with soft $50/month cap, 80% warning threshold, and 6-month history
- Full admin CRUD for both x_account and x_search source types via 10 API routes
- Existing source health tracking and deduplication work out of the box with X posts

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema, Apify client, and collection services** - `2fcc445` (feat)
2. **Task 2: API routes, pipeline integration, route registration** - `c720498` (feat)

## Files Created/Modified
- `api/src/db/schema.ts` - Extended sourceTypeEnum with x_account/x_search, added xBudgetUsage table
- `packages/shared/src/schemas/source.ts` - Extended Zod type enums with new source types
- `api/src/integrations/xClient.ts` - Apify Tweet Scraper V2 HTTP client (fetchTweetsByHandle, searchTweets)
- `api/src/services/xCollectorService.ts` - Influencer timeline collection with tweet filtering and URL normalization
- `api/src/services/xSearchService.ts` - Per-client keyword search with engagement threshold filtering
- `api/src/services/xBudgetService.ts` - Budget tracking with recordBudgetUsage, checkBudget, getBudgetSummary
- `api/src/routes/xMonitoring.ts` - 10 admin API routes (CRUD accounts, CRUD searches, budget, trigger)
- `api/src/services/newsCollectorService.ts` - Added X collection and search integration into collectAllNews pipeline
- `api/src/app.ts` - Registered xMonitoringRoutes at /api/admin prefix

## Decisions Made
- Used APIFY_TOKEN (Apify official convention) instead of APIFY_API_KEY from x-reader skill
- Set engagement threshold at likeCount >= 5 OR retweetCount >= 2 for keyword searches -- low enough to catch breaking news before it goes viral
- Budget warning at 80% ($40 of $50 default) -- logged to console, visible via /x-monitoring/budget API
- Hoisted dueClients query out of the web search try-catch block so both web search and X search share the same due client list
- Cost estimation based on actual tweets received (not requested) for accuracy

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
- Set `APIFY_TOKEN` in api/.env for X/Twitter collection (https://console.apify.com/account/integrations)
- Optionally set `X_MONTHLY_BUDGET` in api/.env (default $50/month)
- Run `npx drizzle-kit push` to add x_account/x_search enum values and xBudgetUsage table to database

## Next Phase Readiness
- Backend complete -- ready for admin UI page at (admin)/x-monitoring/
- All 10 API routes available for frontend consumption
- Budget and health tracking operational from first X collection run

## Self-Check: PASSED

All 5 created files verified present. Both task commits (2fcc445, c720498) verified in git log. TypeScript compiles cleanly with zero errors.

---
*Phase: 09-x-twitter-monitoring*
*Completed: 2026-03-03*
