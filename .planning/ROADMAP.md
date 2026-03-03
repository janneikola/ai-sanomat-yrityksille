# Roadmap: AI-Sanomat Yrityksille

## Milestones

- v1.0 Full Platform - Phases 1-4 (shipped 2026-03-03)
- v1.1 Smart Sourcing & Polish - Phases 5-9 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3...): Planned milestone work
- Decimal phases (5.1, 5.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>v1.0 Full Platform (Phases 1-4) - SHIPPED 2026-03-03</summary>

- [x] **Phase 1: Foundation and Admin Setup** - Database, API, auth, deployment, client/source management
- [x] **Phase 2: Content Pipeline** - News collection, AI digest generation, fact validation, image generation
- [x] **Phase 3: Email Delivery and Send Workflow** - Email rendering, Resend integration, admin digest preview/approve/send, dashboard
- [x] **Phase 4: Company Portal** - Magic link auth and team management for enterprise contacts

### Phase 1: Foundation and Admin Setup
**Goal**: Admin (Janne) can log in, manage clients and news sources, and the entire stack runs on Railway
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, ADMIN-01, ADMIN-02, CONT-05
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Monorepo structure, database schema (all 7 tables), Fastify API with auth and CRUD routes, shared Zod schemas
- [x] 01-02-PLAN.md — Next.js 16 admin panel with shadcn/ui, login, sidebar, client/source/template CRUD pages, seed data, Railway deployment

### Phase 2: Content Pipeline
**Goal**: System collects AI news daily and generates industry-tailored, fact-validated Finnish digests with images per client
**Depends on**: Phase 1
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04, CONT-06, CONT-07, CONT-08, CONT-09, CONT-10
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — News collection: RSS feed parsing, Beehiiv API client, news collector service, daily cron scheduler, manual entry API+UI, deduplication
- [x] 02-02-PLAN.md — Digest generation: Claude structured output for content generation, fact validation with language quality check, Gemini image generation with fallback, newsletter service pipeline

### Phase 3: Email Delivery and Send Workflow
**Goal**: Admin can preview, approve, and send digests as branded HTML emails, and the system tracks delivery, opens, and bounces
**Depends on**: Phase 2
**Requirements**: EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-04, EMAIL-05, EMAIL-06, EMAIL-07, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — React Email template, Resend integration, email service, webhook processing, bounce handling, dashboard API, digest workflow endpoints
- [x] 03-02-PLAN.md — Admin client detail page with digest generate/preview/approve/send workflow, dashboard delivery stats table

### Phase 4: Company Portal
**Goal**: Enterprise contacts can self-manage their team members via a passwordless login
**Depends on**: Phase 3
**Requirements**: PORTAL-01, PORTAL-02
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — Magic link auth backend: JWT-based magic link service, React Email template, portal API routes (auth + members CRUD + archive), middleware update
- [x] 04-02-PLAN.md — Portal frontend UI: login/verify pages, branded sidebar, team management page (add/bulk/remove), newsletter archive page

</details>

### v1.1 Smart Sourcing & Polish (In Progress)

**Milestone Goal:** Transform news collection into comprehensive multi-source intelligence, automate digest scheduling, redesign newsletter visuals, and add source health monitoring with engagement feedback.

- [ ] **Phase 5: Foundation Automation** - Database-driven scheduling, per-client frequency, source health monitoring
- [ ] **Phase 6: Premium Email Experience** - Newsletter template redesign, co-branding, dark mode, aisanomat.fi section, email feedback loop
- [ ] **Phase 7: Web Search Integration** - Tavily industry-specific search with per-client prompts, search caching
- [ ] **Phase 8: Semantic Deduplication** - Embedding-based near-duplicate detection across all sources
- [ ] **Phase 9: X/Twitter Monitoring** - Influencer timelines, keyword search, budget tracking

## Phase Details

### Phase 5: Foundation Automation
**Goal**: System generates draft digests automatically on each client's schedule and monitors source reliability without manual intervention
**Depends on**: Phase 4
**Requirements**: SCHED-01, SCHED-02, SCHED-03, SCHED-04, HEALTH-01, HEALTH-02, HEALTH-03, HEALTH-04
**Success Criteria** (what must be TRUE):
  1. System auto-generates a draft digest when a client's configured schedule is due, without admin triggering it
  2. Admin can set per-client frequency (weekly/bi-weekly/monthly) and preferred day/time, and the system respects it
  3. If a digest already exists for the current period, the system does not generate a duplicate
  4. Admin panel shows each news source with a green/yellow/red health indicator based on recent fetch success
  5. Sources that fail persistently are auto-disabled and admin receives a notification
**Plans**: TBD

Plans:
- [x] 05-01: Database schema changes (client schedule columns, source health columns, sourceHealthLogs table), schedule service, daily cron that checks DB for due clients
- [ ] 05-02: Source health service (tracking, thresholds, auto-disable), admin UI for schedule config and source health display

### Phase 6: Premium Email Experience
**Goal**: Newsletters look premium with AI-Sanomat branding and client co-branding, include an aisanomat.fi featured section, and readers can give one-click feedback
**Depends on**: Phase 5
**Requirements**: DESIGN-01, DESIGN-02, DESIGN-03, DESIGN-04, DESIGN-05, DESIGN-06, SRC-05, FEED-01, FEED-02, FEED-03, FEED-04
**Success Criteria** (what must be TRUE):
  1. Newsletter renders with clean modern layout, AI-Sanomat logo header, accent color bar, and consistent footer branding
  2. Newsletter shows the client company name and industry in the header area
  3. Newsletter includes an "AI-Sanomat suosittelee" section with recent aisanomat.fi blog posts
  4. Newsletter renders correctly in dark mode email clients (prefers-color-scheme)
  5. Reader can tap thumbs up/down in the email and their feedback is recorded without login, and admin sees per-digest satisfaction scores
**Plans**: TBD

Plans:
- [ ] 06-01: aisanomat.fi blog post collector (SRC-05), premium React Email template redesign (brand header, co-branding, dark mode, featured section, footer)
- [ ] 06-02: Feedback system (JWT-signed vote links, feedbackVotes table, one-click endpoint, thank-you page, admin satisfaction dashboard)

### Phase 7: Web Search Integration
**Goal**: System finds industry-specific AI news via web search that RSS feeds miss, with per-client tailored queries
**Depends on**: Phase 5
**Requirements**: SRC-03, SRC-04
**Success Criteria** (what must be TRUE):
  1. System fetches AI news via Tavily web search and stores results as news items alongside RSS/Beehiiv items
  2. Admin can configure per-client industry search prompts that drive Tavily queries for that client's digests
**Plans**: TBD

Plans:
- [ ] 07-01: Tavily webSearchClient integration, web_search source type, per-client searchPrompt field, search result caching, collection pipeline integration

### Phase 8: Semantic Deduplication
**Goal**: System detects and flags near-duplicate news items across all sources using semantic similarity, not just URL matching
**Depends on**: Phase 7
**Requirements**: DEDUP-01, DEDUP-02, DEDUP-03, DEDUP-04
**Success Criteria** (what must be TRUE):
  1. Every collected news item gets an embedding vector stored in the database
  2. Near-duplicate items are automatically flagged with a link to the canonical item, not silently deleted
  3. Admin can view deduplication decisions and override false positives from the admin panel
**Plans**: TBD

Plans:
- [ ] 08-01: pgvector extension, embeddingClient (OpenAI text-embedding-3-small), embedding generation pipeline, cosine similarity dedup service with two-tier thresholds, admin dedup review UI

### Phase 9: X/Twitter Monitoring
**Goal**: System collects breaking AI news from X influencer accounts and keyword searches with budget protection
**Depends on**: Phase 5
**Requirements**: SRC-01, SRC-02, SRC-06, SRC-07
**Success Criteria** (what must be TRUE):
  1. System fetches recent posts from configured X influencer accounts and stores AI-relevant items as news
  2. System searches X by configured keywords for AI topics and trending discussions
  3. Admin can add and manage X influencer accounts and keyword searches as source types
  4. X API usage is tracked with a monthly budget cap that prevents cost overruns, visible in admin dashboard
**Plans**: TBD

Plans:
- [ ] 09-01: X API client (xClient), x_account and x_search source types, influencer timeline and keyword search collection, since_id pagination, monthly budget tracker, admin X source management and usage dashboard

## Progress

**Execution Order:**
Phases execute in numeric order: 5 -> 6 -> 7 -> 8 -> 9
(Phases 7 and 9 both depend on Phase 5, not on each other. Phase 8 depends on Phase 7.)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation and Admin Setup | v1.0 | 2/2 | Complete | 2026-03-02 |
| 2. Content Pipeline | v1.0 | 2/2 | Complete | 2026-03-02 |
| 3. Email Delivery and Send Workflow | v1.0 | 2/2 | Complete | 2026-03-02 |
| 4. Company Portal | v1.0 | 2/2 | Complete | 2026-03-03 |
| 5. Foundation Automation | v1.1 | 1/2 | In progress | - |
| 6. Premium Email Experience | v1.1 | 0/2 | Not started | - |
| 7. Web Search Integration | v1.1 | 0/1 | Not started | - |
| 8. Semantic Deduplication | v1.1 | 0/1 | Not started | - |
| 9. X/Twitter Monitoring | v1.1 | 0/1 | Not started | - |
