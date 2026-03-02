# Roadmap: AI-Sanomat Yrityksille

## Overview

Build an enterprise AI newsletter platform from scratch: database and API foundation with admin basics, then the AI content pipeline (collection, generation, validation, images), then email delivery with the admin send/approve workflow, and finally the company portal for enterprise clients. Each phase delivers a coherent, testable capability that unblocks the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation and Admin Setup** - Database, API, auth, deployment, client/source management
- [ ] **Phase 2: Content Pipeline** - News collection, AI digest generation, fact validation, image generation
- [ ] **Phase 3: Email Delivery and Send Workflow** - Email rendering, Resend integration, admin digest preview/approve/send, dashboard
- [ ] **Phase 4: Company Portal** - Magic link auth and team management for enterprise contacts

## Phase Details

### Phase 1: Foundation and Admin Setup
**Goal**: Admin (Janne) can log in, manage clients and news sources, and the entire stack runs on Railway
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, ADMIN-01, ADMIN-02, CONT-05
**Success Criteria** (what must be TRUE):
  1. Admin can log in at the web app with email/password and sees the admin dashboard
  2. Admin can create, edit, and list enterprise clients with industry and plan info
  3. Admin can add, edit, and activate/deactivate news sources (RSS, Beehiiv, manual)
  4. Admin can view and edit prompt templates from the admin panel
  5. Application is live on Railway with API, database, and frontend all accessible
**Plans**: TBD

Plans:
- [ ] 01-01: Database schema, Fastify API skeleton, monorepo structure
- [ ] 01-02: Admin auth, Next.js frontend, client/source/template CRUD, Railway deployment

### Phase 2: Content Pipeline
**Goal**: System collects AI news daily and generates industry-tailored, fact-validated Finnish digests with images per client
**Depends on**: Phase 1
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04, CONT-06, CONT-07, CONT-08, CONT-09, CONT-10
**Success Criteria** (what must be TRUE):
  1. News items appear in the system daily from RSS feeds and Beehiiv API without manual intervention
  2. Admin can manually add a news item and it is deduplicated against existing items by URL
  3. System generates a Finnish-language industry-tailored digest for a specific client using collected news
  4. Generated digest includes a quality report from the validation pass with flagged uncertain claims
  5. Generated digest includes hero and section images, or degrades gracefully to text-only if image generation fails
**Plans**: TBD

Plans:
- [ ] 02-01: News collection (RSS, Beehiiv API, manual entry, deduplication)
- [ ] 02-02: Digest generation (Claude API), fact validation (second Claude call), image generation (Gemini)

### Phase 3: Email Delivery and Send Workflow
**Goal**: Admin can preview, approve, and send digests as branded HTML emails, and the system tracks delivery, opens, and bounces
**Depends on**: Phase 2
**Requirements**: EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-04, EMAIL-05, EMAIL-06, EMAIL-07, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06
**Success Criteria** (what must be TRUE):
  1. Admin can trigger digest generation for a specific client, preview it with images, and approve or regenerate
  2. Approved digest is sent as a responsive branded HTML email (with plain text fallback) to all active team members via Resend
  3. Sent emails include List-Unsubscribe header and tracking pixel for open detection
  4. System processes Resend webhooks and dashboard shows open rates per client
  5. Hard-bounced email addresses are automatically suppressed from future sends
**Plans**: TBD

Plans:
- [ ] 03-01: React Email templates, Resend integration, DNS/SPF/DKIM/DMARC setup
- [ ] 03-02: Admin send workflow (trigger, preview, approve/send), webhooks, bounce handling, dashboard

### Phase 4: Company Portal
**Goal**: Enterprise contacts can self-manage their team members via a passwordless login
**Depends on**: Phase 3
**Requirements**: PORTAL-01, PORTAL-02
**Success Criteria** (what must be TRUE):
  1. Company contact receives a magic link email and can log in without a password
  2. Logged-in company contact can add and remove team member email addresses
**Plans**: TBD

Plans:
- [ ] 04-01: Magic link auth via Resend, team member management UI

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Admin Setup | 0/2 | Not started | - |
| 2. Content Pipeline | 0/2 | Not started | - |
| 3. Email Delivery and Send Workflow | 0/2 | Not started | - |
| 4. Company Portal | 0/1 | Not started | - |
