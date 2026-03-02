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

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Company Portal Enhancements

- **PORTAL-03**: Company contact can view open rate stats per newsletter send
- **PORTAL-04**: Company engagement dashboard with aggregate trends (open rate over time, top topics)
- **PORTAL-05**: Newsletter archive -- company contact can view past digests

### Content Enhancements

- **CONT-11**: Source relevance scoring -- AI rates article relevance per industry before generation
- **CONT-12**: Automated weekly generation and send (cron: Monday 06:00)

### Admin Enhancements

- **ADMIN-07**: Admin analytics dashboard -- cross-client engagement, generation costs, churn risk
- **ADMIN-08**: Content quality scoring visible in dashboard per digest

### Integrations

- **INTG-01**: X/Twitter news source collection
- **INTG-02**: Reddit news source collection
- **INTG-03**: Web search news source collection
- **INTG-04**: Stripe billing integration

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| A/B testing for email content | Premature with small client base, results statistically meaningless |
| Multiple newsletters per week | Weekly is the product cadence, more = cost explosion |
| Multi-language support | Finnish is the competitive moat, English newsletters already exist |
| Mobile app | Web-first, email is the delivery channel |
| Beehiiv integration for sending | Intentionally separate system -- Beehiiv can't do per-client tailoring |
| Self-service team member unsubscribe | Company contact manages team, individual unsubscribe undermines enterprise model |
| Custom email template per client | One AI-Sanomat brand, not white-label -- maintain consistency |
| Self-serve company signup | Enterprise clients need personal onboarding |
| Rich text editor for digests | If AI output needs editing, fix the prompts, not add an editor |
| Slack/Teams delivery | Email-only; if 5+ clients request, build a simple webhook forwarder |
| Live webinars | Manual service, not part of the app |
| Kehotesuunnittelija Pro | Integrate later from separate system |
| Quarterly report auto-generation | Manual for now |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

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

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 after 04-01 plan completion*
