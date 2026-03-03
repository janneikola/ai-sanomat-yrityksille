# Feature Research: v1.1 Smart Sourcing & Polish

**Domain:** Enterprise AI-curated newsletter platform (B2B, Finnish market)
**Researched:** 2026-03-03
**Milestone:** v1.1 -- Smart sourcing, automation, design polish
**Overall confidence:** MEDIUM -- mix of well-documented APIs (Tavily, Resend) and less-documented areas (X monitoring cost/reliability, semantic dedup in Finnish)

## Context

v1.0 is built and running. The platform already has: RSS + Beehiiv news collection with URL deduplication, Claude digest generation with fact validation, Gemini image generation, admin panel with CRUD, digest generate/preview/approve/send workflow, company portal with magic link auth, Resend email delivery with open tracking and bounce handling.

This research covers the seven new feature areas for v1.1 and classifies them as table stakes (needed for the product to feel complete at its price point), differentiators (features that justify the premium), or anti-features (things to explicitly avoid).

---

## Table Stakes

Features that enterprise clients paying 29-390 EUR/mo expect. Missing these makes the product feel incomplete at its price point.

### 1. Auto-Scheduled Digest Generation

| Aspect | Detail |
|--------|--------|
| **Why expected** | Enterprise clients assume a SaaS newsletter product generates content on a schedule without manual triggering. Currently Janne must manually trigger generation for each client. |
| **Complexity** | LOW |
| **Dependencies** | Existing `scheduler.ts` (node-cron), existing `generateClientDigest()` pipeline |
| **Confidence** | HIGH -- straightforward cron scheduling, well-understood pattern |

**How it works:**

The existing system already uses node-cron for daily news collection at 06:00 EET. Auto-scheduling extends this with per-client digest generation schedules.

Implementation pattern:
1. Add `sendFrequency` field to clients table: `'weekly' | 'biweekly' | 'monthly'`
2. Add `sendDay` (day of week, 0-6) and `preferredTime` (hour in EET) to clients table
3. Scheduler runs a check cron (e.g., hourly) that queries clients whose schedule matches the current time
4. For matching clients, auto-create a draft issue and run `generateClientDigest()`
5. Issue enters `ready` status and waits for admin approval -- the human quality gate stays in place
6. Admin gets a notification (email or dashboard indicator) that digests are ready for review

**Key decisions:**

- **Draft, not auto-send.** Auto-scheduling creates drafts that await admin approval. Fully automated sending is an anti-feature for v1.1 because content quality is the core value and AI-generated content must be reviewed. Future v2+ could add auto-approve for trusted clients.
- **node-cron is sufficient.** With fewer than 50 clients, node-cron handles the load. No need for BullMQ/Redis. The scheduler checks hourly and triggers generation for matching clients.
- **Configurable frequency:** Weekly (every N weeks on day X), bi-weekly (every 2 weeks), monthly (1st or 15th). Store as cron-like config per client, not as separate cron jobs.
- **Idempotency:** Check if a digest already exists for the current period before generating. Prevent duplicate generation on scheduler restarts.

**Schema changes:**
```
clients table additions:
  sendFrequency: enum('weekly', 'biweekly', 'monthly') DEFAULT 'weekly'
  sendDay: integer (0=Sunday, 1=Monday, ...) DEFAULT 1 (Monday)
  preferredHour: integer (0-23, EET) DEFAULT 9
  lastScheduledAt: timestamp -- track when last auto-generation was triggered
```

### 2. Source Health Monitoring

| Aspect | Detail |
|--------|--------|
| **Why expected** | When a news source goes stale or breaks, the digest quality degrades silently. Enterprise clients expect consistent quality. Janne needs to know when sources fail. |
| **Complexity** | LOW-MEDIUM |
| **Dependencies** | Existing `newsSources` table, existing `newsCollectorService.ts` |
| **Confidence** | HIGH -- standard monitoring patterns |

**How it works:**

Track source reliability metrics over time and surface problems in the admin panel.

**Metrics to track per source:**
1. **Last successful fetch** -- timestamp of last collection that returned items
2. **Consecutive failures** -- counter that resets on success
3. **Items per fetch (7-day average)** -- detect declining sources
4. **Last new item date** -- when the source last had genuinely new content (not just a successful fetch of old content)

