---
phase: 07-web-search-integration
plan: 01
subsystem: api, ui
tags: [tavily, web-search, caching, news-collection, drizzle, fastify, react]

# Dependency graph
requires:
  - phase: 02-content-pipeline
    provides: "News collection pipeline, RSS/Beehiiv collectors, newsItems table"
  - phase: 05-foundation-automation
    provides: "Scheduling service with isDueToday, source health tracking"
provides:
  - "Tavily web search integration in news collection pipeline"
  - "Per-client search prompt configuration with auto-generation"
  - "Search result caching (24h TTL) in searchCache table"
  - "AI relevance keyword filtering for web search results"
  - "Admin web search management page with toggle, prompt editor, manual trigger"
  - "Admin API routes for web search config and triggering"
affects: [08-smart-ranking, 09-x-monitoring]

# Tech tracking
tech-stack:
  added: ["@tavily/core (web search API SDK)"]
  patterns: ["24h search cache with queryHash dedup", "client-aware search query generation", "keyword-based AI relevance filtering"]

key-files:
  created:
    - api/src/integrations/tavilyClient.ts
    - api/src/services/webSearchService.ts
    - api/src/routes/webSearch.ts
    - web/src/app/(admin)/web-search/page.tsx
  modified:
    - api/src/db/schema.ts
    - api/src/services/newsCollectorService.ts
    - api/src/app.ts
    - api/package.json
    - packages/shared/src/schemas/source.ts
    - packages/shared/src/schemas/client.ts
    - web/src/components/app-sidebar.tsx
    - web/src/components/sources/source-form.tsx

key-decisions:
  - "Tavily SDK @tavily/core with graceful fallback when API key missing (return empty array, not crash)"
  - "Shared Web Search news_source row for health tracking rather than per-client sources"
  - "24h cache TTL with queryHash as lowercase trimmed query string"
  - "Keyword-based AI relevance filter with Finnish+English terms (16 keywords)"

patterns-established:
  - "Web search integration: thin SDK wrapper -> service with caching -> news collector loop"
  - "Client-aware search: auto-generate queries from industry or use custom searchPrompt"

requirements-completed: [SRC-03, SRC-04]

# Metrics
duration: 5min
completed: 2026-03-03
---

# Phase 7 Plan 1: Web Search Integration Summary

**Tavily web search with per-client industry queries, 24h caching, AI relevance filtering, and admin management UI**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-03T13:05:34Z
- **Completed:** 2026-03-03T13:10:56Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Tavily SDK integration with graceful missing API key handling
- Web search service with query generation, 24h caching, and AI relevance filtering
- News collector pipeline extended with client-aware web search loop for due clients
- Admin API routes for listing clients with search config, triggering searches, updating config
- Admin web search management page with per-client toggle, prompt editor, manual trigger, and recent results display

## Task Commits

Each task was committed atomically:

1. **Task 1: Tavily client, web search service, DB schema, API routes, and collection pipeline integration** - `be0133a` (feat)
2. **Task 2: Admin web search management page with client table, search prompt editor, and manual trigger** - `047ee06` (feat)

## Files Created/Modified
- `api/src/integrations/tavilyClient.ts` - Tavily SDK wrapper with TavilyResult interface
- `api/src/services/webSearchService.ts` - Query generation, caching, relevance filter, search orchestration
- `api/src/routes/webSearch.ts` - Admin API: list clients, trigger search, update config
- `web/src/app/(admin)/web-search/page.tsx` - Admin web search management page
- `api/src/db/schema.ts` - Added searchCache table, web_search sourceType, client web search columns
- `api/src/services/newsCollectorService.ts` - Added web search loop after source collection
- `api/src/app.ts` - Registered web search routes
- `api/package.json` - Added @tavily/core dependency
- `packages/shared/src/schemas/source.ts` - Added web_search to source type enums
- `packages/shared/src/schemas/client.ts` - Added webSearchEnabled, searchPrompt, lastWebSearchAt fields
- `web/src/components/app-sidebar.tsx` - Added Verkkohaku nav item
- `web/src/components/sources/source-form.tsx` - Fixed type narrowing for web_search source type

## Decisions Made
- Tavily SDK with graceful fallback: returns empty array when TAVILY_API_KEY missing, never crashes
- Shared "Web Search" news_source row for health tracking (find-or-create pattern)
- 24h cache TTL with queryHash = lowercase trimmed query string for dedup
- AI relevance keyword filter with 16 Finnish+English keywords covering AI, ML, robotics, automation
- isDueWithin24Hours checks both today and tomorrow to ensure pre-fetch timing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed source-form.tsx type narrowing for web_search type**
- **Found during:** Task 2 (Next.js build verification)
- **Issue:** Adding 'web_search' to source type enum caused TS error in source-form.tsx where useState was narrowed to only 'rss' | 'beehiiv' | 'manual'
- **Fix:** Widened type parameter and cast to include 'web_search'
- **Files modified:** web/src/components/sources/source-form.tsx
- **Verification:** Next.js build passes cleanly
- **Committed in:** 047ee06 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor type fix necessary for build to pass after enum extension. No scope creep.

## Issues Encountered
None

## User Setup Required

Environment variable needed for Tavily API:
- `TAVILY_API_KEY` - Get from https://app.tavily.com -> API Keys -> Copy key (free tier = 1,000 credits/month)
- Without this key, web search gracefully returns empty results (system does not crash)

## Next Phase Readiness
- Web search pipeline operational, ready for smart ranking (Phase 8) to prioritize search results
- searchCache table available for ranking pipeline to reference original search scores
- Client web search configuration ready for production use once TAVILY_API_KEY is set

---
*Phase: 07-web-search-integration*
*Completed: 2026-03-03*
