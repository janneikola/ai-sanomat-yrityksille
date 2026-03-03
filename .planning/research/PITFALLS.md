# Pitfalls Research

**Domain:** Adding multi-source intelligence, auto-scheduling, semantic deduplication, premium email design, and feedback loops to an existing Node.js newsletter platform (AI-Sanomat Yrityksille v1.1)
**Researched:** 2026-03-03
**Confidence:** MEDIUM-HIGH (verified against official docs, API pricing pages, and community discussions)

## Critical Pitfalls

### Pitfall 1: X API Cost Shock from the Basic-to-Pro Pricing Cliff

**What goes wrong:**
The X API Basic tier costs $200/month but only allows 15,000 tweet reads per month. If you monitor 20 influencer accounts and run keyword searches daily, you can burn through 15,000 reads in under a week. The next tier (Pro) is $5,000/month -- a 25x price jump with nothing in between. Teams discover this mid-development or, worse, mid-production and face either crippling the feature or an unexpected $5,000/month bill.

**Why it happens:**
Developers estimate API usage based on a single test run, not sustained production use. Monitoring 20 accounts x 30 tweets each x daily = 600 reads/day = 18,000/month -- already over the Basic limit. Adding keyword search queries compounds this rapidly.

**How to avoid:**
- Calculate exact monthly read budget before writing any X integration code: `(accounts x avg_tweets_per_check x checks_per_day x 30) + (keyword_searches_per_day x results_per_search x 30)`
- Design the X collector with a hard daily budget cap in code (e.g., max 400 reads/day = 12,000/month, leaving 3,000 buffer)
- Cache aggressively: store the latest tweet ID per account and use `since_id` to only fetch new tweets
- Consider the new pay-as-you-go pricing (launched Feb 2026) as an alternative to the fixed Basic tier
- Evaluate third-party X data providers which may offer better read-per-dollar ratios
- Run influencer account checks once daily (not hourly) to minimize read consumption

**Warning signs:**
- No budget calculation document exists before X integration starts
- X collector makes more than 500 API calls per day on Basic tier
- Monthly tweet read count approaches 10,000 by mid-month

**Phase to address:**
Phase 1 (X Monitoring) -- budget calculation must be a prerequisite before any code is written

---

### Pitfall 2: Dual Rate Limit System on X API Causes Silent Data Loss

**What goes wrong:**
The X API enforces TWO separate limit types: per-15-minute request rate limits (e.g., 450 requests/15min for recent search) AND monthly post consumption limits (15,000 reads on Basic). Developers handle the 429 rate-limit response (request limit) but never track the monthly consumption quota. The app hits the monthly limit mid-month and silently stops receiving new tweets, causing newsletters to miss important AI news for the remainder of the month.

**Why it happens:**
HTTP 429 responses from per-15-minute limits are obvious and well-documented. Monthly quotas are tracked in the X developer dashboard, not in API error responses until you actually hit them. The error format differs from standard rate limiting.

**How to avoid:**
- Implement a `monthlyBudgetTracker` that counts consumed tweet reads in the database, independent of X API's own tracking
- Set a daily budget ceiling: `Math.floor(monthlyLimit * 0.8 / 30)` -- use 80% of monthly limit spread evenly with 20% reserve
- Log every X API read count and expose it in the admin dashboard
- Set up alerts when 50% and 75% of monthly budget is consumed
- When budget is exhausted, the system must still function using RSS and web search sources -- X is supplementary, not critical path

**Warning signs:**
- No monthly consumption tracking in the codebase
- Missing news items in the second half of the month
- Admin has no visibility into API usage

**Phase to address:**
Phase 1 (X Monitoring) -- budget tracking must be baked into the X client from day one

---

### Pitfall 3: Semantic Deduplication Threshold Miscalibration Kills Either Recall or Precision

