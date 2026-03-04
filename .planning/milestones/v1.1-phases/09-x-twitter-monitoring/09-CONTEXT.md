# Phase 9: X/Twitter Monitoring - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

System collects breaking AI news from X influencer accounts and keyword searches via Apify, stores them as news items for digest generation, tracks API costs with a monthly budget cap, and provides admin UI for managing X sources and monitoring usage. Reddit integration and sentiment analysis are separate concerns.

</domain>

<decisions>
## Implementation Decisions

### X API approach
- Use Apify Tweet Scraper (not official X API v2) — already in the stack via x-reader skill
- Direct HTTP calls to Apify API (no @apify/client SDK) — matches existing Python skill pattern
- Synchronous actor runs (wait for results with timeout) — simpler, sufficient for 10-25 accounts
- Researcher should evaluate best Apify actor (apidojo/tweet-scraper vs alternatives) during research phase

### Fetch schedule
- Influencer timeline fetches run daily alongside RSS/Beehiiv in existing daily cron
- Keyword searches run on-demand before digest generation (within 24h of due date) — matches web search pattern
- Both use since_id pagination to avoid re-fetching old posts

### Source configuration
- One news_sources row per influencer account: type='x_account', config={handle, description, includeReplies, minLikes}
- One news_sources row per keyword query: type='x_search', config={query, language}
- Individual health tracking per source (reuses existing source health system)
- Separate admin page at (admin)/x-monitoring/ — not mixed into existing sources page
- Expected initial scale: 10-25 influencer accounts

### Budget tracking
- Fixed monthly dollar amount cap (default $50/month), admin-configurable
- Track estimated cost per Apify run
- At cap: warn with dashboard alert and log warnings, but continue fetching (no hard stop)
- Budget visible on main admin dashboard (summary card) + detailed breakdown on X monitoring page
- Monthly reset of usage counter

### Content filtering
- Collect ALL posts from influencer accounts (they're curated for AI relevance) — no keyword filter on influencer posts
- Original posts only — skip retweets and replies
- Keyword searches: apply minimum engagement threshold (likes/retweets) to filter spam
- X posts stored in news_items: title = first ~100 chars of post, summary = full post text, url = tweet link

### Claude's Discretion
- Exact engagement threshold numbers for keyword search filtering
- Apify run timeout duration
- Error retry strategy for failed Apify runs
- Exact cost estimation formula per run
- Budget warning threshold percentage

</decisions>

<specifics>
## Specific Ideas

- Influencer list is global (shared across all clients) — collected once, digest AI picks relevant posts per client's industry
- Keyword searches are per-client (tied to client context, run on-demand like web search)
- Config JSON includes per-account filters (includeReplies, minLikes) for future flexibility

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `newsCollectorService.ts`: Main collection dispatcher — add x_account handling in the source type switch
- `webSearchService.ts`: Pattern for on-demand per-client collection with isDueWithin24Hours check — reuse for keyword searches
- `sourceHealthService.ts`: Full health tracking (logFetchAttempt, updateSourceHealth, checkAutoDisable) — works for X sources out of the box
- `tavilyClient.ts`: Pattern for thin integration client with lazy initialization and env var check
- Source Zod schemas in `packages/shared/src/schemas/source.ts`: Need to add 'x_account' and 'x_search' to type enum
- `(admin)/web-search/page.tsx`: Pattern for dedicated admin page with source-specific management

### Established Patterns
- Source type enum in schema.ts: pgEnum with string values — add 'x_account', 'x_search'
- Config as JSON string in news_sources.config column — parse per type
- news_items table with url unique constraint — tweet URLs for deduplication
- Drizzle ORM for all DB operations
- Fastify + Zod type provider for routes

### Integration Points
- `api/src/db/schema.ts`: Add new source types to sourceTypeEnum
- `api/src/integrations/`: New xClient.ts for Apify HTTP calls
- `api/src/services/newsCollectorService.ts`: Add x_account collection in daily loop
- `api/src/services/`: New xSearchService.ts for keyword search (like webSearchService.ts)
- `api/src/routes/`: New xMonitoring.ts route file for admin CRUD + budget endpoints
- `web/src/app/(admin)/x-monitoring/page.tsx`: New admin page
- `packages/shared/src/schemas/source.ts`: Extend type enum

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-x-twitter-monitoring*
*Context gathered: 2026-03-03*
