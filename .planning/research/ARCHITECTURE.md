# Architecture Patterns

**Domain:** Enterprise AI-curated newsletter platform
**Researched:** 2026-03-02
**Confidence:** HIGH

## Recommended Architecture

**Pattern: Separated API + Frontend with shared types (no Redis for MVP)**

```
                    +-----------------------+
                    |    Next.js 16 App     |
                    |   (Admin + Portal)    |
                    |  Role-based routing   |
                    +-----------+-----------+
                                |
                          HTTP/REST
                                |
                    +-----------+-----------+
                    |    Fastify 5 API      |
                    |  (Business logic +    |
                    |   cron scheduling)    |
                    +-----------+-----------+
                         |     |     |
              +----------+     |     +----------+
              |                |                |
     +--------+-----+  +------+------+  +------+------+
     | PostgreSQL   |  | Claude API  |  | Gemini API  |
     | (Railway)    |  | (Anthropic) |  | (Google)    |
     +--------------+  +-------------+  +-------------+
              |
     +--------+-----+
     | Resend API   |
     | (Email)      |
     +--------------+
```

**Why no Redis/BullMQ for MVP:** At 5-10 enterprise clients, the system processes fewer than 10 digests/week and fewer than 500 emails/month. node-cron handles scheduling, and async operations run as in-process background tasks with status tracking in PostgreSQL. Adding Redis doubles Railway infrastructure cost and operational complexity for zero tangible benefit at this scale. BullMQ is the natural upgrade path when client count exceeds 50.

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Next.js 16 Frontend** | Admin panel + company portal in one app, role-based routing via proxy (Next.js 16 renamed middleware to proxy) | Fastify API (HTTP) |
| **Fastify 5 API** | All business logic, REST endpoints, webhook receivers, cron scheduling, background task execution | PostgreSQL, Claude API, Gemini API, Resend API |
| **PostgreSQL** | All persistent state: companies, digests, news, templates, tracking events, job status | Fastify API (via Drizzle ORM + postgres.js) |
| **Claude API** | Newsletter text generation (Finnish), fact validation | Fastify API (via @anthropic-ai/sdk) |
| **Gemini API** | Newsletter image generation | Fastify API (via @google/genai) |
| **Resend API** | Email delivery, bounce/open webhooks | Fastify API (via resend SDK) |

### Data Flow

**Newsletter Generation Pipeline (weekly):**

```
1. Cron trigger (node-cron, e.g., Monday 06:00 EET)
   |
2. Collect recent articles
   |-- Fetch RSS feeds --> parse --> store new articles in DB
   |-- Include manually added articles
   |
3. For each company with active subscription:
   |
   3a. Select relevant articles (by industry tags)
   |
   3b. Load prompt template + company context from DB
   |
   3c. Call Claude API --> generate newsletter content (Finnish)
       (Store draft with status: "generating")
   |
   3d. [Phase 2] Call Claude API --> validate facts against source URLs
   |
   3e. [Phase 3] Call Gemini API --> generate hero + section images
   |
   3f. Store generated digest in DB (status: "draft")
   |
4. Admin reviews drafts in admin panel
   |-- Preview rendered email
   |-- Approve or request regeneration
   |
5. On approval:
   |-- Render React Email template with digest content
   |-- Send via Resend to all active team members (rate-limited 2/sec)
   |-- Insert tracking pixel reference with digest+member ID
   |-- Update digest status to "sent"
   |
6. Post-send:
   |-- Resend webhook --> log bounces, update member status
   |-- Open tracking events --> logged via Resend webhook
```

**Background Task Pattern (without BullMQ):**

```typescript
// Simple in-process task runner for MVP
// Status tracked in PostgreSQL, not Redis

interface Task {
  id: string
  type: 'generate-digest' | 'collect-news' | 'send-digest'
  status: 'pending' | 'running' | 'completed' | 'failed'
  companyId?: string
  error?: string
  startedAt?: Date
  completedAt?: Date
}

// API endpoint starts task, returns immediately
fastify.post('/admin/digests/generate', async (request) => {
  const task = await taskRepository.create({
    type: 'generate-digest',
    companyId: request.body.companyId,
    status: 'pending',
  })

  // Fire and forget -- runs in background
  generateDigestInBackground(task.id).catch(err => {
    taskRepository.markFailed(task.id, err.message)
  })

  return { taskId: task.id, status: 'pending' }
})

// Frontend polls for status
fastify.get('/admin/tasks/:id', async (request) => {
  return taskRepository.getById(request.params.id)
})
```

**Authentication Flows:**

```
Admin Auth (simple):
  Login page --> POST email+password to API --> verify against
  hardcoded env vars --> sign JWT with jose --> set httpOnly cookie
  --> redirect to /admin/dashboard

Company Portal Auth (magic link):
  Portal login --> POST email to API --> lookup in team_members -->
  generate short-lived JWT with jose --> send magic link via Resend -->
  user clicks link --> verify token --> set session cookie -->
  redirect to /portal/dashboard
```