**What goes wrong:**
Setting the cosine similarity threshold wrong produces one of two disasters: too high (e.g., 0.95) and near-duplicates slip through, so newsletters contain essentially the same story twice with slightly different wording. Too low (e.g., 0.70) and genuinely different stories about the same topic get deduplicated, causing the newsletter to miss important coverage angles.

**Why it happens:**
AI news articles about the same topic from different sources often have cosine similarity between 0.75-0.90. The "right" threshold varies by embedding model and content domain. Developers pick a threshold from a tutorial, never calibrate it against real data, and ship it.

**How to avoid:**
- Build a calibration dataset BEFORE choosing a threshold: collect 50 pairs of articles where you manually label "same story" vs "different story about same topic" vs "unrelated"
- Test multiple thresholds (0.80, 0.85, 0.90) against this dataset and pick the one that matches human judgment
- Use a two-tier system: similarity > 0.92 = auto-deduplicate, similarity 0.80-0.92 = flag for admin review, similarity < 0.80 = definitely different
- Store the similarity score so you can retroactively adjust the threshold without re-processing
- Always deduplicate by URL first (current system already does this via `onConflictDoNothing` on the URL unique constraint), then apply semantic deduplication as a second pass
- Only compare articles within the same collection window (last 14 days), not the entire corpus

**Warning signs:**
- No calibration dataset exists
- Threshold was chosen from a blog post without testing on actual AI news articles
- Admin cannot see which articles were deduplicated and why
- Newsletter still contains near-duplicate stories after dedup is "working"

**Phase to address:**
Phase 3 (Semantic Deduplication) -- calibration dataset should be built from actual collected news during Phases 1-2

---

### Pitfall 4: Premium Email Template Redesign Breaks in Outlook and Dark Mode

**What goes wrong:**
A beautiful premium template is designed with modern CSS (flexbox, grid, CSS variables, media queries), tested in Gmail/Apple Mail, looks great. Then it arrives in a corporate Outlook client (60%+ of enterprise email users) and the layout is completely broken: images overlap, columns collapse wrong, fonts revert, dark mode inverts brand colors making logos invisible.

**Why it happens:**
Outlook uses Microsoft Word's rendering engine, not a browser engine. It ignores CSS flexbox, grid, media queries, and many standard properties. Dark mode handling varies wildly between email clients -- Gmail, Apple Mail, and Outlook all handle `prefers-color-scheme` differently or not at all. Enterprise clients (the target audience for AI-Sanomat) overwhelmingly use Outlook.