**Stale feed detection rules:**
- RSS feed with no new items in 14+ days = "stale" warning
- RSS feed with 3+ consecutive fetch failures = "error" status
- Beehiiv source with no new posts in 30+ days = "stale" warning
- Any source with 5+ consecutive failures = auto-disabled with admin notification

**Quality scoring (simple, not ML):**
- Each source gets a health score 0-100:
  - Base 100
  - Subtract 10 per consecutive failure
  - Subtract 20 if stale (no new content in threshold period)
  - Subtract 5 if average items per fetch drops below 50% of historical average
- Display as green (80-100), yellow (50-79), red (0-49) in admin panel

**Schema changes:**
```
news_sources table additions:
  lastSuccessAt: timestamp
  lastNewItemAt: timestamp
  consecutiveFailures: integer DEFAULT 0
  healthScore: integer DEFAULT 100
  isAutoDisabled: boolean DEFAULT false
```

**Admin UI additions:**
- Source list shows health score badge (green/yellow/red)
- Filter sources by health status
- "Source Health" section on admin dashboard showing problematic sources
- Button to re-enable auto-disabled sources

### 3. Premium Newsletter Template Redesign

| Aspect | Detail |
|--------|--------|
| **Why expected** | The current template is functional but basic. At 29-390 EUR/mo, enterprise clients expect a polished, professional design that they are proud to see in their team's inboxes. |
| **Complexity** | MEDIUM |
| **Dependencies** | Existing `DigestEmail.tsx` (React Email), existing email rendering pipeline |
| **Confidence** | HIGH -- React Email components are well-documented, email design patterns are mature |

**How it works:**

Redesign the existing `DigestEmail.tsx` template. Not a new template system -- this is a visual upgrade of the single template all clients share.

**2026 email design best practices to follow:**

1. **Generous white space.** Current template has tight 16px padding. Increase to 32-40px content padding, 24px between sections. White space is the single biggest quality signal in email design.

2. **AI-Sanomat brand frame.** Add a proper header with AI-Sanomat logo (image, not text), brand color accent bar, and consistent footer with social links and company info.

3. **Client co-branding.** Display the client company name and industry in the header area below the AI-Sanomat brand. Not a custom design per client -- just parameterized text: "AI Pulse: [Company Name] | [Industry]".

4. **Dark mode support.** 35-40% of users view emails in dark mode in 2026. Use `@media (prefers-color-scheme: dark)` in the email head, and ensure images have transparent backgrounds or work on dark backgrounds.

5. **Clear visual hierarchy.** Bold section headers, numbered story sections, consistent spacing. Each story should have: number badge, title, business impact paragraph, source link.

6. **Mobile-first responsive.** Already required but needs improvement. Stack images above text on mobile, ensure tap targets are 44px+ for links.

7. **"AI-Sanomat suosittelee" featured section.** A visually distinct block promoting aisanomat.fi content. This is essentially a cross-promotion section linking to the main aisanomat.fi newsletter for deeper reading.

**React Email components to use:**
- `<Section>`, `<Row>`, `<Column>` for layout
- `<Img>` with proper alt text for images
- `<Button>` for CTAs instead of `<Link>` (better tap targets)
- `<Heading>` for semantic headings
- Tailwind CSS classes (React Email v5 supports Tailwind 4)

**What NOT to do:**
- No per-client custom templates (maintenance nightmare, stated as anti-feature in v1.0 research)
- No complex interactive elements (AMP email, CSS animations) -- poor email client support
- No dark background base (breaks in too many clients) -- use light base with dark mode overrides

---

## Differentiators

Features that set the product apart and justify the premium pricing. Not strictly expected, but highly valued.

### 4. X/Twitter Monitoring (Influencer + Keyword)

| Aspect | Detail |
|--------|--------|
| **Value proposition** | AI thought leaders (Sam Altman, Andrej Karpathy, Yann LeCun, etc.) break news on X before it appears in RSS feeds. Capturing this gives the digest a timeliness advantage. |
| **Complexity** | HIGH |
| **Dependencies** | Existing `newsCollectorService.ts`, new source type in `newsSources` table |
| **Confidence** | MEDIUM -- API landscape is fragmented and expensive. Multiple viable approaches. |

**How X monitoring typically works:**

There are three approaches, each with tradeoffs:

