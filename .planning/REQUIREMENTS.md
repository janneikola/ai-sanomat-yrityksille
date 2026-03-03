# Requirements: AI-Sanomat Yrityksille

**Defined:** 2026-03-02
**Core Value:** The AI-generated weekly digest must be genuinely useful and industry-relevant -- content quality is the entire selling point.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation

- [x] **FOUND-01**: PostgreSQL database schema with all tables (clients, members, news_items, issues, delivery_stats, news_sources, prompt_templates)
- [x] **FOUND-02**: Fastify API server with typed routes and JSON Schema validation
- [x] **FOUND-03**: Admin can log in with hardcoded email/password and receive JWT token
- [ ] **FOUND-04**: Application deploys to Railway (API + DB + frontend)
- [x] **FOUND-05**: Monorepo structure with npm workspaces (api/, web/, packages/shared/)

### Content Pipeline

- [x] **CONT-01**: System collects AI news from RSS feeds on a daily schedule
- [x] **CONT-02**: System fetches latest articles from Beehiiv API (aisanomat.fi)
- [x] **CONT-03**: Admin can manually add news items via the admin panel
- [x] **CONT-04**: Collected news items are deduplicated by URL
- [x] **CONT-05**: Admin can manage prompt templates (view, edit) from the admin panel
- [x] **CONT-06**: System generates industry-tailored Finnish digest using Claude Sonnet per client
- [x] **CONT-07**: System validates generated content against source articles in a second Claude call
- [x] **CONT-08**: Validation flags uncertain claims and stores a quality report per digest
- [x] **CONT-09**: System generates hero image (1200x630) and section images (800x450) with Gemini
- [x] **CONT-10**: Image generation failure degrades gracefully to text-only digest

### Email Delivery

- [x] **EMAIL-01**: System renders responsive HTML email using React Email with AI-Sanomat branding
- [x] **EMAIL-02**: System sends emails via Resend using own domain (mail.aisanomat.fi)
- [ ] **EMAIL-03**: SPF, DKIM, and DMARC DNS records configured for mail.aisanomat.fi (requires manual DNS setup)
- [x] **EMAIL-04**: System processes Resend webhooks for delivery, open, and bounce events
- [x] **EMAIL-05**: Hard-bounced member emails are automatically suppressed from future sends
- [x] **EMAIL-06**: Every email includes List-Unsubscribe header (RFC 8058)
- [x] **EMAIL-07**: Both HTML and plain text versions included in every email

### Admin Panel

- [x] **ADMIN-01**: Admin can add, edit, and list enterprise clients with name, industry, contact info, and plan
- [x] **ADMIN-02**: Admin can add, edit, activate/deactivate news sources (RSS, Beehiiv, manual)
- [x] **ADMIN-03**: Admin can trigger digest generation for a specific client
- [x] **ADMIN-04**: Admin can preview generated digest (with images) before sending
- [x] **ADMIN-05**: Admin can approve and send, or regenerate a digest
- [x] **ADMIN-06**: Dashboard shows all clients with team size, latest send date, and open rate

### Company Portal

- [x] **PORTAL-01**: Company contact receives magic link via email and logs in without password
- [x] **PORTAL-02**: Company contact can add and remove team members (email addresses)

## v1.1 Requirements

Requirements for Smart Sourcing & Polish milestone. Each maps to roadmap phases 5+.

### Scheduling

- [x] **SCHED-01**: System auto-generates draft digests on each client's configured schedule (weekly/bi-weekly/monthly)
- [x] **SCHED-02**: Admin can configure per-client send frequency (weekly, bi-weekly, monthly) and preferred day/time
- [x] **SCHED-03**: Scheduling uses database-driven state (survives Railway deploys), not in-memory cron
- [x] **SCHED-04**: System prevents duplicate generation if digest already exists for current period

### Newsletter Design

- [ ] **DESIGN-01**: Newsletter uses premium clean layout with generous whitespace and modern typography
- [ ] **DESIGN-02**: Newsletter includes AI-Sanomat brand header with logo and accent color bar
- [ ] **DESIGN-03**: Newsletter includes client company name and industry in header area
- [ ] **DESIGN-04**: Newsletter supports dark mode via prefers-color-scheme media query
- [ ] **DESIGN-05**: Newsletter includes "AI-Sanomat suosittelee" featured section with recent aisanomat.fi posts
- [ ] **DESIGN-06**: Newsletter footer includes AI-Sanomat links, company info, and consistent branding

### News Sourcing

- [ ] **SRC-01**: System monitors curated X influencer accounts and collects AI-related posts
- [ ] **SRC-02**: System searches X by keyword for AI topics and trending discussions
- [ ] **SRC-03**: System searches web via Tavily for industry-specific AI news per client
- [ ] **SRC-04**: Admin can configure per-client industry search prompts for Tavily queries
- [ ] **SRC-05**: System checks aisanomat.fi for new blog posts and makes them available for the featured section
- [ ] **SRC-06**: Admin can add and manage X influencer accounts and keyword searches as source types
- [ ] **SRC-07**: X API usage tracked with monthly budget cap to prevent cost overruns

### Semantic Deduplication

- [ ] **DEDUP-01**: System generates embeddings for news items using OpenAI text-embedding-3-small
- [ ] **DEDUP-02**: System detects semantically similar news items across sources using cosine similarity
- [ ] **DEDUP-03**: Near-duplicate items are flagged (not silently deleted) with link to canonical item
- [ ] **DEDUP-04**: Admin can view deduplication decisions and override false positives

### Source Health

- [x] **HEALTH-01**: System tracks per-source health metrics (last success, consecutive failures, items per fetch)
- [x] **HEALTH-02**: Stale and failing sources are detected automatically with configurable thresholds
- [ ] **HEALTH-03**: Admin panel shows source health status (green/yellow/red) on source list
- [x] **HEALTH-04**: Persistently failing sources are auto-disabled with admin notification

