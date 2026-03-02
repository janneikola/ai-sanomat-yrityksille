# AI-Sanomat Yrityksille

## What This Is

An independent Node.js application that automates AI-curated weekly newsletters for enterprise clients. It collects AI news from multiple sources, generates industry-tailored Finnish-language digests using Claude API, validates facts, generates images with Gemini Nano Banana 2, and delivers via Resend. Includes an admin panel for Janne (content management, client management, preview/approve workflow) and a company portal for enterprise contacts (team management, open rate stats).

## Core Value

The AI-generated weekly digest must be genuinely useful and industry-relevant — bad content kills trust, and content quality is the entire selling point differentiating this from generic AI newsletters.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Collect AI news from multiple sources (RSS, Beehiiv API, manual entry; X/Reddit/web later)
- [ ] Generate industry-tailored weekly digests using Claude API (Sonnet 4.6)
- [ ] Two-pass content pipeline: generation + fact validation (second Claude call)
- [ ] Generate newsletter images with Gemini Nano Banana 2 (hero + section images)
- [ ] Admin panel: manage clients, news sources, prompt templates, generate/preview/approve digests
- [ ] Company portal: magic link auth, add/remove team members, view open rates
- [ ] Send emails via Resend with own domain (mail.aisanomat.fi), SPF/DKIM/DMARC
- [ ] Prompt templates stored in database, editable from admin panel
- [ ] Responsive HTML email templates (React Email) with AI-Sanomat branding
- [ ] PostgreSQL database on Railway for all data
- [ ] Admin auth: hardcoded email/password (MVP — just Janne)
- [ ] Tracking pixels for open rate monitoring
- [ ] Bounce handling (hard bounce → mark member as bounced)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Stripe billing integration — manual invoicing for MVP
- Multiple newsletters per week — only 1x/week
- Multi-language support — Finnish only
- Mobile app — web-first
- Beehiiv integration — intentionally separate system
- A/B testing for email content — premature optimization
- Team member self-unsubscribe — company contact handles removals
- Kehotesuunnittelija Pro / kehotepaketit — integrate later from separate system
- Live webinars — manual service, not part of the app
- Slack/Teams support channel — manual service, not part of the app
- Quarterly report auto-generation — manual for now

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
*Last updated: 2026-03-02 after initialization*
