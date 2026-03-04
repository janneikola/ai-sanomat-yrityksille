# AI-Sanomat Yrityksille

## What This Is

A Node.js application that automates AI-curated weekly newsletters for enterprise clients. Collects AI news from 5 source types (RSS, Beehiiv, X/Twitter, Tavily web search, aisanomat.fi blog), generates industry-tailored Finnish-language digests using Claude API, validates facts, generates images with Gemini, detects cross-source duplicates via semantic embeddings, and delivers premium branded emails via Resend with reader feedback tracking. Includes admin panel (content management, client management, scheduling, source health monitoring, deduplication review, X budget tracking) and company portal (team management via magic links).

## Core Value

The AI-generated weekly digest must be genuinely useful and industry-relevant — bad content kills trust, and content quality is the entire selling point differentiating this from generic AI newsletters.

## Requirements

### Validated

- ✓ Collect AI news from RSS and Beehiiv API — v1.0
- ✓ Generate industry-tailored Finnish digests using Claude API — v1.0
- ✓ Two-pass content pipeline: generation + fact validation — v1.0
- ✓ Generate newsletter images with Gemini — v1.0
- ✓ Admin panel: client/source/template CRUD, digest workflow — v1.0
- ✓ Company portal: magic link auth, team management, archive — v1.0
- ✓ Email delivery via Resend with tracking and bounce handling — v1.0
- ✓ PostgreSQL database on Railway — v1.0
- ✓ Admin auth with hardcoded credentials — v1.0
- ✓ Auto-scheduled digest generation with per-client frequency — v1.1
- ✓ Source health monitoring with auto-disable and admin notification — v1.1
- ✓ Premium email template with AI-Sanomat branding, dark mode, client co-branding — v1.1
- ✓ aisanomat.fi featured section in newsletters — v1.1
- ✓ One-click reader feedback (thumbs up/down) with satisfaction dashboard — v1.1
- ✓ Tavily web search with per-client industry queries — v1.1
- ✓ Semantic deduplication with OpenAI embeddings and pgvector — v1.1
- ✓ X/Twitter monitoring: influencer timelines + keyword search + budget tracking — v1.1

### Active

## Current Milestone: v1.2 Newsletter Quality & Design

**Goal:** Make the HTML newsletter significantly better — structured content, relevant images, proper branding.

**Target features:**
- Structured article content with subheadings, lists, bold, highlights (not single text blocks)
- Relevant images from source OG metadata, with AI infographic fallback
- AI-Sanomat branded header with real logo icon + text

### Carry-over

- [ ] Fix health dot key mismatch in X monitoring page (INT-01)
- [ ] Filter isDuplicate items from digest generation (INT-02)

### Out of Scope

- Stripe billing integration — manual invoicing for MVP
- Multi-language support — Finnish only, competitive moat
- Mobile app — web-first, email is delivery channel
- Beehiiv migration — intentionally separate system
- A/B testing for email content — premature with small client base
- Team member self-unsubscribe — company contact handles removals
- Kehotesuunnittelija Pro — integrate later from separate system
- Live webinars — manual service, not part of the app
- Slack/Teams delivery — email-only; webhook forwarder if 5+ clients request
- Reddit/HN scraping — legal ambiguity, Tavily surfaces best content
- Click tracking — opens + feedback sufficient for now
- Daily digest frequency — subscriber fatigue, weekly minimum
- Custom email template per client — one brand with co-branding
- Self-serve company signup — enterprise clients need onboarding
- Rich text editor — fix prompts instead

## Context

Shipped v1.0 and v1.1 with 15,916 LOC TypeScript across 9 phases.
Tech stack: Next.js 16, Fastify, Drizzle ORM, PostgreSQL, React Email, Resend, Claude Sonnet 4.6, Gemini Nano Banana 2.
News sources: RSS, Beehiiv, Tavily, X/Twitter (Apify), aisanomat.fi blog.
No pilot client yet — building product first, then selling.
Two known integration gaps accepted as tech debt (health dot keys, dedup filter).
Environment setup needed: TAVILY_API_KEY, OPENAI_API_KEY, APIFY_TOKEN, ADMIN_EMAIL, pgvector extension, DNS records.

## Constraints

- **Tech stack**: Node.js + Fastify (API), Next.js 16 (single app, role-based views), PostgreSQL (Railway), React Email
- **AI models**: Claude Sonnet 4.6 (text), Gemini Nano Banana 2 (images), OpenAI text-embedding-3-small (embeddings)
- **Email**: Resend with own sending domain (aisanomat.fi)
- **Deployment**: Railway (API + DB + frontend)
- **Auth**: Hardcoded admin credentials (MVP), magic links for company contacts
- **Frontend**: One Next.js app with role-based routing (admin + portal)
- **Language**: All user-facing content in Finnish
- **X/Twitter**: Apify Tweet Scraper V2 (pay-per-use, $0.40/1K tweets)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Separate app from Beehiiv | Beehiiv can't do per-client tailoring or API email sending | ✓ Good |
| Single Next.js app for admin + portal | Simpler deployment, less infra to manage | ✓ Good |
| Hardcoded admin auth for MVP | Only Janne uses admin, no need for full auth system yet | ✓ Good |
| Claude Sonnet 4.6 for generation | Cost-effective, quality sufficient for newsletter content | ✓ Good |
| Two-pass content pipeline | Content quality is core value, must catch hallucinations | ✓ Good |
| Fastify over Express | Better performance, TypeScript support, schema validation | ✓ Good |
| Prompt templates in DB | Admin can iterate on prompts without code changes | ✓ Good |
| Next.js 16 + Drizzle ORM | Modern stack, good TypeScript DX | ✓ Good |
| Zod v3 (not v4) | fastify-type-provider compatibility | ✓ Good |
| DB-driven scheduling | Railway deploys destroy in-memory cron state | ✓ Good |
| Tavily over Serper | Returns extracted content in one call, no separate scraping | ✓ Good |
| OpenAI text-embedding-3-small | Anthropic has no embeddings model, cost-effective | ✓ Good |
| pgvector in existing PostgreSQL | Dataset too small for dedicated vector DB | ✓ Good |
| Apify pay-per-use X API | $0.40/1K tweets vs $200/month Twitter Basic tier | ✓ Good |
| JWT feedback tokens (90-day) | Multi-purpose token support, no login required | ✓ Good |
| Tailwind pixelBasedPreset for emails | Email-safe px units, no rem in output | ✓ Good |
| Per-member email rendering | Unique feedback URLs per recipient | ✓ Good |

---
*Last updated: 2026-03-04 after v1.2 milestone start*
