# AI-Sanomat Yrityksille

## What This Is

An independent Node.js application that automates AI-curated weekly newsletters for enterprise clients. It collects AI news from multiple sources, generates industry-tailored Finnish-language digests using Claude API, validates facts, generates images with Gemini Nano Banana 2, and delivers via Resend. Includes an admin panel for Janne (content management, client management, preview/approve workflow) and a company portal for enterprise contacts (team management, open rate stats).

## Core Value

The AI-generated weekly digest must be genuinely useful and industry-relevant — bad content kills trust, and content quality is the entire selling point differentiating this from generic AI newsletters.

## Current Milestone: v1.1 Smart Sourcing & Polish

**Goal:** Transform news collection from basic RSS/Beehiiv into comprehensive multi-source intelligence (X, web search, expanded RSS, aisanomat.fi), add automation (scheduled generation, configurable frequency), redesign newsletter visuals, and add source health monitoring with feedback loops.

**Target features:**
- Comprehensive AI news sourcing (X influencers + keyword search, Tavily/Serper web search, expanded RSS)
- Industry-specific search with per-client prompts
- aisanomat.fi featured section in newsletters
- Auto-scheduled digest generation with configurable frequency (weekly/bi-weekly/monthly)
- Premium newsletter design with AI-Sanomat + client co-branding
- Source health monitoring and quality scoring
- Semantic deduplication across sources
- Email feedback loop (thumbs up/down)

## Requirements

### Validated

<!-- Shipped and confirmed valuable. v1.0 -->

- ✓ Collect AI news from RSS and Beehiiv API — v1.0 Phase 2
- ✓ Generate industry-tailored Finnish digests using Claude API — v1.0 Phase 2
- ✓ Two-pass content pipeline: generation + fact validation — v1.0 Phase 2
- ✓ Generate newsletter images with Gemini — v1.0 Phase 2
- ✓ Admin panel: client/source/template CRUD, digest workflow — v1.0 Phases 1+3
- ✓ Company portal: magic link auth, team management, archive — v1.0 Phase 4
- ✓ Email delivery via Resend with tracking and bounce handling — v1.0 Phase 3
- ✓ PostgreSQL database on Railway — v1.0 Phase 1
- ✓ Admin auth with hardcoded credentials — v1.0 Phase 1

### Active

<!-- Current scope. Building toward these. v1.1 -->

- [ ] X monitoring: curated influencer accounts + keyword searches
- [ ] Industry-specific web search via Tavily/Serper with per-client prompts
- [ ] Expanded general AI RSS feed coverage
- [ ] aisanomat.fi featured section ("AI-Sanomat suosittelee") in newsletters
- [ ] Auto-scheduled digest generation (drafts created on schedule, admin reviews)
- [ ] Client-configurable send frequency (weekly / bi-weekly / monthly)
- [ ] Premium newsletter template redesign (clean, modern, whitespace)
- [ ] AI-Sanomat brand frame (logo, colors, header/footer)
- [ ] Client co-branding (company name/industry in newsletter)
- [ ] Source health monitoring (stale feed detection, quality scoring)
- [ ] Semantic deduplication across sources (beyond URL matching)
- [ ] Email feedback loop (thumbs up/down, satisfaction tracking)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Stripe billing integration — manual invoicing for MVP
- Multi-language support — Finnish only
- Mobile app — web-first
- Beehiiv migration — intentionally separate system, enterprise app is independent
- A/B testing for email content — premature optimization
- Team member self-unsubscribe — company contact handles removals
- Kehotesuunnittelija Pro / kehotepaketit — integrate later from separate system
- Live webinars — manual service, not part of the app
- Slack/Teams support channel — manual service, not part of the app
- Quarterly report auto-generation — manual for now
- Click tracking — deferred, opens + feedback sufficient for v1.1
- Reddit/HN scraping — complex moderation, defer to v2.0

## Context

AI-Sanomat is an established Finnish AI newsletter reaching 1,400+ subscribers via Beehiiv (aisanomat.fi), published weekly since 2023 by Janne Ikola (Verstos Oy). Enterprise packages (AI Pulse at 29€/mo per person, AI Teams at 390€/mo) are already being marketed on the website.

This app is being built because Beehiiv doesn't support: automated email sending via API, industry-specific content tailoring per client, or enterprise client management (teams, contacts, segmentation).

No pilot client yet — building the product first, then selling. Janne will be the primary power user testing and iterating on content quality through the admin panel before onboarding enterprise clients.

Gemini Nano Banana 2 API access is confirmed. Resend account exists but domain (aisanomat.fi) DNS records for sending (SPF/DKIM/DMARC) still need configuration. Railway account is ready.

## Constraints

- **Tech stack**: Node.js + Fastify (API), Next.js 15 (single app, role-based views for admin + portal), PostgreSQL (Railway), React Email
- **AI models**: Claude Sonnet 4.6 (text generation + validation), Gemini Nano Banana 2 (images)
- **Email**: Resend with own sending domain (mail.aisanomat.fi)
- **Deployment**: Railway (API + DB + frontend)
- **Auth**: Hardcoded admin credentials (MVP), magic links for company contacts via Resend
- **Frontend**: One Next.js app with role-based routing — admin panel and company portal are different routes, not separate apps
- **Language**: All user-facing content in Finnish

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separate app from Beehiiv | Beehiiv can't do per-client tailoring or API email sending | — Pending |
| Single Next.js app for admin + portal | Simpler deployment, less infra to manage | — Pending |
| Hardcoded admin auth for MVP | Only Janne uses admin, no need for full auth system yet | — Pending |
| Claude Sonnet 4.6 for generation | Cost-effective, quality sufficient for newsletter content | — Pending |
| Two-pass content pipeline (generate + validate) | Content quality is core value, must catch hallucinations | — Pending |
| Fastify over Express | Better performance, TypeScript support, schema validation | — Pending |
| Prompt templates in DB | Admin can iterate on prompts without code changes | — Pending |

---
*Last updated: 2026-03-03 after v1.1 milestone start*