**How to avoid:**
- Use table-based layout for ALL structural elements -- React Email's `<Section>`, `<Row>`, `<Column>` components compile to tables, which is correct behavior
- Test every template change in Litmus or Email on Acid (90+ email client previews) before deploying
- Provide a dark-mode version of the AI-Sanomat logo (light version for dark backgrounds)
- Use transparent PNG logos with sufficient padding/contrast for both modes
- Inline ALL CSS -- the current `DigestEmail.tsx` already uses inline styles (good), keep this pattern
- Set explicit `width` attributes on all table cells, not just CSS width
- Maximum email width: 600px (current template already does this correctly)
- Test with actual enterprise Outlook desktop clients, not just Outlook.com webmail
- Verify the compiled HTML output of React Email components before trusting the JSX preview
- CSS `border` width cannot exceed 8px in Windows Outlook
- `text-decoration` does not work in iOS/Android Gmail for non-Gmail accounts
- Use dark gray backgrounds (#121212 or #222222) for dark mode, never pure black (#000000)

**Warning signs:**
- Template looks perfect in browser preview but was never tested in actual email clients
- No Litmus/Email on Acid account set up
- Template uses CSS properties not supported by Outlook (flexbox, grid, `max-width` on non-table elements)
- No dark mode testing at all
- Enterprise client complaints about broken layout after first send

**Phase to address:**
Phase 4 (Premium Email Design) -- email client testing tool must be set up before any redesign begins

---

### Pitfall 5: In-Process node-cron Scheduling Loses Jobs on Railway Deploys

**What goes wrong:**
The current system uses `node-cron` for scheduling (`scheduler.ts` runs a single daily collection at 06:00 EET). Adding per-client configurable frequencies (weekly/bi-weekly/monthly) means creating multiple dynamic cron jobs at runtime. Every Railway deploy restarts the Node.js process, destroying all in-memory cron schedules. If a deploy happens at 05:59 and the 06:00 collection job was scheduled, it never fires. With per-client schedules, the system must re-register potentially dozens of schedules on every startup, and any bug in that startup code means ALL scheduling silently breaks.

**Why it happens:**
`node-cron` stores schedules in memory only -- there is no persistence layer. Railway deploys happen frequently (every git push). Railway also offers native cron jobs as an alternative, but those are designed for standalone tasks that exit after completion, not for augmenting a long-running API server.

**How to avoid:**
- Store all schedule configurations in the database (add to clients table: `send_frequency`, `next_generation_at`, `last_generated_at`)
- Use a single, simple cron job (keep current pattern: one daily cron at 06:00) that checks the database for "which clients need a digest generated today?"
- The decision logic belongs in the database query, not in multiple cron expressions: `WHERE next_generation_at <= NOW() AND is_active = true`
- After generating, compute and store `next_generation_at` based on the client's frequency setting
- This approach is more resilient than dynamic cron registration and survives deploys naturally
- Show each client's next scheduled generation date in the admin panel
- Railway cron jobs (platform-level) have a minimum 5-minute interval and execute in UTC only -- not suitable for the Finland-timezone-aware scheduling needed here

**Warning signs:**
- Multiple `cron.schedule()` calls created dynamically per client
- Schedule state stored only in memory (no database persistence)
- Missed digest generations after deployments
- No way for admin to see "when will this client's next digest be generated?"

**Phase to address:**
Phase 2 (Auto-Scheduling) -- architecture decision (database-driven vs dynamic cron) must be made upfront

---

### Pitfall 6: Web Search API Costs Spiral with Per-Client Industry Searches

**What goes wrong:**
Tavily charges per search credit (1 credit for basic, 2 for advanced). With 10 clients each needing industry-specific searches, running 3 queries per client per day = 30 searches/day = 900/month. On the free tier (1,000 credits/month), you are nearly maxed out with just 10 clients. Scaling to 20 clients doubles it. Using "advanced" or "deep" search modes (2-5 credits each) multiplies costs 2-5x. The insidious part: costs feel negligible per-query ($0.008) but compound multiplicatively with client count.

**Why it happens:**
Search API costs are small per-query, creating a false sense of cheapness. Product decisions ("let's add 3 more search queries per client for better coverage") each seem trivial but compound multiplicatively. Additionally, Tavily's cleaned output saves downstream LLM token costs (raw SERP data consumes 40% more LLM tokens than Tavily's cleaned output), but this secondary saving is invisible and easy to ignore.

**How to avoid:**
- Implement a daily search budget counter in the database from day one
- Use Tavily basic search (1 credit) by default; only use advanced search for specific high-value queries
- Cache search results aggressively: same industry keyword search within 24 hours should return cached results, not make a new API call
- Share general AI news searches across clients (search once, distribute to all) -- only industry-specific searches should be per-client
- Set hard limits: max N searches per client per day, configurable in admin
- Log every search API call with cost and expose totals in admin dashboard
- Tavily's free tier (1,000 credits/month) is sufficient for early development and a few clients
- Start with Tavily over Serper because Tavily returns AI-ready cleaned content (less LLM token waste downstream)

**Warning signs:**
- No search cost tracking in the system
- Same general AI queries being made separately for each client
- No caching layer for search results
- Monthly Tavily bill higher than expected

**Phase to address:**
Phase 1 (Web Search Integration) -- budget tracking and caching must be built alongside the search client

---

### Pitfall 7: Embedding Model Lock-In and Cross-Model Vector Incompatibility