### Engagement

- [ ] **FEED-01**: Newsletter includes thumbs up/down feedback links at the bottom
- [ ] **FEED-02**: Feedback is recorded per member per digest with one-click (no login required)
- [ ] **FEED-03**: Admin dashboard shows per-digest and per-client satisfaction scores
- [ ] **FEED-04**: Low satisfaction digests are flagged for prompt template review

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Company Portal Enhancements

- **PORTAL-03**: Company contact can view open rate stats per newsletter send
- **PORTAL-04**: Company engagement dashboard with aggregate trends (open rate over time, top topics)
- **PORTAL-05**: Newsletter archive -- company contact can view past digests

### Content Enhancements

- **CONT-11**: Source relevance scoring -- AI rates article relevance per industry before generation

### Admin Enhancements

- **ADMIN-07**: Admin analytics dashboard -- cross-client engagement, generation costs, churn risk
- **ADMIN-08**: Content quality scoring visible in dashboard per digest

### Integrations

- **INTG-02**: Reddit news source collection
- **INTG-04**: Stripe billing integration

### Automation

- **AUTO-01**: Fully automated sending without admin approval (for trusted high-quality clients)
- **AUTO-02**: Click tracking (link wrapping infrastructure)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| A/B testing for email content | Premature with small client base, results statistically meaningless |
| Daily digest frequency | 7x content generation cost, subscriber fatigue; weekly minimum is the product |
| Multi-language support | Finnish is the competitive moat, English newsletters already exist |
| Mobile app | Web-first, email is the delivery channel |
| Beehiiv integration for sending | Intentionally separate system -- Beehiiv can't do per-client tailoring |
| Self-service team member unsubscribe | Company contact manages team, individual unsubscribe undermines enterprise model |
| Custom email template per client | One AI-Sanomat brand with co-branding, not white-label |
| Self-serve company signup | Enterprise clients need personal onboarding |
| Rich text editor for digests | If AI output needs editing, fix the prompts, not add an editor |
| Slack/Teams delivery | Email-only; if 5+ clients request, build a simple webhook forwarder |
| Reddit/HN scraping | Legal ambiguity, high noise-to-signal; best content surfaces via Tavily |
| Live webinars | Manual service, not part of the app |
| Kehotesuunnittelija Pro | Integrate later from separate system |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

### v1.0 (Complete)

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete |
| FOUND-02 | Phase 1 | Complete |
| FOUND-03 | Phase 1 | Complete |
| FOUND-04 | Phase 1 | Pending |
| FOUND-05 | Phase 1 | Complete |
| CONT-01 | Phase 2 | Complete |
| CONT-02 | Phase 2 | Complete |
| CONT-03 | Phase 2 | Complete |
| CONT-04 | Phase 2 | Complete |
| CONT-05 | Phase 1 | Complete |
| CONT-06 | Phase 2 | Complete |
| CONT-07 | Phase 2 | Complete |
| CONT-08 | Phase 2 | Complete |
| CONT-09 | Phase 2 | Complete |
| CONT-10 | Phase 2 | Complete |
| EMAIL-01 | Phase 3 | Complete |
| EMAIL-02 | Phase 3 | Complete |
| EMAIL-03 | Phase 3 | Pending (manual DNS setup) |
| EMAIL-04 | Phase 3 | Complete |
| EMAIL-05 | Phase 3 | Complete |
| EMAIL-06 | Phase 3 | Complete |
| EMAIL-07 | Phase 3 | Complete |
| ADMIN-01 | Phase 1 | Complete |
| ADMIN-02 | Phase 1 | Complete |
| ADMIN-03 | Phase 3 | Complete |
| ADMIN-04 | Phase 3 | Complete |
| ADMIN-05 | Phase 3 | Complete |
| ADMIN-06 | Phase 3 | Complete |
| PORTAL-01 | Phase 4 | Complete |
| PORTAL-02 | Phase 4 | Complete |

### v1.1 (Mapped)

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHED-01 | Phase 5 | Complete |
| SCHED-02 | Phase 5 | Complete |
| SCHED-03 | Phase 5 | Complete |
| SCHED-04 | Phase 5 | Complete |
| DESIGN-01 | Phase 6 | Pending |
| DESIGN-02 | Phase 6 | Pending |
| DESIGN-03 | Phase 6 | Pending |
| DESIGN-04 | Phase 6 | Pending |
| DESIGN-05 | Phase 6 | Pending |
| DESIGN-06 | Phase 6 | Pending |
| SRC-01 | Phase 9 | Pending |
| SRC-02 | Phase 9 | Pending |
| SRC-03 | Phase 7 | Pending |
| SRC-04 | Phase 7 | Pending |
| SRC-05 | Phase 6 | Pending |
| SRC-06 | Phase 9 | Pending |
| SRC-07 | Phase 9 | Pending |
| DEDUP-01 | Phase 8 | Pending |
| DEDUP-02 | Phase 8 | Pending |
| DEDUP-03 | Phase 8 | Pending |
| DEDUP-04 | Phase 8 | Pending |
| HEALTH-01 | Phase 5 | Complete |
| HEALTH-02 | Phase 5 | Complete |
| HEALTH-03 | Phase 5 | Pending |
| HEALTH-04 | Phase 5 | Complete |
| FEED-01 | Phase 6 | Pending |
| FEED-02 | Phase 6 | Pending |
| FEED-03 | Phase 6 | Pending |
| FEED-04 | Phase 6 | Pending |

**Coverage:**
- v1.1 requirements: 29 total
- Mapped to phases: 29/29
- Unmapped: 0

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-03 after v1.1 roadmap creation*
