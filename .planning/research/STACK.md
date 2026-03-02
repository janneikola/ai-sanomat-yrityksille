# Stack Research

**Domain:** Enterprise AI-curated newsletter platform with admin panel and company portal
**Researched:** 2026-03-02
**Confidence:** HIGH

## Critical Recommendation: Upgrade to Next.js 16

The PROJECT.md specifies Next.js 15, but Next.js 16 was released in late 2025 and is now the active stable version (16.1.6 as of February 2026). Since this is a greenfield project, there is no reason to start on a version that is already in maintenance mode. Next.js 16 brings Turbopack as default (2-5x faster builds), stable React Compiler support, improved routing/navigation, and stable caching APIs -- all directly beneficial.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22.x LTS (22.22.0) | Runtime | Current LTS ("Jod"), supported until 2027-04-30. Next.js 16 requires >= 20.9.0, Fastify 5 targets >= 20. Node 22 gives ES modules, V8 v12.4 |
| TypeScript | 5.9.x | Type safety | Latest stable. TS 6.0 is in beta (transition release before Go rewrite), not production-ready yet |
| Next.js | 16.1.x | Frontend (admin + portal) | Current stable. Turbopack default, React Compiler stable, improved caching APIs, React 19.2 features. No migration cost since greenfield |
| Fastify | 5.7.x | API server | Fastest Node.js framework, built-in schema validation via JSON Schema, excellent TypeScript support, plugin architecture |
| PostgreSQL | 16.x | Database | Railway's default PostgreSQL. Mature, reliable, JSON support for flexible fields like prompt templates |
| Drizzle ORM | 0.45.x | Database ORM | Type-safe SQL-like queries, excellent TypeScript inference, lightweight (no query engine binary unlike Prisma), SQL-first philosophy matches Fastify's "close to metal" ethos |
| React Email | 5.x (@react-email/components 1.0.8) | Email templates | JSX-based email components, Tailwind 4 support, built by Resend team -- perfect synergy with Resend delivery |
| Resend | 6.9.x (SDK) | Email delivery | Already chosen. Best DX for transactional email, React Email integration built-in, webhook support for bounces |
| Tailwind CSS | 4.2.x | Styling | v4 is current standard. Zero-config setup, 5x faster builds, CSS-first configuration. Works with both Next.js and React Email |

### AI & Image Generation

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @anthropic-ai/sdk | 0.78.x | Claude API (text generation + validation) | Official Anthropic SDK. Direct API access for Sonnet 4.6 content generation and fact validation passes |
| @google/genai | 1.43.x | Gemini image generation | Official Google GenAI SDK. Supports Nano Banana models (gemini-2.5-flash-image). Replaces older @google/generative-ai package |

**Gemini Model Note (MEDIUM confidence):** The project references "Gemini Nano Banana 2". Current Nano Banana models as of March 2026 include:
- `gemini-2.5-flash-image` -- optimized for high-volume, free tier (500 images/day)
- `gemini-3.1-flash-image-preview` -- newer, faster
- `gemini-3-pro-image-preview` -- higher quality for professional assets

Recommend starting with `gemini-2.5-flash-image` for cost control, with option to upgrade to newer models. Verify exact model access with API key.

### Database Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| postgres (postgres.js) | 3.4.x | PostgreSQL driver | Fastest JS PostgreSQL client. Works with Drizzle ORM. Better performance than node-postgres (pg) for typical workloads |
| drizzle-orm | 0.45.x | ORM | Type-safe schema definitions, SQL-like query builder, migrations via drizzle-kit. No binary dependencies (unlike Prisma) -- important for Railway deployment |
| drizzle-kit | latest (match drizzle-orm) | Migrations CLI | Schema push/migration generation. Pairs with drizzle-orm |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 4.3.x | Schema validation | API input validation, environment variable validation, form validation. Integrates with Fastify via fastify-type-provider-zod |
| jose | 6.1.x | JWT tokens | Magic link token generation/verification for company portal auth. Zero dependencies, Web Crypto API based |
| rss-parser | 3.13.x | RSS feed parsing | Collecting AI news from RSS sources. Stable, widely used, TypeScript types included |
| @fastify/cors | 11.2.x | CORS handling | Required for Next.js frontend calling Fastify API on different port/domain |
| @fastify/cookie | 11.0.x | Cookie handling | Session/auth cookie management for admin and portal |
| @fastify/rate-limit | 10.3.x | Rate limiting | Protect API endpoints, especially Claude/Gemini proxy routes |
| @fastify/swagger | 9.7.x | API documentation | Auto-generate OpenAPI spec from Fastify schemas. Useful for development/debugging |
| @fastify/swagger-ui | latest | Swagger UI | Browse API docs visually during development |
| node-cron | 3.x | Scheduled tasks | Weekly digest generation trigger, RSS feed polling schedule. Simpler than BullMQ for MVP scope |
| shadcn/ui | latest (CLI-based) | UI components | Admin panel and portal UI. Not an npm package -- CLI copies components. Works with Next.js 16 + Tailwind 4 + React 19 |
| react-hook-form | latest | Form handling | Admin panel forms (prompt editing, client management). Works with zod via @hookform/resolvers |
| @tanstack/react-table | latest | Data tables | Admin panel: client lists, news source management, digest history |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| drizzle-kit | DB migrations | `npx drizzle-kit push` for development, `npx drizzle-kit generate` + `migrate` for production |
| tsx | TypeScript execution | Run TS directly without build step for scripts and development |
| dotenv | Environment variables | Load .env files in development. Use `dotenv-cli` for running drizzle-kit with env vars |
| eslint + eslint-config-next | Linting | Next.js 16 removed `next lint` CLI -- use ESLint directly with flat config |
| prettier | Formatting | Standard code formatting |
| prettier-plugin-tailwindcss | Tailwind class sorting | Auto-sort Tailwind classes in JSX |

