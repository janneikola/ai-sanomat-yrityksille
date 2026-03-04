# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Full Platform

**Shipped:** 2026-03-03
**Phases:** 4 | **Plans:** 8

### What Was Built
- Full-stack platform: PostgreSQL + Fastify API + Next.js 16 admin panel
- Content pipeline: RSS/Beehiiv collection, Claude digest generation, fact validation, Gemini images
- Email delivery: React Email, Resend integration, webhook tracking, bounce handling
- Company portal: magic link auth, team management

### What Worked
- Monorepo structure with shared Zod schemas kept API and frontend in sync
- Two-pass content pipeline (generate + validate) caught quality issues early
- Single Next.js app with role-based routing avoided deployment complexity

### What Was Inefficient
- Phase 1 took ~56min (longest) due to initial schema and boilerplate setup
- Subsequent phases averaged ~5min per plan — first phase setup cost is amortizable

### Patterns Established
- Drizzle ORM + Zod schemas pattern for all DB tables
- Fastify route structure with JSON Schema validation
- React Email templates with Resend sending
- Claude structured outputs via output_config.format

### Key Lessons
1. Schema-first development (Drizzle + Zod shared types) pays off in type safety across the stack
2. Sequential Gemini image generation avoids rate limits — don't parallelize external API calls without budget tracking

### Cost Observations
- Model mix: quality profile (opus for planning, sonnet for execution)
- Total execution: ~1h 20min across 8 plans
- Notable: Plans 2-8 averaged 4-5 min each after initial setup

---

## Milestone: v1.1 — Smart Sourcing & Polish

**Shipped:** 2026-03-04
**Phases:** 5 | **Plans:** 8

### What Was Built
- Automated digest scheduling with per-client frequency and source health monitoring
- Premium email template with AI-Sanomat branding, dark mode, client co-branding
- One-click reader feedback with JWT-signed links and satisfaction dashboard
- Tavily web search with per-client industry queries and caching
- Semantic deduplication with OpenAI embeddings and pgvector
- X/Twitter monitoring via Apify with budget tracking

### What Worked
- Pure function extraction (isDueToday, computeHealthStatus) enabled easy testing
- Graceful fallback pattern (empty array when API key missing) across all new services
- Post-collection embedding pipeline in try/catch never blocked core collection
- Consistent service pattern across Tavily, Apify, and existing RSS/Beehiiv

### What Was Inefficient
- Two cross-phase integration gaps (INT-01, INT-02) slipped through individual phase verification
- Could have caught health dot key mismatch with a cross-phase type check
- EXACT_DUPLICATE_THRESHOLD constant created but never used in backend logic

### Patterns Established
- External API client pattern: graceful degradation when API key missing
- Budget tracking pattern: soft cap with 80%/100% warnings, never block
- JWT-signed action links: feedback tokens with purpose field for multi-use
- Tailwind pixelBasedPreset for email-safe CSS output

### Key Lessons
1. Cross-phase integration testing is critical — individual phase verification misses interface mismatches
2. Soft budget caps > hard blocks for external APIs — prevents service disruption
3. Dynamic imports solve circular dependency issues in service layers
4. Per-member email rendering (not shared HTML) is necessary for personalized action URLs

### Cost Observations
- Model mix: quality profile (opus for planning, sonnet for execution, haiku for research)
- Total execution: ~49min across 8 plans
- Notable: v1.1 was significantly faster than v1.0 (49min vs 80min for same plan count)

---

## Milestone: v1.2 — Newsletter Quality & Design

**Shipped:** 2026-03-04
**Phases:** 4 | **Plans:** 4

### What Was Built
- AI-Sanomat logo branding in email header with dark mode white island protection
- OG image extraction from source articles via open-graph-scraper with generic URL filtering
- Structured newsletter content: lead sentences, bullet points, visual hierarchy with backward-compatible fallback
- Three-tier image fallback: OG > Gemini AI infographic > clean no-image rendering
- Email HTML size monitoring with 80KB warning threshold

### What Worked
- Foundation phase (10) laid groundwork that made phases 11-13 very fast to implement
- Pure function extraction pattern (isGenericImageUrl, toImageUrl) enabled quick TDD
- Fire-and-forget async pattern for OG fetch kept it non-blocking without complexity
- Backward-compatible type evolution (optional fields) prevented any breaking changes

### What Was Inefficient
- Pre-existing deduplicationService TypeScript errors appeared in every phase but were never addressed (out of scope)
- Logo PNG asset still needs manual placement — could have automated or included a placeholder

### Patterns Established
- Dark mode island: wrap email images in forced light background container
- Structured content fallback: story.lead as discriminator for rendering path
- Three-tier image resolution: OG > AI-generated > undefined (clean omission)
- Email size monitoring: Buffer.byteLength before every send

### Key Lessons
1. Foundation phases that extend types/schema make all subsequent phases fast (phases 11-13 were 2-3 min each)
2. Eliminating unused constants (PLACEHOLDER_IMAGE_URL) is better than maintaining fallback behavior nobody wants
3. Inline styles are mandatory for Outlook email compatibility — Tailwind classes alone don't work for lists

### Cost Observations
- Model mix: quality profile (opus for planning, sonnet for execution)
- Total execution: ~9 min across 4 plans
- Notable: Fastest milestone yet — foundation phase investment paid off in rapid subsequent phases

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Avg/Plan | Key Change |
|-----------|--------|-------|----------|------------|
| v1.0 | 4 | 8 | ~10min | Initial setup, establishing patterns |
| v1.1 | 5 | 8 | ~6min | Faster with established patterns, graceful degradation standard |
| v1.2 | 4 | 4 | ~2min | Foundation phase investment, fastest execution |

### Top Lessons (Verified Across Milestones)

1. Schema-first development with shared types prevents frontend/backend drift
2. External API integration needs graceful fallback AND budget tracking from day one
3. Individual phase verification does not catch cross-phase integration issues — need milestone-level audit
4. First phase is always slowest; subsequent phases benefit from established patterns
5. Foundation phases that extend DB schema + types make all subsequent feature phases very fast (confirmed v1.0, v1.2)