## Patterns to Follow

### Pattern 1: Fastify Plugin Architecture for Module Boundaries

**What:** Each business domain is a Fastify plugin with its own routes, hooks, and encapsulated scope. Modules communicate through service functions, not direct imports of each other's internals.

**When:** All feature modules in the API.

**Example:**
```typescript
// src/plugins/admin/index.ts
import { FastifyPluginAsync } from 'fastify'

const adminPlugin: FastifyPluginAsync = async (fastify) => {
  // Auth hook applies to all routes in this plugin
  fastify.addHook('onRequest', async (request) => {
    await request.verifyAdmin()
  })

  // Register sub-routes
  await fastify.register(import('./routes/companies'), { prefix: '/companies' })
  await fastify.register(import('./routes/digests'), { prefix: '/digests' })
  await fastify.register(import('./routes/sources'), { prefix: '/sources' })
  await fastify.register(import('./routes/templates'), { prefix: '/templates' })
}

export default adminPlugin

// src/server.ts -- main app
const app = fastify()
app.register(adminPlugin, { prefix: '/api/admin' })
app.register(portalPlugin, { prefix: '/api/portal' })
app.register(webhookPlugin, { prefix: '/api/webhooks' })
app.register(publicPlugin, { prefix: '/api/public' })
```

### Pattern 2: Repository Pattern for Data Access

**What:** Wrap Drizzle ORM queries in repository functions per entity. Route handlers call repositories, never construct queries directly.

**When:** All database access.

**Example:**
```typescript
// src/repositories/companies.ts
import { db } from '../db'
import { companies, teamMembers } from '../db/schema'
import { eq } from 'drizzle-orm'

export const companiesRepository = {
  async findAll() {
    return db.query.companies.findMany({
      with: { industry: true, _count: { teamMembers: true } },
    })
  },

  async findById(id: string) {
    return db.query.companies.findFirst({
      where: eq(companies.id, id),
      with: { teamMembers: true, industry: true },
    })
  },

  async create(data: NewCompany) {
    return db.insert(companies).values(data).returning()
  },
}
```

### Pattern 3: Pipeline Pattern for Content Generation

**What:** Chain processing steps with clear input/output contracts. Each step is independently testable and can be retried individually.

**When:** Newsletter content generation.

**Example:**
```typescript
// src/pipelines/generate-digest.ts
interface PipelineContext {
  company: Company
  articles: Article[]
  promptTemplate: PromptTemplate
  generatedContent?: DigestContent
  validationResult?: ValidationResult
  images?: GeneratedImage[]
}

export async function generateDigest(companyId: string): Promise<Digest> {
  let ctx: PipelineContext = await prepareContext(companyId)
  ctx = await selectRelevantArticles(ctx)
  ctx = await generateContent(ctx)      // Claude API
  // Phase 2:
  // ctx = await validateFacts(ctx)     // Claude API #2
  // Phase 3:
  // ctx = await generateImages(ctx)    // Gemini API
  return await saveDraft(ctx)
}
```

### Pattern 4: Server Components for Data Fetching (Next.js 16)

**What:** Use React Server Components for all data fetching. Client components handle interactivity only. Next.js 16's improved caching APIs (cacheLife, cacheTag) make this even more efficient.

**When:** All pages.

**Example:**
```typescript
// app/(admin)/companies/page.tsx -- Server Component
import { getCompanies } from '@/lib/api'
import { CompanyTable } from './company-table'

export default async function CompaniesPage() {
  const companies = await getCompanies()
  return (
    <div>
      <h1>Yritykset</h1>
      <CompanyTable companies={companies} />
    </div>
  )
}

// app/(admin)/companies/company-table.tsx -- Client Component
'use client'
import { useReactTable } from '@tanstack/react-table'

export function CompanyTable({ companies }: { companies: Company[] }) {
  // Interactive data table with sorting, actions
}
```

### Pattern 5: Shared Zod Schemas for API Contracts

**What:** Define validation schemas in a shared package used by both Fastify (server validation) and Next.js (client-side form validation).

**When:** Every API endpoint.