**Option A: Official X API Basic ($200/month)**
- 15,000 tweet reads/month (Basic tier)
- User timeline endpoint: fetch latest tweets from specific accounts
- Search recent endpoint: search tweets by keyword (7-day window)
- Reliable and legal
- Limitation: 15,000 reads/month is tight. At 50 influencer accounts checked daily = 1,500 reads/month for timelines alone, leaving 13,500 for keyword searches. Sufficient for v1.1 scale.
- Pro plan ($5,000/month) gives 1,000,000 reads but is overkill for this product.

**Option B: Apify Twitter Scraper (~$0.40-0.50/1000 tweets)**
- No official API needed
- Scrapes public tweets via browser automation
- Pay per tweet, no monthly commitment
- Risk: scraping can break when X changes their UI. Less reliable than API.
- Cost: ~50 influencer accounts * 20 tweets each * 30 days = 30,000 tweets/month = ~$15/month. Massively cheaper than $200/month API.

**Option C: Third-party X data providers (tweetapi.io, Netrows, etc.)**
- REST API wrappers over X data
- Pricing varies: $0.001-0.01 per tweet
- Middle ground between official API cost and scraper reliability

**Recommendation: Start with Apify, plan migration path to official API.**

Apify at ~$15/month vs X API Basic at $200/month. For a product that does not yet have paying enterprise clients, Apify is the pragmatic choice. If reliability becomes an issue or client contracts require official data sources, upgrade to X API Basic.

**Implementation pattern:**
1. Add `'twitter'` to `sourceTypeEnum`
2. Store influencer account handles and keyword searches in `newsSources.config` (JSON):
   ```json
   {
     "type": "user_timeline",
     "handle": "sama",
     "maxTweets": 20
   }
   ```
   or
   ```json
   {
     "type": "keyword_search",
     "query": "AI regulation Finland",
     "maxTweets": 50
   }
   ```
3. New `twitterCollector.ts` integration that calls Apify Actor API
4. Map tweet -> newsItem: title = first 100 chars of tweet text, url = tweet permalink, summary = full tweet text
5. Same deduplication via URL unique constraint
6. Run collection on same daily schedule as RSS

**Per-client industry search:**
- Store industry-specific X search queries per client in a new config field
- Example: healthcare client gets `"AI healthcare" OR "AI diagnostics" OR "tekoaly terveydenhuolto"`
- These queries feed into the keyword search source type

**Key risks:**
- X frequently changes scraping countermeasures. Budget for occasional breakage.
- Tweet content is often informal/short. May need filtering to exclude memes, personal tweets, etc.
- Rate limits on Apify depend on plan. Free tier may be insufficient.

### 5. AI-Powered Web Search for News (Tavily)

| Aspect | Detail |
|--------|--------|
| **Value proposition** | RSS feeds only cover sites that publish RSS. Web search finds breaking news, blog posts, and niche industry content that RSS misses. Tavily is purpose-built for AI applications and returns LLM-ready snippets. |
| **Complexity** | MEDIUM |
| **Dependencies** | Existing `newsCollectorService.ts`, new source type |
| **Confidence** | HIGH -- Tavily API is well-documented, Node.js SDK available, pricing is transparent |

**How AI-powered web search for news works:**

Tavily is a search API built specifically for AI agents and RAG systems. Unlike Google SERP APIs (which return links), Tavily returns parsed, cleaned content snippets optimized for LLM consumption. This makes it ideal for feeding into the Claude digest generation pipeline.

**Tavily vs Serper comparison:**

| Criteria | Tavily | Serper |
|----------|--------|--------|
| **Purpose** | AI-native search (returns content) | Google SERP scraping (returns links) |
| **Output** | Parsed snippets ready for LLM | Raw Google results (titles + snippets) |
| **Content extraction** | Built-in (Extract API) | Requires separate scraping |
| **Free tier** | 1,000 credits/month | 2,500 queries/month |
| **Paid pricing** | $30/mo for 4,000 credits | $50/mo for 50K queries |
| **Node.js SDK** | Official `@tavily/core` | Official `serper` npm |
| **Best for** | Content for AI consumption | Volume search result scraping |

**Recommendation: Tavily.** The content extraction and LLM-ready snippets directly benefit the digest generation pipeline. The free tier (1,000 searches/month) is sufficient for initial development and testing. At scale, the $30/month plan (4,000 credits) covers ~130 searches/day, which is ample for daily industry-specific searches across all clients.