**What goes wrong:**
You pick an embedding model (e.g., OpenAI text-embedding-3-small at $0.02/1M tokens), store vectors in the database, then need to switch models (price change, better model released, vendor discontinuation). ALL existing vectors must be re-generated because vectors from different models are incompatible -- you cannot compare a text-embedding-3-small vector with a Voyage AI vector. This means re-embedding your entire article corpus and paying for it again.

**Why it happens:**
Cosine similarity only works between vectors from the same model with the same dimensionality. This is a fundamental mathematical constraint, not a software limitation. Developers store vectors without model metadata and assume they are interchangeable.

**How to avoid:**
- Store the embedding model name and version alongside every vector in the database
- Choose OpenAI text-embedding-3-small ($0.02/1M tokens) -- best quality/price ratio for news deduplication in 2026
- For ~30 articles/day x 365 days = ~11,000 articles/year, embedding cost is negligible (<$1/year at current rates), so model cost is less important than accuracy
- Design the schema so vectors can be re-generated: keep the original text, not just the vector
- Write a re-embedding migration script as part of the initial implementation
- Normalize vectors before storage when using cosine similarity (prevents recall degradation from inconsistent vector magnitudes)
- Consider pgvector extension on Railway PostgreSQL for native vector operations; if unavailable, store as JSON array and compute similarity in application code

**Warning signs:**
- Vectors stored without model metadata
- Original article text not preserved alongside vectors
- No re-embedding migration script exists
- Vector normalization step is missing

**Phase to address:**
Phase 3 (Semantic Deduplication) -- schema design must include model metadata from the start

---

### Pitfall 8: Source Health Monitoring False Alarms from Normal RSS Feed Behavior

**What goes wrong:**
RSS feeds have wildly inconsistent publication patterns. A high-quality AI research blog might publish twice a month. A news aggregator publishes 50 items daily. A conference RSS feed is silent for 11 months then explodes during the event. The health monitor marks the research blog as "stale" and the admin wastes time investigating healthy sources, while actually broken feeds (HTTP 500 errors, certificate expiry) get lost in the noise of false alarms.

**Why it happens:**
Developers set a single "stale threshold" (e.g., "no new items in 48 hours = stale") without accounting for each source's natural publication frequency. One threshold cannot fit a daily news site and a monthly blog.

**How to avoid:**
- Track per-source historical publication frequency: calculate average days between posts over the last 90 days
- Set the stale threshold per source as `avg_days_between_posts * 3` -- only alert when a source is 3x overdue from its normal cadence
- Separate HTTP-level health (can we reach the feed? does it parse?) from content-level health (is it publishing?)
- HTTP errors (404, 500, SSL errors, timeouts) are ALWAYS alerts regardless of content frequency
- Add an `expectedFrequency` field to the `newsSources` table: `daily`, `weekly`, `monthly`, `irregular`
- Show source health as a simple traffic light in the admin panel: green (healthy), yellow (overdue), red (HTTP error or extremely overdue)
- Let the admin manually mark sources as "irregular" to suppress false stale alerts
- The existing `rssCollector.ts` already has a 15-second timeout -- extend this to also track response status codes for health data

**Warning signs:**
- Single stale threshold applied to all sources
- Admin ignoring health alerts because they are mostly false positives
- Actually broken feeds not being detected because alerts are noisy
- No distinction between "feed is unreachable" and "feed has no new content"

