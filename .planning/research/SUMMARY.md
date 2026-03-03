# Research Summary: AI-Sanomat Yrityksille v1.1 — Smart Sourcing & Polish

**Synthesized:** 2026-03-03
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
**Overall Confidence:** MEDIUM-HIGH

---

## Executive Summary

AI-Sanomat Yrityksille v1.1 extends a working v1.0 enterprise newsletter platform (Fastify + Next.js monorepo, PostgreSQL, Claude/Gemini AI generation, Resend delivery) with seven new capabilities: expanded news sourcing via X API and Tavily web search, semantic deduplication to reduce story repetition, auto-scheduled digest generation, source health monitoring, a premium email template redesign, and an email feedback loop. The platform serves Finnish B2B clients at 29–390 EUR/month and competes on content quality and timeliness — the v1.1 features directly address the core promise of delivering industry-specific AI news that clients cannot easily source themselves.

The recommended approach is additive and conservative: all new features extend the existing architecture rather than replacing any part of it. Three new integration clients (xClient, webSearchClient, embeddingClient) plug into the existing news collection pipeline, four new service modules handle domain logic, and the database gains targeted column additions plus the pgvector extension. The total new infrastructure cost is roughly 5–15 EUR/month (dominated by X API pay-per-use) — minimal for a product at this price point. The primary risk is not technical complexity but operational detail: X API rate limit management, semantic deduplication threshold calibration, and email client compatibility testing are all areas where the "looks done but isn't" failure mode is common.

The highest-value, lowest-risk features to build first are source health monitoring and auto-scheduling — both reuse existing dependencies entirely and make the product feel like a mature SaaS product. The template redesign and feedback loop should follow as a combined phase since they both touch the email template. Tavily web search is a straightforward API integration with immediate content quality impact. X monitoring and semantic deduplication are the most complex and should come last, once the simpler foundation is stable and real collection data exists to calibrate dedup thresholds.

---

## Key Findings

### From STACK.md

New dependencies required for v1.1 features (existing v1.0 stack unchanged):

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `twitter-api-v2` | ^1.29.0 | X API v2 client for influencer timelines and keyword search | HIGH |
| `@tavily/core` | ^0.7.2 | AI-optimized web search, returns LLM-ready extracted content in one call | HIGH |
| `openai` | ^6.25.0 | Embeddings API only (text-embedding-3-small at $0.02/1M tokens) | HIGH |
| pgvector (PostgreSQL extension) | 0.7+ | Vector storage and cosine similarity in existing Railway PostgreSQL | HIGH |

Key decisions:
- X API pay-per-use pricing (launched Feb 2026) is the right tier: no $200/month minimum, credits deducted per request, spending caps prevent surprise bills
- Tavily chosen over Serper because it returns clean extracted content in a single call — Serper returns raw SERP links requiring separate scraping per URL
- OpenAI for embeddings because Anthropic does not offer an embeddings model; Voyage AI is a valid alternative but adds another vendor
- pgvector in existing PostgreSQL rather than a dedicated vector DB — dataset is under 1K items/week, a separate service is unnecessary overhead
- Four features (auto-scheduling, source health monitoring, premium template, email feedback) require ZERO new dependencies

New environment variables required: `X_BEARER_TOKEN`, `TAVILY_API_KEY`, `OPENAI_API_KEY`

Monthly API cost estimate at 10 clients: ~5–15 EUR (X API is the dominant cost; Tavily and embeddings are effectively free at this scale)

---

### From FEATURES.md

**Table Stakes (missing these makes product feel incomplete at its price point):**
- Auto-scheduled digest generation — enterprise clients assume SaaS products run on a schedule; currently requires manual triggering per client
- Source health monitoring — silent source failures degrade content quality; clients expect consistent delivery
- Premium newsletter template — at 29–390 EUR/month, the current functional-but-basic template undersells the product

**Differentiators (justify premium pricing):**
- X/Twitter monitoring — AI thought leaders break news on X before RSS; timeliness advantage
- Tavily web search — captures breaking news and niche industry content that RSS misses
- Semantic deduplication — prevents "same story from 3 sources" problem that wastes digest space
- Email feedback loop — direct quality signal more actionable than open rates (Apple MPP inflates those)

**Anti-features (explicitly avoid for v1.1):**
- Reddit/HN scraping — legal ambiguity, high noise-to-signal ratio; best content already surfaces via Tavily
- Fully automated sending — AI hallucination risk; admin review is a feature, not a bottleneck (revisit v2+)
- Per-client custom email templates — N templates to maintain and test across email clients; use co-branding instead
- Click tracking — adds link-wrapping complexity and privacy concerns; defer to v2.0
- Real-time or daily digests — 7x content generation cost, subscriber fatigue; weekly minimum is the product