## Installation

```bash
# === API Server (Fastify) ===

# Core
npm install fastify @fastify/cors @fastify/cookie @fastify/rate-limit @fastify/swagger @fastify/swagger-ui

# Database
npm install drizzle-orm postgres

# Validation
npm install zod fastify-type-provider-zod

# AI
npm install @anthropic-ai/sdk @google/genai

# Email
npm install resend @react-email/components @react-email/render

# Auth & Scheduling
npm install jose node-cron

# News Collection
npm install rss-parser

# Dev dependencies
npm install -D drizzle-kit typescript tsx @types/node dotenv-cli

# === Frontend (Next.js) ===

# Core
npx create-next-app@latest --typescript --tailwind --app --src-dir

# UI (shadcn/ui is installed via CLI, not npm)
npx shadcn@latest init
npx shadcn@latest add button card dialog form input label table tabs textarea toast

# Forms & Tables
npm install react-hook-form @hookform/resolvers @tanstack/react-table

# Dev dependencies
npm install -D @types/react @types/react-dom eslint prettier prettier-plugin-tailwindcss
```

## Monorepo vs Separate Projects

**Recommendation: Single repository, two package.json directories (monorepo-lite)**

```
ai-sanomat-yrityksille/
  api/              # Fastify API server
    package.json
    src/
  web/              # Next.js frontend
    package.json
    src/
  packages/
    shared/         # Shared types, validation schemas
      package.json
  package.json      # Workspace root (npm workspaces)
```

Use npm workspaces (built into npm, no extra tool needed). Share TypeScript types and Zod schemas between API and frontend via `packages/shared`. Both deploy independently on Railway.

**Why not a single package.json:** Fastify and Next.js have different dependency trees, build processes, and deployment targets. Mixing them creates dependency conflicts and bloated deployments.

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Next.js 16 | Next.js 15 | 15 is in maintenance. 16 is stable with significant improvements. No migration cost for greenfield |
| Fastify 5 | Express 4/5 | Fastify is 2-3x faster, has built-in schema validation, better TypeScript support, and plugin architecture |
| Drizzle ORM | Prisma | Prisma requires binary engine (deployment complexity on Railway), slower cold starts, heavier bundle. Drizzle is SQL-first which gives more control |
| postgres.js | node-postgres (pg) | postgres.js is faster, cleaner API, better prepared statement handling. pg has larger ecosystem but we don't need it |
| Zod 4 | Joi, Yup | Zod is TypeScript-first, works natively with Fastify type providers, and integrates with Drizzle for schema validation |
| node-cron | BullMQ | BullMQ requires Redis (extra Railway service cost). node-cron is sufficient for weekly cron + hourly RSS polling. Upgrade to BullMQ later if needed |
| jose | jsonwebtoken | jose has zero dependencies, uses Web Crypto API (future-proof), better security. jsonwebtoken is legacy |
| shadcn/ui | Material UI, Chakra UI | shadcn/ui gives you the source code (no dependency lock-in), works perfectly with Tailwind 4, most popular choice in Next.js ecosystem 2025-2026 |
| Tailwind 4 | Tailwind 3 | Tailwind 4 is current, React Email 5 supports it, Next.js 16 starters use it. No reason to use v3 |
| React Email | MJML, email-templates | React Email uses JSX (consistent with frontend), built by Resend team (perfect integration), supports Tailwind. MJML has its own templating language |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Prisma | Binary engine complicates Railway deployment, slower cold starts, heavy bundle | Drizzle ORM |
| Express | Slower, weaker TypeScript support, no built-in validation | Fastify 5 |
| NextAuth.js / Auth.js | Over-engineered for this use case (1 admin + magic links). Adds massive complexity | jose for JWT magic links, hardcoded admin auth |
| BullMQ + Redis | Unnecessary infrastructure cost for MVP. Only ~10 companies, weekly sends | node-cron |
| @google/generative-ai | Old/deprecated Google AI SDK | @google/genai (new unified SDK) |
| Nodemailer | Low-level SMTP, no analytics, no React Email integration | Resend SDK |
| Mongoose | MongoDB ORM, wrong database | Drizzle ORM with PostgreSQL |
| tRPC | Adds coupling between frontend and API. Fastify's JSON Schema validation + TypeScript provides similar type safety without the tight coupling | Fastify typed routes + shared Zod schemas |
| Next.js API routes (for backend) | Limited to serverless function patterns, no long-running processes, harder to manage cron jobs and background tasks | Separate Fastify server |