**Implementation pattern:**
1. Add `'web_search'` to `sourceTypeEnum`
2. Install `@tavily/core` (official Node.js SDK)
3. New `tavilyCollector.ts` integration:
   ```typescript
   import { tavily } from '@tavily/core';
   const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

   async function searchForNews(query: string): Promise<NewsItem[]> {
     const response = await tvly.search(query, {
       searchDepth: 'basic', // 1 credit per search
       maxResults: 10,
       includeAnswer: false,
       includeDomains: [], // optional: restrict to known AI news sites
     });
     return response.results.map(r => ({
       title: r.title,
       url: r.url,
       summary: r.content, // Tavily returns cleaned content
       publishedAt: null, // Tavily doesn't always return dates
     }));
   }
   ```
4. Per-client industry search queries stored in `newsSources.config`:
   ```json
   {
     "query": "tekoaly terveydenhuolto uutiset", // Finnish: AI healthcare news
     "searchDepth": "basic",
     "maxResults": 10,
     "includeDomains": ["yle.fi", "hs.fi", "kauppalehti.fi"]
   }
   ```
5. Schedule web searches to run after RSS collection (same daily 06:00 schedule)
6. Same dedup via URL unique constraint on `newsItems`

**Per-client industry prompts:**
- Each client gets configurable search queries based on their industry
- Admin can edit these in the client settings panel
- Default queries generated from industry name: `"AI ${industry} news"`, `"tekoaly ${industry}"`
- Claude can also be used to generate optimal search queries per industry (meta-use of AI)

**Credit budget estimation:**
- 10 clients * 3 search queries each * 30 days = 900 basic searches/month = 900 credits
- Well within the free tier (1,000 credits/month)
- At 20+ clients, need $30/month Bootstrap plan

### 6. Semantic Deduplication

| Aspect | Detail |
|--------|--------|
| **Value proposition** | URL dedup catches exact duplicates but misses the same story reported by different outlets. Semantic dedup prevents the digest from covering the "same news from 3 different angles" problem. |
| **Complexity** | MEDIUM-HIGH |
| **Dependencies** | Existing `newsItems` table, new embedding storage |
| **Confidence** | MEDIUM -- concept is well-understood, but Finnish language embeddings and threshold tuning require experimentation |

**How semantic deduplication works:**

1. **Generate embeddings:** Convert each news item's title + summary into a vector (array of floats)
2. **Compare similarity:** Calculate cosine similarity between new item and existing items
3. **Threshold:** If similarity > threshold (e.g., 0.85), flag as duplicate
4. **Action:** Either skip the duplicate or link it as a "related source" to the original

**Embedding approach options:**

| Approach | Cost | Latency | Finnish support | Complexity |
|----------|------|---------|-----------------|------------|
| **OpenAI text-embedding-3-small** | $0.02/1M tokens | ~100ms/call | Good multilingual | LOW -- simple API call |
| **Voyage AI voyage-multilingual-2** | Free first 200M tokens | ~100ms/call | Excellent multilingual | LOW -- REST API |
| **Local embeddings.js** | Free | ~50ms/call | Poor for Finnish | MEDIUM -- local model setup |
| **Claude-based similarity** | Expensive | ~1s/call | Excellent Finnish | LOW code, HIGH cost |

**Recommendation: OpenAI text-embedding-3-small.**

