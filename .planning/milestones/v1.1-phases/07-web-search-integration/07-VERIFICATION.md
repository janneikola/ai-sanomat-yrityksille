---
phase: 07-web-search-integration
verified: 2026-03-03T13:30:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Trigger manual web search for a client with TAVILY_API_KEY set"
    expected: "POST /api/admin/web-search/:clientId/trigger returns { collected, queries, cached } with non-zero collected count and stores items in news_items"
    why_human: "Requires live Tavily API key and running database; cannot verify actual HTTP response or DB insertion programmatically from static analysis"
  - test: "Toggle web search enabled/disabled for a client in admin UI"
    expected: "Switch state updates immediately, PUT /api/admin/web-search/:clientId/config succeeds, subsequent GET reflects the change"
    why_human: "Requires running frontend and API; UI interaction and network round-trip"
  - test: "Edit and save a custom search prompt via admin UI (blur or Enter)"
    expected: "Input saves on blur or Enter key press, toast confirms 'Hakukysely paivitetty', client list shows updated prompt"
    why_human: "Requires running frontend; keyboard/focus event behavior cannot be verified statically"
---

# Phase 7: Web Search Integration Verification Report

**Phase Goal:** System finds industry-specific AI news via web search that RSS feeds miss, with per-client tailored queries
**Verified:** 2026-03-03T13:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | System fetches AI news via Tavily web search and stores results as news_items alongside RSS/Beehiiv items | VERIFIED | `webSearchService.ts:searchForClient` inserts into `newsItems` table via `db.insert(newsItems).values({...}).onConflictDoNothing()` (lines 186-198); `newsCollectorService.ts` integrates results into shared `collected` counter (line 118) |
| 2 | Admin can configure per-client industry search prompts that drive Tavily queries | VERIFIED | `webSearch.ts` PUT `/web-search/:clientId/config` updates `webSearchEnabled` and `searchPrompt` (lines 110-159); `webSearchService.ts:generateSearchQueries` uses `client.searchPrompt` if set, otherwise auto-generates from `client.industry` (lines 18-33) |
| 3 | Web search only runs for clients whose digest is due within 24 hours | VERIFIED | `newsCollectorService.ts` filters clients via `isDueWithin24Hours(c.scheduleFrequency, c.scheduleDay, c.scheduleBiweeklyWeek)` (lines 98-100) after querying only active, webSearchEnabled, non-paused clients (lines 87-96) |
| 4 | Tavily results are cached for 24 hours to avoid redundant API calls | VERIFIED | `webSearchService.ts:searchWithCache` checks `searchCache` table for matching `queryHash` with `cachedAt` within last 24 hours before calling `searchTavily` (lines 63-100); cache miss inserts new row |
| 5 | Non-AI results are filtered out via keyword relevance check | VERIFIED | `webSearchService.ts:isAIRelevant` checks lowercase title+content against 16 Finnish+English keywords (lines 38-41); `searchForClient` applies filter at lines 181-182 |
| 6 | Admin can manually trigger a web search per client and see recent results | VERIFIED | `webSearch.ts` POST `/web-search/:clientId/trigger` calls `searchForClient` and returns `{ collected, queries, cached }` (lines 78-108); GET `/web-search/clients` returns last 5 `searchCache` entries per client (lines 41-74); `web-search/page.tsx` renders results as expandable clickable links (lines 269-292) |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/src/integrations/tavilyClient.ts` | Tavily SDK wrapper with typed TavilyResult interface | VERIFIED | 52 lines; exports `searchTavily` and `TavilyResult`; graceful fallback when `TAVILY_API_KEY` missing (returns `[]`, logs warning) |
| `api/src/services/webSearchService.ts` | Query generation, caching, relevance filter, search orchestration | VERIFIED | 217 lines; exports `generateSearchQueries`, `isAIRelevant`, `isDueWithin24Hours`, `searchWithCache`, `searchForClient` |
| `api/src/db/schema.ts` | searchCache table, webSearchEnabled/searchPrompt/lastWebSearchAt on clients, web_search in sourceTypeEnum | VERIFIED | `sourceTypeEnum` line 14 includes `'web_search'`; `clients` table has `webSearchEnabled` (line 51), `searchPrompt` (line 52), `lastWebSearchAt` (line 53); `searchCache` table defined at lines 180-188 |
| `api/src/routes/webSearch.ts` | Admin API: list clients with search config, trigger search, update search config | VERIFIED | 163 lines; implements GET `/web-search/clients`, POST `/web-search/:clientId/trigger`, PUT `/web-search/:clientId/config`; all routes use `onRequest: [fastify.authenticate]` |
| `web/src/app/(admin)/web-search/page.tsx` | Admin web search management page | VERIFIED | 313 lines (exceeds 80 minimum); full client table with toggle, prompt editor, manual trigger, recent results; uses `apiFetch`, `sonner` toasts, `Loader2` spinner |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `api/src/services/newsCollectorService.ts` | `api/src/services/webSearchService.ts` | `collectAllNews` calls `searchForClient` for due clients | WIRED | Import at line 12; `searchForClient(client.id)` called at line 104 |
| `api/src/services/webSearchService.ts` | `api/src/integrations/tavilyClient.ts` | `searchWithCache` calls `searchTavily` when cache miss | WIRED | Import at line 4; `searchTavily(query)` called at line 88 |
| `api/src/services/webSearchService.ts` | `api/src/db/schema.ts` | reads/writes `searchCache` table | WIRED | `searchCache` imported from schema at line 3; read at lines 73-81, written at lines 91-97, read again at lines 163-169 |
| `web/src/app/(admin)/web-search/page.tsx` | `api/src/routes/webSearch.ts` | fetch calls to `/api/admin/web-search` endpoints | WIRED | `apiFetch('/api/admin/web-search/clients')` at line 69; `apiFetch('/api/admin/web-search/${clientId}/config', {method:'PUT'})` at lines 85, 103; `apiFetch('/api/admin/web-search/${clientId}/trigger', {method:'POST'})` at line 125 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| SRC-03 | 07-01-PLAN.md | System searches web via Tavily for industry-specific AI news per client | SATISFIED | `tavilyClient.ts` wraps Tavily SDK; `webSearchService.ts:searchForClient` executes per-client queries; `newsCollectorService.ts` runs for due clients daily |
| SRC-04 | 07-01-PLAN.md | Admin can configure per-client industry search prompts for Tavily queries | SATISFIED | `webSearch.ts` PUT endpoint updates `searchPrompt` on client; `generateSearchQueries` uses custom prompt or falls back to auto-generated; admin UI provides editable input field with auto-generated placeholder |

No orphaned requirements found. REQUIREMENTS.md traceability table maps both SRC-03 and SRC-04 exclusively to Phase 7.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `api/src/integrations/tavilyClient.ts` | 17, 35 | `return null` / `return []` | INFO | Legitimate graceful fallback when `TAVILY_API_KEY` is not set — this is intentional design, not a stub |
| `web/src/app/(admin)/web-search/page.tsx` | 159 | `return []` | INFO | In `parseResults()` error handler — legitimate JSON parse error guard |
| `web/src/app/(admin)/web-search/page.tsx` | 230 | `placeholder=` | INFO | Input placeholder showing auto-generated query format — correct UX, not a TODO |

No blocker or warning anti-patterns found. All flagged patterns are intentional.

### Human Verification Required

#### 1. Live Tavily API Search Trigger

**Test:** Set `TAVILY_API_KEY` env var, start API server, POST to `/api/admin/web-search/:clientId/trigger` for a client with `webSearchEnabled=true`
**Expected:** Response `{ collected: N, queries: 3, cached: 0 }` where N >= 0; news_items table contains new rows with `sourceId` pointing to the "Web Search" news_source
**Why human:** Requires live Tavily API credentials and running PostgreSQL; static analysis cannot verify network response or actual DB insertion

#### 2. Admin UI Toggle Interaction

**Test:** Open `/web-search` in admin panel, toggle the web search switch for a client
**Expected:** Switch responds immediately; toast confirms enable/disable; page state updates without full reload
**Why human:** Requires running Next.js dev server and browser; UI interaction and state update cannot be verified statically

#### 3. Search Prompt Save on Blur/Enter

**Test:** Click into the search prompt input for any client, type a custom query, press Enter or click away
**Expected:** `PUT /api/admin/web-search/:clientId/config` fires, toast shows "Hakukysely paivitetty", input shows saved value on next render
**Why human:** Requires running frontend; focus/blur/keyboard events require browser

### Gaps Summary

No gaps. All 6 observable truths are verified, all 5 required artifacts exist and are substantive (non-stub), all 4 key links are wired, and both requirement IDs (SRC-03, SRC-04) are satisfied with concrete implementation evidence.

---

_Verified: 2026-03-03T13:30:00Z_
_Verifier: Claude (gsd-verifier)_