**Example:**
```typescript
// packages/shared/src/schemas/company.ts
import { z } from 'zod'

export const createCompanySchema = z.object({
  name: z.string().min(1, 'Nimi vaaditaan'),
  industry: z.string().min(1, 'Toimiala vaaditaan'),
  contactEmail: z.string().email('Virheellinen sahkopostiosoite'),
  contactName: z.string().min(1, 'Yhteyshenkilon nimi vaaditaan'),
})

export type CreateCompanyInput = z.infer<typeof createCompanySchema>

// Used in Fastify for request validation
// Used in Next.js forms with react-hook-form + @hookform/resolvers/zod
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Synchronous AI Calls in Request Handlers

**What:** Calling Claude or Gemini API directly in a Fastify route handler and waiting for the HTTP response.

**Why bad:** These calls take 10-60+ seconds. HTTP connections timeout, UX suffers, and failed calls have no retry mechanism. The admin panel appears "frozen."

**Instead:** Start the generation as a background task, return immediately with a task ID, and let the frontend poll for completion. Track status in PostgreSQL.

### Anti-Pattern 2: Direct Database Access from Next.js

**What:** Importing Drizzle ORM in Next.js server components and querying PostgreSQL directly.

**Why bad:** Bypasses API authentication, business logic, and validation. Creates two separate data access paths. Makes the frontend dependent on database schema internals.

**Instead:** All data access goes through the Fastify API. Next.js server components use `fetch()` to call API endpoints.

### Anti-Pattern 3: Storing Images on Local Filesystem

**What:** Saving Gemini-generated images to the container filesystem or /public directory.

**Why bad:** Railway containers are ephemeral -- files are lost on every redeploy. Cannot work with multiple instances.

**Instead:** Store generated images as base64 data in PostgreSQL (acceptable for newsletter images, typically < 500KB each), or use Resend's attachments API to inline images in emails directly. For larger scale, add a blob storage service (R2, S3) later.

### Anti-Pattern 4: One Massive Prompt for Newsletter Generation

**What:** Sending all 20+ articles, company context, style instructions, and formatting rules in a single Claude prompt.

**Why bad:** Exceeds context window efficiently, produces unpredictable output, makes debugging impossible, and each retry repeats the entire expensive call.

**Instead:** Break into steps: (1) summarize each article individually (small, predictable calls), (2) synthesize summaries into newsletter sections with industry context, (3) format with style instructions. Each step is independently testable and retry-able.

### Anti-Pattern 5: Next.js API Routes for Backend Logic

**What:** Using Next.js Route Handlers (`app/api/`) for business logic, cron scheduling, or webhook processing.

**Why bad:** Next.js API routes are serverless-oriented and stateless. They cannot run long-lived cron jobs (node-cron), maintain background task state, or reliably process webhook retries. You end up fighting the framework.

**Instead:** All backend logic in Fastify. The only "API" in Next.js might be a thin rewrite/proxy rule to Fastify's endpoints.

## Directory Structure

```
ai-sanomat-yrityksille/
  api/                              # Fastify API server
    src/
      db/
        schema.ts                   # Drizzle schema definitions (all tables)
        index.ts                    # DB connection (postgres.js + drizzle)
        migrations/                 # Generated by drizzle-kit
      plugins/
        admin/                      # Admin routes
          routes/
            companies.ts
            digests.ts
            sources.ts
            templates.ts
          index.ts                  # Plugin registration + admin auth hook
        portal/                     # Company portal routes
          routes/
            dashboard.ts
            team.ts
          index.ts
        webhooks/
          resend.ts                 # Bounce/open webhook handler
        public/
          auth.ts                   # Login, magic link endpoints
      services/
        claude.ts                   # Claude API wrapper
        gemini.ts                   # Gemini API wrapper
        resend.ts                   # Resend email wrapper
      pipelines/
        collect-news.ts             # RSS fetch + store
        generate-digest.ts          # Content generation pipeline
        send-digest.ts              # Email delivery pipeline
      repositories/
        companies.ts
        team-members.ts
        news-items.ts
        news-sources.ts
        digests.ts
        prompt-templates.ts
        tasks.ts                    # Background task status tracking
      cron/
        scheduler.ts                # node-cron job definitions
      config/
        env.ts                      # Zod-validated env vars
      server.ts                     # Fastify app setup + start
    drizzle.config.ts
    package.json
    tsconfig.json

  web/                              # Next.js 16 frontend
    src/
      app/
        (admin)/                    # Admin panel route group
          layout.tsx                # Admin sidebar layout
          dashboard/page.tsx
          companies/
            page.tsx                # Company list
            [id]/page.tsx           # Company detail
          digests/
            page.tsx                # Digest list with status
            new/page.tsx            # Generate new digest
            [id]/
              page.tsx              # Preview digest
              approve/page.tsx      # Approve and send
          sources/page.tsx          # News source management
          templates/page.tsx        # Prompt template editor
        (portal)/                   # Company portal route group
          layout.tsx                # Portal layout (simpler)
          dashboard/page.tsx        # Open rate stats
          team/page.tsx             # Team member management
        auth/
          login/page.tsx            # Admin login
          magic/page.tsx            # Magic link entry
          verify/page.tsx           # Magic link verification
        layout.tsx                  # Root layout
        page.tsx                    # Redirect to appropriate dashboard
      components/
        ui/                         # shadcn/ui components
        admin/                      # Admin-specific components
        portal/                     # Portal-specific components
        email/                      # React Email template previews
      lib/
        api.ts                      # API client for Fastify backend
        auth.ts                     # Auth helpers
    proxy.ts                        # Next.js 16 proxy (was middleware.ts)
    next.config.ts
    package.json
    tsconfig.json

  packages/
    emails/                         # React Email templates
      src/
        digest.tsx                  # Weekly digest email template
        magic-link.tsx              # Magic link auth email
        components/                 # Reusable email components
      package.json
    shared/                         # Shared types and schemas
      src/
        schemas/                    # Zod validation schemas
          company.ts
          digest.ts
          source.ts
          auth.ts
        types/                      # TypeScript type definitions
          index.ts
      package.json
      tsconfig.json

  package.json                      # npm workspace root
  tsconfig.base.json               # Shared TypeScript config