**Feature dependency order:**
Source health monitoring foundation → new sources (X, Tavily) → semantic dedup → template redesign + feedback → auto-scheduling (independent, can be done in any phase)

---

### From ARCHITECTURE.md

The v1.1 architecture adds a clean layer of new components without restructuring v1.0:

**New integration clients:**
- `api/src/integrations/xClient.ts` — X API v2 timeline and search
- `api/src/integrations/webSearchClient.ts` — Tavily web search
- `api/src/integrations/embeddingClient.ts` — OpenAI embeddings

**New service modules:**
- `api/src/services/deduplicationService.ts` — semantic dedup logic
- `api/src/services/sourceHealthService.ts` — source reliability tracking
- `api/src/services/feedbackService.ts` — email vote handling
- `api/src/services/scheduleService.ts` — per-client generation schedules

**Key architectural pattern — database-driven scheduling:**
Rather than multiple dynamic cron jobs per client (which lose state on Railway deploys), use a single daily cron that queries `clients.next_generation_at <= NOW()`. Schedule state lives in the database, survives deploys, and is visible to admins. This is a non-negotiable architectural decision — dynamic cron registration is a trap.

**Database changes:**
- `newsSources`: add health tracking columns (lastSuccessAt, lastFailureAt, consecutiveFailures, qualityScore)
- `newsItems`: add embedding vector column (512 dimensions) + sourceMetadata JSON + isDuplicate flag; HNSW index for fast cosine similarity
- `clients`: add sendFrequency, sendDayOfWeek, sendHour, searchPrompt, nextGenerationAt
- `issues`: add feedbackToken column
- New tables: `sourceHealthLogs`, `feedbackVotes`
- pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;`
- `sourceTypeEnum`: extend to include `x_account`, `x_search`, `web_search` (requires manual SQL `ALTER TYPE` migration, not schema push)

**Modified existing files:** newsCollectorService.ts, newsletterService.ts, emailService.ts, DigestEmail.tsx, scheduler.ts, db/schema.ts

**Unchanged files:** claudeClient.ts, geminiClient.ts, resendClient.ts, rssCollector.ts, webhooks.ts

---

### From PITFALLS.md

Top 5 pitfalls by severity:

**Pitfall 1: X API cost shock (CRITICAL for Phase 5)**
X API Basic tier ($200/month) allows only 15,000 tweet reads — monitoring 20 accounts daily burns through this in under a week. The next tier is $5,000/month with nothing in between. Prevention: use pay-per-use pricing, implement a hard daily budget cap in code, cache using `since_id`, expose usage in admin dashboard.

**Pitfall 2: X API dual rate limit causes silent data loss (CRITICAL for Phase 5)**
Two separate limit types: per-15-minute request limits (obvious 429 errors) and monthly consumption quotas (silent failure). The app can stop receiving tweets mid-month with no error. Prevention: implement a `monthlyBudgetTracker` in the database from day one; alert at 50% and 75% consumption.

**Pitfall 3: Semantic dedup threshold miscalibration (HIGH for Phase 4)**
Too high a threshold and near-duplicates slip through; too low and different stories get removed. AI news articles about the same topic typically score 0.75–0.90 cosine similarity. Prevention: build a calibration dataset of 50+ manually-labeled article pairs before setting any threshold; use a two-tier system (auto-dedup above 0.92, flag for review between 0.80–0.92).

**Pitfall 4: Email template breaks in Outlook (HIGH for Phase 2)**
Enterprise clients predominantly use Outlook, which uses Microsoft Word's rendering engine — CSS flexbox, grid, and media queries are ignored. Prevention: use table-based layout via React Email components (which compile to tables), test every change in Litmus or Email on Acid before deploying, provide dark-mode logo variants. Litmus account is a prerequisite, not optional.

**Pitfall 5: node-cron loses schedule state on Railway deploys (MEDIUM for Phase 1)**
In-memory cron schedules are destroyed on every deploy. With per-client configurable schedules, a startup bug silently breaks all scheduling with no error. Prevention: use database-driven scheduling (single cron checks DB for due clients), not multiple dynamic cron registrations.

Additional pitfalls documented: web search cost spiral (cache + shared queries from day one), embedding model lock-in (store model metadata with every vector), source health false alarms from irregular RSS publication cadences (per-source adaptive thresholds).

---

## Implications for Roadmap

### Suggested Phase Structure

**Phase 1: Foundation Automation** (no new dependencies)

Scope: Auto-scheduled digest generation, database-driven scheduling architecture, `sourceTypeEnum` extension via manual SQL migration

Rationale: Delivers immediate admin burden reduction. Must be done before new sources are added so the scheduler is designed correctly from the start. The database-driven scheduling architecture cannot be retrofitted cheaply — this is the foundational decision for all future automation. Avoids Pitfall 5.

Delivers: Product generates drafts automatically; admin reviews rather than triggers.

Research flag: Standard patterns, no additional research needed.

---

**Phase 2: Premium Email Experience** (no new dependencies)

Scope: Template redesign (AI-Sanomat brand frame, client co-branding, dark mode, Outlook compatibility), email feedback loop (JWT-signed links, feedbackVotes table, thank-you page, admin satisfaction reporting)

Rationale: Template and feedback are tightly coupled (both touch DigestEmail.tsx) and should be a single phase. Litmus or Email on Acid account must be set up BEFORE any template work begins — testing in browser preview is insufficient for enterprise email clients. Avoids Pitfall 4.

Delivers: Polished client-facing output, first engagement signal beyond open rates, churn prediction data.

Research flag: Needs Litmus/Email on Acid account setup as a prerequisite. Finnish special characters (a, o, a) in company names need testing in Outlook specifically.

---

**Phase 3: Tavily Web Search** (new dependency: @tavily/core)

Scope: webSearchClient integration, `web_search` source type, per-client industry search prompts (clients.searchPrompt), search result caching with 24-hour TTL in database, search budget tracking in admin dashboard

Rationale: Highest-value new source with the most straightforward API. Immediate content quality improvement — finds breaking news and niche industry content that RSS misses. Free tier covers all development and early production use. Must include caching and budget tracking from day one to avoid cost spiral with client growth. Avoids Pitfall 6.

Delivers: News from sources not covered by RSS, improved industry-specific relevance for Finnish-language industries.

Research flag: Standard API integration, no additional research needed. Verify current Tavily credit pricing at implementation time.

---

**Phase 4: Semantic Deduplication** (new dependencies: openai, pgvector extension)

Scope: pgvector extension enablement on Railway PostgreSQL, embeddingClient for OpenAI text-embedding-3-small, embedding column on newsItems with HNSW index, deduplicationService with two-tier threshold system, calibration dataset from Phases 1–3 data, admin visibility into deduplication decisions

Rationale: Semantic dedup requires real collected data to calibrate thresholds — doing this after 2–3 phases of data collection prevents tuning on artificial examples. pgvector must be verified on Railway before schema migration is written. Model metadata must be stored from the first commit. Avoids Pitfalls 3 and 7.

Delivers: Cleaner news pool for Claude, eliminates "same story three times" problem, higher digest relevance.

Research flag: Finnish language embedding quality for text-embedding-3-small needs manual verification against real Finnish AI news headlines before threshold is finalized. Build 50-item calibration dataset from actual collected news.

---

**Phase 5: X/Twitter Monitoring** (new dependency: twitter-api-v2)

Scope: X API pay-per-use account setup with spending cap, xClient for user timeline and keyword search, monthly budget tracker in database (independent of X's own tracking), `since_id` pagination to avoid re-fetching old tweets, admin dashboard showing X API usage vs. monthly budget, per-client influencer account and keyword configurations

Rationale: Highest complexity and highest API cost uncertainty — doing this last means the system is stable and the admin has full visibility when adding this expensive integration. Budget tracking and `since_id` pagination must be in the first commit; they cannot be added later. Avoids Pitfalls 1 and 2.

Delivers: Breaking news from AI thought leaders before it appears in RSS feeds, timeliness advantage for clients.

Research flag: Needs a budget calculation document before any code is written. Verify current X pay-per-use credit costs and spending cap mechanics at implementation time — pricing launched Feb 2026 and may have evolved.

---

**Phase 6: Source Health Intelligence** (no new dependencies)

Scope: Per-source historical publication frequency tracking, adaptive stale thresholds (`avg_days_between_posts * 3`), HTTP-level vs content-level health separation, admin email alerts for critical failures, traffic-light health UI in admin panel, auto-disable of persistently failing sources with notification

Rationale: Source health monitoring starts basic in Phase 1 (consecutive failure tracking), but the intelligent frequency-adaptive system needs historical data from Phases 1–5 to calculate meaningful per-source baselines. Without historical data, any threshold is a guess. Avoids Pitfall 8.

Delivers: Proactive alerting for source failures without false-alarm noise, reliable multi-source collection quality.

Research flag: Standard monitoring patterns, no additional research needed.

---

### Research Flags Summary

| Phase | Needs Research | Reason |
|-------|---------------|--------|
| Phase 1 | No | Standard cron + database patterns |
| Phase 2 | Partial | Litmus/Email on Acid account setup; Finnish character testing in Outlook |
| Phase 3 | No | Tavily API well-documented; verify pricing at implementation |
| Phase 4 | Yes | Finnish embedding quality verification; calibration dataset required |
| Phase 5 | Yes | X API pay-per-use pricing verification; budget calculation document required |
| Phase 6 | No | Standard monitoring patterns |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All new packages verified via npm and official docs with exact versions. pgvector verified on Railway. Cost estimates are credible. |
| Features | MEDIUM | Well-documented APIs (Tavily, Resend, React Email) are HIGH confidence. X API cost and reliability are MEDIUM — pay-per-use pricing launched Feb 2026 and details are still evolving. Finnish embedding quality is unverified. |
| Architecture | HIGH | Existing codebase well-understood. New component boundaries are clean and conservative. Database changes are targeted. Database-driven scheduling is the correct call for Railway deployments. |
| Pitfalls | MEDIUM-HIGH | X API pitfalls are well-documented from community experience. Email client compatibility is well-researched (Litmus data). Semantic dedup threshold ranges are theoretical until tested against real Finnish AI news articles. |

### Gaps to Address During Planning

1. **X API pay-per-use pricing details** — Pricing launched February 2026; verify exact credit costs and spending cap mechanics at implementation time. The recommendation of pay-per-use over Basic tier is sound but pricing may have evolved.

2. **Finnish language embedding quality** — text-embedding-3-small claims "good multilingual support" but Finnish-specific quality for short AI news headlines is unverified. Build a manual calibration test during Phase 4 before setting the dedup threshold.

3. **Railway pgvector availability** — Verify the current Railway PostgreSQL instance has pgvector available (or confirm it can be enabled with `CREATE EXTENSION`) before Phase 4 schema work begins.

4. **Apify vs Official X API decision** — FEATURES.md initially suggested Apify (~15 EUR/month) but STACK.md recommends official pay-per-use API for enterprise defensibility. For a B2B enterprise product, official API is the correct choice. Document and align this decision before Phase 5.

5. **Litmus or Email on Acid subscription** — Required as a prerequisite for Phase 2. Budget approximately 100 EUR/month or find a one-time testing alternative before template work begins.

---

## Deferred to v2.0

Per FEATURES.md anti-features research:
- Fully automated sending without admin approval
- Per-client custom email templates
- Click tracking (link wrapping infrastructure)
- Daily digest frequency option
- Reddit and Hacker News scraping
- Auto-approve for consistently high-quality clients (revisit after feedback data accumulates)
- Advanced source quality scoring using digest selection ratios (needs months of feedback data)
- Resend native open/click tracking integration

---

## Sources (Aggregated)

### HIGH Confidence
- twitter-api-v2 npm, GitHub docs (verified v1.29.0)
- @tavily/core npm, official Tavily docs (verified v0.7.2, pricing, Node.js SDK)
- openai npm (verified v6.25.0, text-embedding-3-small pricing)
- Anthropic embeddings docs (confirms no native embeddings model)
- Drizzle ORM pgvector guide (schema + cosineDistance + HNSW index examples)
- Railway pgvector deployment templates (one-click availability confirmed)
- React Email component docs (existing stack)
- Resend webhooks and open/click tracking docs
- node-cron npm docs
- Railway cron jobs official docs (UTC-only, 5-min minimum confirmed as unsuitable for Finland-timezone scheduling)
- X API Rate Limits official docs
- X Pay-As-You-Go announcement (TechCrunch, Oct 2025)
- Litmus dark mode for email ultimate guide
- OpenAI embedding pricing (official docs)

### MEDIUM Confidence
- X API pay-per-use pricing details (multiple third-party sources; pricing still evolving post-Feb 2026)
- Apify Twitter Scraper pricing (single blog post, may have changed)
- Email design best practices 2026 (Brevo, Designmodo industry guides)
- Tavily vs Serper comparison (third-party analysis, not official)
- Semantic dedup threshold ranges (NVIDIA NeMo docs, cosine similarity guides)
- Finnish embedding quality claims (no Finnish-specific benchmarks found)

### LOW Confidence
- Apify per-tweet pricing ($0.40–0.50/1000) — single blog post source
- Local embeddings.js Finnish support — untested

---

*Summary synthesized from: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md*
*Project: AI-Sanomat Yrityksille v1.1 — Smart Sourcing & Polish*
*Synthesized: 2026-03-03*