Reasons:
- Best cost/quality balance for this scale. At ~30 new items/day * 365 days = ~11K items/year. Token cost is negligible (under $1/year).
- Good multilingual support including Finnish.
- Simple Node.js SDK (`openai` npm package, already widely used).
- 1536-dimensional embeddings are sufficient for semantic similarity.
- Voyage AI is a strong alternative (Anthropic's recommended partner), especially `voyage-multilingual-2` for Finnish. The free 200M token tier is generous. Choose between them at implementation time.

**Implementation pattern:**

1. Add `embedding` column to `newsItems` table (or separate `news_embeddings` table to keep the main table lean):
   ```
   news_embeddings table:
     newsItemId: integer FK -> news_items.id
     embedding: vector(1536)  -- PostgreSQL pgvector extension
     model: varchar(50)       -- track which model generated it
   ```

2. On news item insert, generate embedding asynchronously:
   ```typescript
   const embedding = await openai.embeddings.create({
     model: 'text-embedding-3-small',
     input: `${item.title}. ${item.summary || ''}`,
   });
   ```

3. Before inserting a new item, check similarity against recent items (last 7-14 days):
   ```sql
   SELECT ni.id, ni.title, 1 - (ne.embedding <=> $1) as similarity
   FROM news_embeddings ne
   JOIN news_items ni ON ne.news_item_id = ni.id
   WHERE ni.collected_at > NOW() - INTERVAL '14 days'
     AND 1 - (ne.embedding <=> $1) > 0.85
   ORDER BY similarity DESC
   LIMIT 5;
   ```

4. If similarity > 0.85, mark the new item as a semantic duplicate:
   - Option A: Skip it entirely (simple)
   - Option B: Store it but link to the "canonical" item and use it as an additional source (richer)

**PostgreSQL pgvector requirement:**
- Railway PostgreSQL supports extensions. Need to enable `pgvector`:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```
- This adds the `vector` data type and `<=>` cosine distance operator
- Drizzle ORM supports pgvector via `drizzle-orm/pg-core` custom types

**Threshold tuning:**
- Start with 0.85 cosine similarity threshold
- Log near-misses (0.75-0.85) for manual review
- Adjust based on false positive/negative rates
- Finnish headlines may need a different threshold than English -- test with real data

**Key considerations:**
- Embedding generation adds ~100ms latency per news item on collection. Acceptable for a daily batch process.
- pgvector is production-ready (v0.7+ on Railway). Not experimental.
- Store model name with embeddings to enable re-embedding if model changes.
- Consider a "duplicate cluster" concept: group semantically similar items and let Claude pick the best source when generating the digest.

### 7. Email Feedback Loop (Thumbs Up/Down)

| Aspect | Detail |
|--------|--------|
| **Value proposition** | Direct signal of content quality from readers. More actionable than open rates (which Apple MPP inflates). Demonstrates to enterprise clients that the product listens to their team. |
| **Complexity** | LOW-MEDIUM |
| **Dependencies** | Existing email template, existing webhook system, new feedback table |
| **Confidence** | HIGH -- simple link-based tracking, no complex email client compatibility issues |

**How email feedback loops work in newsletters:**

The implementation is simpler than most people expect. It uses regular HTML links, not interactive elements.

**Pattern:**
1. At the bottom of each digest email, add two links: thumbs up and thumbs down (using emoji or simple text: "Hyodyllinen / Ei hyodyllinen")
2. Each link points to a unique URL with a signed token:
   ```
   https://app.aisanomat.fi/api/feedback?token=SIGNED_JWT&rating=up
   https://app.aisanomat.fi/api/feedback?token=SIGNED_JWT&rating=down
   ```
3. The token encodes: `{ issueId, memberId, exp }` -- signed with jose (already in the stack)
4. When clicked, the API endpoint records the feedback and redirects to a thank-you page
5. The thank-you page can optionally ask for more detail (text input) but the one-click rating is the primary data point

**Why links, not embedded forms:**
- HTML `<form>` elements are stripped by most email clients (Gmail, Outlook)
- Interactive email (AMP) has abysmal support (<5% of clients)
- Simple `<a href>` links work in 100% of email clients
- The click itself IS the feedback -- no extra interaction needed

**Implementation details:**

1. **New database table:**
   ```
   feedback table:
     id: serial PK
     issueId: integer FK -> issues.id
     memberId: integer FK -> members.id
     rating: enum('up', 'down')
     comment: text (optional, from thank-you page)
     createdAt: timestamp
   ```
   Unique constraint on (issueId, memberId) -- one vote per person per issue.

2. **Token generation (in email rendering):**
   ```typescript
   import * as jose from 'jose';

   const feedbackToken = await new jose.SignJWT({
     issueId: issue.id,
     memberId: member.id,
   })
     .setProtectedHeader({ alg: 'HS256' })
     .setExpirationTime('30d') // generous expiry for email links
     .sign(feedbackSecret);
   ```

3. **Email template addition:**
   Add a feedback section between the closing paragraph and the footer:
   ```html
   <Section style={feedbackSectionStyle}>
     <Text>Oliko tama katsaus hyodyllinen?</Text>
     <Link href={`${baseUrl}/api/feedback?token=${token}&rating=up`}>
       Kylla
     </Link>
     <Text> | </Text>
     <Link href={`${baseUrl}/api/feedback?token=${token}&rating=down`}>
       Ei
     </Link>
   </Section>
   ```

4. **API endpoint:**
   ```
   GET /api/feedback?token=XXX&rating=up|down
   -> Verify JWT, upsert feedback, redirect to /feedback/kiitos
   ```

5. **Admin dashboard additions:**
   - Per-issue satisfaction score: % thumbs up
   - Per-client trend: satisfaction over time
   - Digest with low satisfaction (<50% thumbs up) flagged for prompt review

**What this enables:**
- Content quality feedback loop: low satisfaction -> review prompt templates
- Per-client satisfaction tracking: which industries are well-served vs need better prompts
- Churn prediction: declining satisfaction trend = retention risk

---

## Anti-Features

Features that seem logical additions to v1.1 but should be explicitly avoided.

### Reddit/HN Scraping

| Why requested | Why problematic | What to do instead |
|---------------|-----------------|-------------------|
| "More diverse news sources" | Complex content moderation (comments vs posts vs links), legal ambiguity with Reddit API terms, high noise-to-signal ratio, HN has anti-scraping measures | Tavily web search already captures content that appears on HN/Reddit when it gets enough traction. The best HN/Reddit content is the linked articles, which RSS and Tavily already find. |

### Fully Automated Sending (No Admin Approval)

| Why requested | Why problematic | What to do instead |
|---------------|-----------------|-------------------|
| "Remove the bottleneck, send automatically" | Content quality is the core value. AI hallucinations at 47%+ in open-domain content. One bad newsletter damages trust permanently. The admin review step is not a bottleneck -- it is the product's quality guarantee. | Auto-schedule generation, but always require admin approval before send. The human-in-the-loop is a feature, not a bug. Revisit in v2+ with auto-approve for consistently high-quality clients. |

### Custom Email Template Per Client

| Why requested | Why problematic | What to do instead |
|---------------|-----------------|-------------------|
| "Enterprise clients want their branding" | N templates to maintain, test, and debug across email clients. Breaks the scalable model. The brand IS AI-Sanomat -- clients buy AI-Sanomat expertise, not a white-label service. | One premium AI-Sanomat template with client co-branding (company name + industry in header/subtitle). Consistent brand = trust. |

### Click Tracking

| Why requested | Why problematic | What to do instead |
|---------------|-----------------|-------------------|
| "Know which stories readers click" | Requires link wrapping (redirect through tracking URL), adds latency, privacy concerns, increases email complexity. Apple MPP may also affect click tracking accuracy. | Defer to v2.0. For v1.1, open tracking + feedback thumbs provide sufficient engagement signal. The feedback loop gives more actionable data than click tracking anyway. |

### Real-time/Daily Digest Option

| Why requested | Why problematic | What to do instead |
|---------------|-----------------|-------------------|
| "Some clients want more frequent updates" | 7x content generation costs, 7x admin review burden, subscriber fatigue. Weekly cadence is the product -- a curated digest, not a news feed. | Offer weekly/bi-weekly/monthly frequency. The minimum is weekly. If a client needs daily AI news, they need a different product. |

---

## Feature Dependencies (v1.1 specific)

```
[Source Health Monitoring]
    |
    v (improves reliability of)
[Expanded RSS Sources] + [X/Twitter Monitoring] + [Tavily Web Search]
    |
    v (feeds into)
[Semantic Deduplication]
    |
    v (cleaner news pool for)
[Existing Claude Digest Generation Pipeline]
    |
    v (renders into)
[Premium Newsletter Template Redesign]
    |
    |-- includes: AI-Sanomat brand frame
    |-- includes: Client co-branding
    |-- includes: "AI-Sanomat suosittelee" section
    |-- includes: Feedback buttons
    |
    v (delivers via)
[Existing Email Delivery (Resend)]
    |
    v (triggers)
[Email Feedback Loop] --> feeds back into content quality improvement


[Auto-Scheduled Digest Generation]
    |
    v (triggers on schedule)
[Existing generateClientDigest() pipeline]
    |
    v (creates drafts for)
[Existing Admin Preview & Approval Workflow]
```

### Dependency Notes

- **Source health monitoring should come first.** Before adding new sources (X, Tavily), build the monitoring system. Otherwise new sources can fail silently.
- **Semantic dedup depends on new sources.** URL dedup is already in place. Semantic dedup becomes valuable when multiple sources cover the same story (which happens when X, Tavily, and RSS all find the same news).
- **Template redesign is independent of sourcing changes.** Can be done in parallel with source work.
- **Feedback loop requires template changes.** The feedback buttons go in the email template, so template redesign and feedback loop should be in the same phase.
- **Auto-scheduling is independent.** Only touches scheduler.ts and client config. Can be done in any phase.

---

## Complexity and Cost Summary

| Feature | Dev Complexity | Ongoing Cost | New Dependencies |
|---------|---------------|--------------|-----------------|
| Auto-Scheduled Generation | LOW | None | None new |
| Source Health Monitoring | LOW-MEDIUM | None | None new |
| Premium Template Redesign | MEDIUM | None | None new (React Email already used) |
| X/Twitter Monitoring | HIGH | ~$15/mo (Apify) or $200/mo (X API) | Apify SDK or twitter-api-v2 |
| Tavily Web Search | MEDIUM | Free (1K/mo) to $30/mo | @tavily/core |
| Semantic Deduplication | MEDIUM-HIGH | <$1/year (OpenAI embeddings) | openai SDK, pgvector extension |
| Email Feedback Loop | LOW-MEDIUM | None | None new (jose already used) |

**Total new API costs: ~$15-45/month** (Apify + Tavily at scale) -- manageable for a SaaS product charging 29-390 EUR/mo per client.

---

## MVP Recommendation for v1.1

### Build First (highest impact, lowest risk)

1. **Source Health Monitoring** -- foundation for reliable multi-source collection
2. **Auto-Scheduled Digest Generation** -- reduces admin burden, feels like a "real" SaaS product
3. **Premium Template Redesign + Feedback Loop** -- visual quality + engagement signal (build together since both touch the template)

### Build Second (high value, moderate complexity)

4. **Tavily Web Search** -- straightforward API, immediate content quality improvement
5. **Expanded RSS Sources** -- just adding more source URLs, very low effort

### Build Last (highest complexity, most risk)

6. **X/Twitter Monitoring** -- API cost/reliability uncertainty, needs most experimentation
7. **Semantic Deduplication** -- requires pgvector setup, threshold tuning, Finnish language testing

### Rationale

Start with what makes the existing product better (monitoring, scheduling, design), then expand the news funnel (Tavily, RSS), then tackle the complex integrations (X, semantic dedup). This ordering means each phase delivers standalone value even if later phases are delayed.

---

## Sources

### HIGH confidence
- [Tavily API Credits & Pricing](https://docs.tavily.com/documentation/api-credits) -- official docs, verified March 2026
- [Tavily 101: AI-powered Search](https://www.tavily.com/blog/tavily-101-ai-powered-search-for-developers) -- official blog
- [React Email Templates](https://react.email/templates) -- official React Email site
- [Resend Webhooks](https://resend.com/docs/webhooks/introduction) -- official Resend docs
- [Anthropic Embeddings Recommendation](https://platform.claude.com/docs/en/build-with-claude/embeddings) -- official Claude docs, recommends Voyage AI
- [node-cron npm](https://www.npmjs.com/package/node-cron) -- npm, scheduling patterns

### MEDIUM confidence
- [X/Twitter API Pricing 2026](https://getlate.dev/blog/twitter-api-pricing) -- third-party analysis, verified against multiple sources
- [Apify Twitter Scraper](https://apify.com/scrapers/twitter) -- official Apify listing
- [Email Design Best Practices 2026 - Brevo](https://www.brevo.com/blog/email-design-best-practices/) -- industry guide
- [Email Design Trends 2026 - Designmodo](https://designmodo.com/email-design-trends/) -- industry trends
- [Voyage AI Pricing](https://docs.voyageai.com/docs/pricing) -- official docs
- [Best SERP API Comparison 2025](https://dev.to/ritza/best-serp-api-comparison-2025-serpapi-vs-exa-vs-tavily-vs-scrapingdog-vs-scrapingbee-2jci) -- developer comparison
- [Semantic Deduplication - NVIDIA NeMo](https://docs.nvidia.com/nemo-framework/user-guide/25.07/datacuration/semdedup.html) -- technical reference

### LOW confidence
- [Embeddings.js](https://embeddingsjs.themaximalist.com/) -- local Node.js embeddings, untested for Finnish
- [Email Feedback Loop Explained - Mailtrap](https://mailtrap.io/blog/email-feedback-loop/) -- general overview, not specific to newsletter thumbs-up pattern
- [Apify pricing per tweet](https://medium.com/@rishikeshjadhav21/how-i-replaced-the-expensive-x-twitter-api-with-apify-saving-95-while-getting-faster-b9525e4d6312) -- single blog post, pricing may have changed

---
*Feature research for: AI-Sanomat Yrityksille v1.1 Smart Sourcing & Polish*
*Researched: 2026-03-03*
