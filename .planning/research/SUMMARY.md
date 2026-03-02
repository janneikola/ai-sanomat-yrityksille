# Research Summary: AI-Sanomat Yrityksille

**Domain:** Enterprise AI-curated newsletter platform (Finnish B2B market)
**Researched:** 2026-03-02
**Overall confidence:** HIGH

## Executive Summary

AI-Sanomat Yrityksille is a greenfield enterprise newsletter platform that collects AI news, generates industry-tailored Finnish-language digests via Claude API, creates images with Gemini, and delivers via Resend. The stack is well-defined in PROJECT.md constraints with one critical update: **Next.js 16 should replace Next.js 15** since 16 is now the active stable version (16.1.6, released late 2025) and this is a greenfield project with no migration cost.

The technology ecosystem for this project is mature and well-supported. Every major component (Fastify 5, Drizzle ORM, React Email 5, Resend, Tailwind 4, shadcn/ui) has stable releases as of March 2026. The AI integration layer (@anthropic-ai/sdk for Claude, @google/genai for Gemini) uses official SDKs with active maintenance. The main architectural decision is using **node-cron for MVP scheduling instead of BullMQ + Redis**, which saves Railway infrastructure cost and complexity while remaining perfectly adequate for fewer than 50 enterprise clients.

The primary risks are not technical but content-quality-related: AI hallucinations in published content, Finnish language quality degradation, and news source garbage-in-garbage-out. These are addressed through the two-pass content pipeline (generate + validate), Finnish-specific prompt engineering, and aggressive source curation. Email deliverability (SPF/DKIM/DMARC configuration) is the second major risk area -- it must be validated with 2-4 weeks of DMARC monitoring before onboarding any client.

The competitive landscape is clear: no Finnish-language, industry-specific, AI-curated enterprise newsletter exists. English-language competitors (The Rundown AI, Superhuman AI) serve individual subscribers, not enterprise teams. Beehiiv lacks API-driven sending and per-client content tailoring. This is a genuine market gap in the Finnish enterprise space.

## Key Findings

**Stack:** Node.js 22 + Next.js 16 + Fastify 5 + PostgreSQL + Drizzle ORM + React Email 5 + Resend + Claude API + Gemini API. All versions verified current as of March 2026.

**Architecture:** Separated Fastify API + Next.js frontend with shared types via npm workspaces. No Redis/BullMQ for MVP -- node-cron handles scheduling, background tasks tracked in PostgreSQL.

**Critical pitfall:** AI hallucinations in published content. The two-pass pipeline must include source grounding (validate against original articles, not just re-read generated text). Human approval gate is non-negotiable.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Foundation** - Database schema, Fastify skeleton, admin auth, environment config
   - Addresses: Database schema, basic API structure, admin authentication
   - Avoids: Over-engineering auth (Pitfall 13)

2. **Content Pipeline** - News collection, Claude integration, content generation
   - Addresses: RSS collection, industry-tailored generation, prompt templates
   - Avoids: Garbage-in-garbage-out (Pitfall 3), hallucinations (Pitfall 1)

3. **Email Delivery** - React Email templates, Resend integration, DNS setup, bounce handling
   - Addresses: Email rendering, delivery, SPF/DKIM/DMARC, bounce processing
   - Avoids: Deliverability failure (Pitfall 2), rate limit issues (Pitfall 5)

4. **Admin Panel** - Next.js frontend for Janne's workflow (client mgmt, digest preview, approve/send)
   - Addresses: Admin dashboard, client CRUD, digest preview/approve workflow
   - Avoids: Admin over-engineering (Pitfall 13)

5. **Quality & Enhancement** - Fact validation (second Claude pass), image generation (Gemini), open tracking
   - Addresses: Two-pass validation, AI images, engagement metrics
   - Avoids: Pipeline blocking from images (Pitfall 14), cost overruns (Pitfall 8)

6. **Company Portal** - Magic link auth, team management, engagement dashboard
   - Addresses: Company self-service, open rate dashboard
   - Avoids: Magic link security gaps (Pitfall 9)

**Phase ordering rationale:**
- Database and API foundation must come first because every other component depends on data persistence and API structure
- Content pipeline before email delivery because you need content to test email rendering with real data
- Email delivery before admin panel because the API endpoints must exist before the UI calls them
- Admin panel before enhancements because Janne needs to test the basic workflow before adding complexity
- Quality features (validation, images) are separate phase because they are independently valuable and the core pipeline must work without them
- Company portal is last because no enterprise clients exist yet -- build it when the first client onboards

**Research flags for phases:**
- Phase 2 (Content Pipeline): Needs deeper research on Finnish prompt engineering patterns and Claude Sonnet 4.6 Finnish language quality
- Phase 3 (Email Delivery): Needs phase-specific research on Resend webhook implementation and DMARC monitoring
- Phase 5 (Quality): Needs research on Gemini Nano Banana 2 actual capabilities (LOW confidence on model details) and exact API access
- Phase 1, 4, 6: Standard patterns, unlikely to need additional research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified via npm and official docs. Core technologies are mature and stable. One LOW flag: Zod 4 compatibility with fastify-type-provider-zod |
| Features | MEDIUM | Feature landscape based on competitor analysis and PROJECT.md. No direct Finnish enterprise newsletter competitor to benchmark against |
| Architecture | HIGH | Fastify plugin pattern, separated frontend/API, and Drizzle ORM are well-established patterns with extensive documentation |
| Pitfalls | HIGH | Critical pitfalls (hallucinations, deliverability, content quality) backed by official documentation and multiple sources. Finnish language quality is MEDIUM confidence |

## Gaps to Address

- **Gemini Nano Banana 2 exact API capabilities:** The model naming and access are evolving. Verify exact model ID and capabilities with actual API key before building image generation
- **Zod 4 ecosystem compatibility:** fastify-type-provider-zod may not support Zod 4 yet. May need to use Zod 3.x or the `zod/v3` compatibility path
- **Finnish language prompt engineering:** No established best practices for Finnish-language newsletter generation with Claude. Will need iterative testing with Janne
- **Resend free tier limits:** 100 emails/day and 3,000/month. With even 3-4 enterprise clients, may need Pro plan ($20/mo) from the start
- **Railway deployment specifics:** Connection string handling, multi-service deployment (API + frontend), and build configuration need phase-specific research
- **Next.js 16 proxy.ts pattern:** The rename from middleware.ts to proxy.ts is new -- limited community examples exist yet