**Phase to address:**
Phase 5 (Source Health Monitoring) -- per-source frequency tracking needs historical data, so start collecting publication timestamps and HTTP response metadata in earlier phases

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing embeddings in PostgreSQL JSON array column without pgvector | No extension dependency, simpler setup | Manual cosine similarity calculation in app code, O(n) scan for every comparison | Acceptable for <10,000 articles (years of data at current collection rate) |
| Single `config` JSON text field on `newsSources` for all source types (current design) | No schema migration per source type | Type safety lost, impossible to query by X account handle or search keywords | Never for v1.1 -- migrate to typed columns or JSONB with schema validation when adding X and web search source types |
| Hardcoding embedding model in code | Quick to implement | Must redeploy to change model | Never -- store model name in env var from the start |
| Using `node-cron` for multi-client scheduling | Quick per-client schedule setup | Loses state on deploy, complex to debug, no visibility | Never for per-client schedules; use database-driven approach instead |
| Skipping email client testing (Litmus/Email on Acid) | Saves ~$100/month subscription cost | Enterprise clients see broken emails, erodes trust immediately | Never for enterprise product targeting Outlook users |
| Caching search results in memory only | Simple implementation | Lost on restart, no sharing between collection runs | Only during development; use database cache with TTL in production |
| Shared X API credentials across all source types | Only one OAuth app to manage | Cannot separately rate-limit influencer monitoring vs keyword search | Acceptable for MVP; separate if hitting budget issues |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| X API v2 | Using Free tier for read operations (Free tier has 0 tweet reads) | Budget for Basic ($200/mo) minimum; Free is write-only |
| X API v2 | Not using `since_id` pagination, re-fetching old tweets every run | Store `last_seen_tweet_id` per monitored account, always pass `since_id` |
| X API v2 | Not distinguishing between user timeline reads and search reads consuming from the same monthly quota | Track all read operations against a single monthly budget counter |
| X API v2 | Authenticating with user OAuth when app-only Bearer token suffices for read-only | Use app-only Bearer token for timeline/search reads; simpler auth, same rate limits |
| Tavily | Using "advanced" search depth by default (2 credits vs 1) | Default to basic search; only use advanced for specific high-value queries |
| Tavily | Not caching results -- same query 10 minutes later makes a new API call | Cache search results by query hash with 24-hour TTL in database |
| Tavily | Sending raw Tavily output to Claude without trimming | Tavily returns cleaned content, but still trim to relevant snippets to save Claude input tokens |
| OpenAI Embeddings | Sending raw HTML or very long article text for embedding | Clean text, truncate to model's context window (8191 tokens for text-embedding-3-small), embed title + summary, not full content |
| OpenAI Embeddings | Not normalizing vectors before storage | Normalize to unit vectors on storage; cosine similarity assumes normalized inputs for consistent results |
| React Email | Assuming JSX preview matches actual rendered HTML in email clients | Always check compiled HTML output; test in Litmus/Email on Acid before deploying |
| React Email | Using `<style>` blocks for custom CSS | React Email inlines styles from components, but any custom CSS in `<style>` tags gets stripped by Gmail; use inline styles exclusively |
| Resend (feedback links) | Building click tracking URLs that expose member IDs | Use HMAC-signed tokens in feedback URLs; predictable sequential IDs allow feedback forgery |
| PostgreSQL / pgvector | Adding `vector` column assuming Railway PostgreSQL has pgvector installed | Verify Railway PostgreSQL supports pgvector extension; if not, use JSONB array and compute cosine similarity in Node.js |
| `newsSources` schema | Adding X accounts and Tavily queries as source type `manual` with JSON config | Add proper enum values (`x_account`, `x_keyword`, `web_search`) to `sourceTypeEnum` -- the current enum only has `rss`, `beehiiv`, `manual` |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Computing cosine similarity in a loop over all articles for every new article | Deduplication takes 10+ seconds as article count grows | Pre-filter by date range (only compare against last 14 days) and use pgvector index if available | >5,000 articles (~6 months of collection at expanded source volume) |
| Fetching all news items for digest generation without date or industry filtering | `generateClientDigest` currently fetches 30 most recent items globally -- with 5x more sources this becomes stale or irrelevant | Filter by date range (last 7/14/30 days depending on frequency) AND tag items by relevance to client industry | When total news items exceed ~500 and clients span different industries |
| Running X API calls, web searches, and RSS collection synchronously | Daily collection takes 10+ minutes, blocking the scheduler | Parallelize independent source types (RSS in parallel, X with rate limiting, web search with budget tracking) | When source count exceeds 30 total |
| Re-embedding articles on every collection run instead of only new articles | Wasted embedding API calls and compute on already-processed articles | Only embed articles that lack an embedding vector; flag new articles for embedding on insert | When collecting >50 articles/day |
| Generating digests for all due clients sequentially | With 20 clients, generation takes 20x longer; Claude API calls serialize | Process clients in parallel batches (3-5 concurrent), respecting Claude API rate limits | When client count exceeds 5 |
| Email template re-rendering per recipient when content is identical | Slow batch sending | Render once per issue, personalize only member-specific fields (unsubscribe URL, tracking pixel, feedback links) at send time -- current code mostly does this | When >100 members per client |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing X API Bearer token in code or git | Token exposure leads to unauthorized API access, potential $5,000/month Pro tier charges | Store in Railway environment variables only; never commit tokens; rotate on suspected exposure |
| Email feedback links with predictable member IDs (sequential integers from `serial` primary key) | Anyone can forge feedback by guessing member IDs | Use HMAC-signed tokens in feedback URLs: `HMAC(member_id + issue_id, secret)` -- verify signature on click |
| Exposing Tavily/OpenAI API keys in client-side code or API responses | Keys stolen and used by others, running up your bill | All external API calls go through backend; never expose third-party keys to frontend |
| Unvalidated webhook payloads from Resend | Attacker sends fake delivery/bounce events, corrupting tracking data | Validate Resend webhook signatures using their provided signing secret |
| X API OAuth tokens stored in plaintext in database | Database breach exposes X API access | Encrypt tokens at rest or store in Railway environment variables; rotate periodically |
| Feedback endpoint without rate limiting | Attacker floods fake feedback, skewing satisfaction metrics | Rate limit feedback endpoint: max 1 feedback per member per issue per minute |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Thumbs up/down feedback requires portal login | Enterprise users will not log into a portal to rate a newsletter -- feedback rate drops to near zero | Embed feedback directly in the email as simple GET request links with HMAC-signed tokens; no login required |
| No feedback confirmation after clicking thumbs up/down | User unsure if feedback was recorded, may click multiple times | Redirect to a simple "Kiitos palautteesta!" page; deduplicate clicks by member+issue |
| Source health alerts only visible when admin logs in to the panel | Broken sources go unnoticed for days between admin sessions | Send email notification to Janne when critical sources fail (HTTP errors); dashboard is for detail, not primary alerting |
| Auto-scheduled digests generate without enough recent news | System generates a digest from stale/insufficient news, producing low-quality thin content | Set a minimum news item threshold per client (e.g., at least 5 fresh articles); if insufficient, skip generation and notify admin |
| Configurable frequency UI offers too many options or freeform input | Decision paralysis; clients pick "daily" and get thin, low-quality digests | Offer exactly three options: weekly, bi-weekly, monthly. No custom cron expressions. Weekly is the default. |
| Admin has no preview of which X/web search sources contributed to a digest | Cannot debug why certain topics appear or are missing in newsletter content | Show source attribution in the admin digest preview: which articles came from RSS vs X vs web search |
| Deduplication is invisible to admin | Cannot understand why an article was removed or kept | Show dedup decisions in admin: "Article X removed as duplicate of Article Y (similarity: 0.94)" |

