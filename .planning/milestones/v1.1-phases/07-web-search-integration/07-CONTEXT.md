# Phase 7: Web Search Integration - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

System finds industry-specific AI news via Tavily web search that RSS feeds miss, with per-client tailored queries. Admin can configure and monitor web search per client. Results are stored alongside RSS/Beehiiv items in the shared news pool.

</domain>

<decisions>
## Implementation Decisions

### Search query design
- Auto-generate Tavily queries from client's industry field (e.g., "fintech" -> "AI fintech news")
- Admin can override the auto-generated query with a custom searchPrompt (stored on clients table)
- If searchPrompt is empty/null, system auto-generates from industry
- Run 2-3 sub-queries per client per collection for broader coverage
- Post-fetch AI relevance filter: after fetching Tavily results, use Claude or keyword check to filter out non-AI results

### Search timing & collection
- Web search runs as part of the existing daily 06:00 cron in collectAllNews()
- Only collect for clients whose digest is due within 24 hours (needs schedule awareness in collector)
- Search time range: last 7 days of results from Tavily
- Web search results stored as regular news_items in the shared pool (no per-client tagging)

### Result handling & caching
- Cache Tavily query results in a dedicated search_cache DB table with 24-hour TTL
- If same query runs again within TTL, skip the API call
- Store top 5 results per query
- URL deduplication via existing news_items unique constraint still applies
- Source type badge visible in admin news items list (RSS, Beehiiv, Web Search)

### Admin configuration UI
- Separate web search management page (not embedded in client settings)
- Page lists all clients with: web search enabled/disabled, industry, search prompt, last run time
- Shows recent search results per client (title + URL) for quality verification
- Manual "Search now" trigger button per client for testing
- Editable search prompt field per client with auto-generated default shown

### Claude's Discretion
- Exact Tavily API parameters (search depth, include domains, exclude domains)
- AI relevance filter implementation (Claude call vs keyword matching)
- How to split industry into 2-3 sub-queries
- Search cache table schema details
- Web search management page layout and styling

</decisions>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `newsCollectorService.ts`: Main collection orchestrator -- add web_search branch alongside rss/beehiiv
- `sourceHealthService.ts`: Health tracking (logFetchAttempt, updateSourceHealth, checkAutoDisable) -- will work for web search sources
- `scheduleService.ts`: Has schedule awareness (processScheduledDigests, getNextScheduledDate) -- can be queried to determine which clients are due
- URL deduplication: `onConflictDoNothing()` on news_items URL unique constraint

### Established Patterns
- Integration clients in `api/src/integrations/` -- new `tavilyClient.ts` follows same pattern as rssCollector.ts and beehiivClient.ts
- Source type enum (`sourceTypeEnum`) needs `web_search` added
- Shared Zod schemas in `packages/shared/src/schemas/source.ts` need `web_search` type
- Config JSONB pattern on news_sources for type-specific settings

### Integration Points
- `sourceTypeEnum` in `api/src/db/schema.ts` -- add 'web_search'
- `collectAllNews()` in `newsCollectorService.ts` -- add web_search branch with client-aware logic
- `clients` table -- add `searchPrompt` and `webSearchEnabled` columns
- Shared source schemas -- add 'web_search' to type enums
- `scheduler.ts` -- collection at 06:00 already exists, web search hooks in
- Admin frontend -- new web search management page + source type badges on news items
- `TAVILY_API_KEY` env var needed

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 07-web-search-integration*
*Context gathered: 2026-03-03*