```

### Structure Rationale

- **`api/` + `web/` split:** Fastify handles background tasks, cron jobs, and webhook processing that Next.js serverless functions cannot reliably do. Railway deploys them independently.
- **`plugins/` in API:** Fastify plugin pattern -- each domain is an isolated scope with its own auth hooks and routes. Admin and portal have different auth requirements.
- **`pipelines/` separate from `plugins/`:** Pipeline functions are called by both cron jobs and API routes. They contain the business logic; routes just orchestrate.
- **`repositories/`:** Single data access layer. Never import Drizzle schema directly in routes -- always go through repositories.
- **`packages/emails/`:** React Email templates are shared between API (renders and sends) and potentially web (email preview in admin panel).
- **Route groups `(admin)` and `(portal)`:** Different layouts without URL prefix. Admin gets management sidebar; portal gets simple company-focused layout. `proxy.ts` enforces auth at the routing layer.
- **`proxy.ts` (not middleware.ts):** Next.js 16 renamed `middleware.ts` to `proxy.ts` with the function name `proxy` instead of `middleware`.

## Key Data Relationships

```
industries (lookup table)
    |
    +-- 1:N --> companies (each company has an industry)
    |              |
    |              +-- 1:N --> team_members (people who receive emails)
    |              +-- 1:N --> digests (generated content per company)
    |              |              |
    |              |              +-- 1:N --> email_sends (one per member per digest)
    |              |
    |              +-- N:1 --> prompt_templates (which template to use)
    |
news_sources (RSS feeds, manual)
    |
    +-- 1:N --> news_items (collected articles)
                    |
                    +-- N:N --> digests (which items used in which digest)

tasks (background job status tracking)
    +-- type, status, companyId, error, timestamps
```

## Scaling Considerations

| Concern | At 5 clients (MVP) | At 50 clients | At 500 clients |
|---------|---------------------|----------------|-----------------|
| Content generation | Sequential, ~5 min total | Parallel with rate limiting, ~30 min | BullMQ + Redis workers |
| Job scheduling | node-cron in-process | node-cron still fine | BullMQ for distributed jobs |
| Database load | Single connection fine | Connection pool (5-10) | PgBouncer / Railway pooling |
| Email volume | ~50 emails/week (free tier) | ~500/week (Resend Pro $20/mo) | ~5,000/week (batch API) |
| Image generation | ~10 images/week | ~100/week (monitor quota) | May need paid tier |
| Background tasks | In-process with status in PostgreSQL | Still fine | Separate worker process |

## Build Order (Dependency-Driven)

1. **Database schema + Drizzle setup** -- Everything depends on this
2. **Fastify API skeleton + env config + admin auth** -- Shell for everything
3. **Company management CRUD** -- Need companies before digests
4. **News collection pipeline** -- Need news before content generation
5. **Claude content generation** -- Core value proposition
6. **React Email templates + Resend delivery** -- Must send emails
7. **Admin panel (Next.js)** -- UI for the above workflow
8. **Open tracking + bounce handling** -- Prove value to clients
9. **Company portal** -- Build when first client onboards
10. **Fact validation (second Claude pass)** -- After text quality is proven
11. **Image generation (Gemini)** -- After text pipeline is solid

## Sources

- [Fastify plugin architecture](https://fastify.dev/docs/latest/Reference/Plugins/) -- Official docs (HIGH)
- [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) -- proxy.ts rename (HIGH)
- [Drizzle ORM PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql) -- Official docs (HIGH)
- [React Email + Resend](https://resend.com/docs/send-with-nodejs) -- Official docs (HIGH)
- [Railway PostgreSQL](https://docs.railway.com/databases/postgresql) -- Deployment patterns (HIGH)
- [Resend webhooks](https://resend.com/docs/webhooks/introduction) -- Webhook architecture (HIGH)

---
*Architecture research for: AI-Sanomat Yrityksille (Enterprise AI Newsletter Platform)*
*Researched: 2026-03-02*