## Stack Patterns by Variant

**If scaling beyond 50 companies:**
- Replace node-cron with BullMQ + Redis for job queuing
- Add connection pooling (PgBouncer or Railway's built-in)
- Consider splitting digest generation into background workers

**If adding real-time features later:**
- Fastify has native WebSocket support via @fastify/websocket
- No architecture change needed

**If email volume exceeds Resend free tier (3000/month):**
- Resend Pro at $20/month covers up to 50,000 emails
- At 10 companies x 50 members x 4 weeks = 2,000 emails/month -- free tier may suffice initially

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Next.js 16.1.x | React 19.2.x, Node.js >= 20.9.0, TypeScript >= 5.1.0 | React 19.2 is bundled with Next.js 16 |
| Fastify 5.7.x | Node.js >= 20.x | Dropped Node 18 support |
| Drizzle ORM 0.45.x | postgres.js 3.x, pg 8.x | Both drivers supported |
| React Email 5.x | React 19.x, Tailwind CSS 4.x | Full Tailwind 4 support added in v5 |
| Resend SDK 6.9.x | React Email 5.x | Same company, guaranteed compatibility |
| Tailwind CSS 4.2.x | Next.js 16.x | Both use modern CSS features, same browser targets |
| shadcn/ui | Next.js 16.x, React 19.x, Tailwind 4.x | CLI-based, always generates compatible code |
| Zod 4.3.x | fastify-type-provider-zod | Verify type provider supports Zod 4 -- may need Zod 3.x if not updated yet |

**Zod Version Warning (LOW confidence):** Zod 4.x was released July 2025. Some ecosystem libraries (fastify-type-provider-zod, @hookform/resolvers) may still target Zod 3.x. Check compatibility at integration time. Zod 4 has a backwards-compatible import path `zod/v3` for this scenario.

## Sources

- [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) -- Official docs, verified Feb 2026
- [Next.js 16 blog post](https://nextjs.org/blog/next-16) -- Official announcement
- [Fastify releases](https://github.com/fastify/fastify/releases) -- GitHub, v5.7.4 confirmed
- [Drizzle ORM PostgreSQL docs](https://orm.drizzle.team/docs/get-started-postgresql) -- Official docs
- [Resend Node.js SDK](https://www.npmjs.com/package/resend) -- npm, v6.9.3 confirmed
- [React Email 5.0 announcement](https://resend.com/blog/react-email-5) -- Official blog
- [@google/genai npm](https://www.npmjs.com/package/@google/genai) -- npm, v1.43.0 confirmed
- [Gemini image generation docs](https://ai.google.dev/gemini-api/docs/image-generation) -- Official Google docs
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk) -- npm, v0.78.0 confirmed
- [Railway PostgreSQL docs](https://docs.railway.com/databases/postgresql) -- Official Railway docs
- [Node.js 22 LTS](https://nodejs.org/en/blog/release/v22.22.0) -- Official Node.js
- [Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4) -- Official announcement
- [TypeScript releases](https://github.com/microsoft/typescript/releases) -- GitHub, v5.9 stable confirmed
- [jose npm](https://www.npmjs.com/package/jose) -- npm, v6.1.3 confirmed

---
*Stack research for: AI-Sanomat Yrityksille -- Enterprise AI Newsletter Platform*
*Researched: 2026-03-02*
