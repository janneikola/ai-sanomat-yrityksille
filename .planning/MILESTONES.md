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
