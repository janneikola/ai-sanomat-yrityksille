# Milestones: AI-Sanomat Yrityksille

## v1.0 — Full Platform (Complete)

**Completed:** 2026-03-03
**Phases:** 1–4 (8 plans total)

**What shipped:**
- Foundation: PostgreSQL, Fastify API, admin auth, Railway deployment
- Content Pipeline: RSS/Beehiiv collection, Claude digest generation, fact validation, Gemini images
- Email Delivery: React Email templates, Resend integration, webhooks, open/bounce tracking, admin send workflow
- Company Portal: Magic link auth, team management, newsletter archive

**Key decisions:**
- Next.js 16 + Fastify + Drizzle ORM stack
- Zod v3 (not v4) for fastify-type-provider compatibility
- Single Next.js app with role-based routing (admin + portal)
- Claude structured outputs via output_config.format
- Sequential Gemini image generation to avoid rate limits

**Last phase:** 4 (Company Portal)

## v1.1 — Smart Sourcing & Polish (Complete)

**Completed:** 2026-03-04
**Phases:** 5–9 (8 plans total)
**Requirements:** 29/29 satisfied

**What shipped:**
- Foundation Automation: Database-driven per-client scheduling (weekly/bi-weekly/monthly), source health monitoring with auto-disable, admin notifications
- Premium Email Experience: Redesigned Tailwind email template with AI-Sanomat branding, dark mode, client co-branding, "AI-Sanomat suosittelee" featured section
- One-click Feedback: JWT-signed thumbs up/down in emails, satisfaction dashboard with low-score flagging
- Web Search Integration: Tavily per-client industry search with 24h caching and relevance filtering
- Semantic Deduplication: OpenAI embeddings + pgvector cosine similarity with admin review and override
- X/Twitter Monitoring: Apify-powered influencer timeline collection, keyword search, budget tracking ($50/month cap)

**Key decisions:**
- Database-driven scheduling (Railway deploys destroy in-memory cron)
- Tavily over Serper (extracted content in one call)
- OpenAI text-embedding-3-small for embeddings (Anthropic has no embeddings model)
- pgvector in existing PostgreSQL (dataset too small for vector DB)
- Apify pay-per-use X API ($0.40/1K tweets vs $200/month Twitter Basic)
- JWT-based feedback tokens with 90-day expiry

**Stats:**
- 70 files changed, +11,343 / -338 lines
- 15,916 total LOC (TypeScript)
- ~42 commits, ~2h 9min total execution time

**Known gaps (accepted as tech debt):**
- INT-01: Health dot key mismatch in X monitoring page (visual bug)
- INT-02: Duplicate items not filtered during digest generation

**Last phase:** 9 (X/Twitter Monitoring)