## "Looks Done But Isn't" Checklist

- [ ] **X Integration:** API reads work in testing -- but monthly quota tracking is not implemented, and the app will silently stop collecting tweets mid-month
- [ ] **X Integration:** Influencer accounts are monitored -- but `since_id` pagination is missing, causing the same tweets to be re-fetched and re-counted against the monthly quota every run
- [ ] **Semantic Dedup:** Cosine similarity code works -- but threshold was never calibrated against real AI news articles, so it either misses duplicates or removes unique stories
- [ ] **Semantic Dedup:** Embeddings are stored -- but no model metadata is recorded, making future model migration impossible without re-processing everything
- [ ] **Auto-Scheduling:** Cron job fires on schedule -- but deploying the app resets all schedules, and there is no recovery mechanism to detect and re-schedule missed generations
- [ ] **Auto-Scheduling:** Multiple frequencies work -- but `next_generation_at` is not recalculated after admin manually triggers a digest, causing duplicate generation on the next scheduled run
- [ ] **Email Template:** Template looks perfect in Gmail -- but was never tested in corporate Outlook desktop (the primary enterprise client environment), dark mode, or with images disabled
- [ ] **Email Template:** Co-branding shows client name -- but long company names or Finnish special characters (a, o, a) break the layout or get garbled in certain email clients
- [ ] **Feedback Loop:** Thumbs up/down links work -- but the links contain predictable sequential IDs allowing feedback forgery, and there is no deduplication of multiple clicks
- [ ] **Feedback Loop:** Feedback is collected -- but no reporting view exists in admin to show aggregate satisfaction per client per issue
- [ ] **Source Health:** Stale detection works -- but uses a single threshold for all sources, generating so many false alarms that the admin ignores all alerts
- [ ] **Source Health:** HTTP errors are detected -- but no distinction between temporary (503 Service Unavailable) and permanent (404 Not Found, domain expired) failures
- [ ] **Web Search:** Tavily integration returns results -- but there is no caching, so the same "artificial intelligence news" query runs (and costs credits) separately for every client every day
- [ ] **Schema:** New source types work -- but the `sourceTypeEnum` was not updated from `['rss', 'beehiiv', 'manual']` to include `x_account`, `x_keyword`, `web_search` -- using `manual` type with JSON config is a tech debt trap

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| X API monthly quota exhausted mid-month | LOW | Fall back to RSS + web search only for remaining month; no data loss, just reduced X coverage. Implement budget cap to prevent recurrence. |
| Dedup threshold too aggressive (removed unique stories) | MEDIUM | Re-process affected digests from raw news items (originals preserved in DB). Adjust threshold. Admin reviews and re-generates affected issues. |
| Dedup threshold too lenient (duplicates in newsletter) | LOW | No permanent damage. Adjust threshold. Regenerate affected draft issues before sending. |
| Email template broken in Outlook for paying clients | HIGH | Emergency rollback to previous template version. Set up Litmus testing. Re-test and re-deploy. Apologize to affected clients -- trust damage is the real cost. |
| Scheduled generation missed due to deploy | LOW | Database-driven approach allows immediate catch-up: check `next_generation_at < NOW()` on startup and process overdue clients. |
| Embedding model discontinued or pricing changed | MEDIUM | Re-embed all articles using new model (cost: ~$1 for 10K articles using text-embedding-3-small). Requires migration script and model metadata in schema. |
| Source health monitoring producing only false alarms | LOW | Disable alerting temporarily. Backfill per-source frequency data from `news_items.collected_at` history. Recalculate per-source thresholds. Re-enable. |
| Tavily free tier credits exhausted mid-month | LOW | General AI news collection continues via RSS and X. Only industry-specific web search is affected. Implement caching and shared queries to prevent recurrence. |
| Feedback links forged by malicious actor | LOW | Invalidate suspicious feedback data. Deploy HMAC-signed links. Re-request legitimate feedback in next issue. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| X API cost shock (#1) | Phase 1 (X Monitoring) | Budget calculation document exists; daily cap implemented in code; admin dashboard shows API usage vs. monthly limit |
| X dual rate limit data loss (#2) | Phase 1 (X Monitoring) | Monthly consumption counter in DB; admin can see remaining budget; system continues functioning when X budget exhausted |
| Dedup threshold miscalibration (#3) | Phase 3 (Semantic Dedup) | Calibration dataset of 50+ manually-labeled pairs exists; threshold tested against dataset; admin review queue for borderline similarity scores |
| Email template Outlook breakage (#4) | Phase 4 (Premium Email) | Litmus/Email on Acid account active; template tested in Outlook 365 desktop, Gmail, Apple Mail, dark mode; screenshot evidence saved |
| node-cron schedule loss on deploy (#5) | Phase 2 (Auto-Scheduling) | All schedule state in database; single daily cron checks DB for due clients; system recovers missed jobs on startup; admin sees next scheduled date per client |
| Web search cost spiral (#6) | Phase 1 (Web Search) | Daily budget counter in DB; shared general searches across clients; cache with 24h TTL; admin dashboard shows search credit spend |
| Embedding model lock-in (#7) | Phase 3 (Semantic Dedup) | Schema includes model name/version per vector; original text preserved; re-embedding script exists and has been tested |
| Source health false alarms (#8) | Phase 5 (Source Health) | Per-source frequency tracking active; HTTP errors separated from content staleness; admin confirms alerts are actionable not noisy |

## Sources

- [X API Rate Limits - Official Documentation](https://docs.x.com/x-api/fundamentals/rate-limits) -- HIGH confidence
- [X/Twitter API Pricing 2026](https://getlate.dev/blog/twitter-api-pricing) -- MEDIUM confidence (aggregated from multiple sources)
- [X API Pricing Tiers 2025](https://twitterapi.io/blog/twitter-api-pricing-2025) -- MEDIUM confidence
- [X Pay-As-You-Go Pricing Announcement - TechCrunch](https://techcrunch.com/2025/10/21/x-is-testing-a-pay-per-use-pricing-model-for-its-api/) -- HIGH confidence
- [Best SERP API Comparison 2025 - DEV Community](https://dev.to/ritza/best-serp-api-comparison-2025-serpapi-vs-exa-vs-tavily-vs-scrapingdog-vs-scrapingbee-2jci) -- MEDIUM confidence
- [Tavily vs Serper API - SearchMCP Blog](https://searchmcp.io/blog/tavily-vs-serper-search-api) -- MEDIUM confidence
- [NVIDIA Semantic Deduplication Documentation](https://docs.nvidia.com/nemo/curator/latest/curate-text/process-data/deduplication/semdedup.html) -- HIGH confidence
- [Cosine Similarity Guide 2025](https://www.shadecoder.com/topics/cosine-similarity-a-comprehensive-guide-for-2025) -- MEDIUM confidence
- [OpenAI Embedding Pricing](https://platform.openai.com/docs/pricing) -- HIGH confidence (official)
- [13 Best Embedding Models in 2026](https://elephas.app/blog/best-embedding-models) -- MEDIUM confidence
- [Railway Cron Jobs - Official Documentation](https://docs.railway.com/reference/cron-jobs) -- HIGH confidence (official)
- [Railway Blog: Cron Jobs](https://blog.railway.com/p/cron-jobs) -- HIGH confidence (official)
- [Dark Mode for Email - Litmus Ultimate Guide](https://www.litmus.com/blog/the-ultimate-guide-to-dark-mode-for-email-marketers) -- HIGH confidence
- [HTML and CSS in Emails 2026 - Designmodo](https://designmodo.com/html-css-emails/) -- MEDIUM confidence
- [Common Issues with Outlook Email Templates](https://help.designmodo.com/article/209-common-issues-outlook) -- MEDIUM confidence
- [Email Feedback Loop Explained 2026 - Mailtrap](https://mailtrap.io/blog/email-feedback-loop/) -- MEDIUM confidence
- [node-cron npm package documentation](https://www.npmjs.com/package/node-cron) -- HIGH confidence (official)
- [Semantic Search in CAP Node.js - SAP Community](https://community.sap.com/t5/sap-cap-blog-posts/semantic-search-in-cap-node-js-vector-embeddings-and-cosine-similarity/ba-p/14287114) -- MEDIUM confidence

---
*Pitfalls research for: AI-Sanomat Yrityksille v1.1 -- Smart Sourcing & Polish*
*Researched: 2026-03-03*
