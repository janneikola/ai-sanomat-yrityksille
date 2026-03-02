# Phase 1: Foundation and Admin Setup - Research

**Researched:** 2026-03-02
**Domain:** Full-stack Node.js/TypeScript — Fastify API, Next.js 16 admin panel, PostgreSQL with Drizzle ORM, Railway deployment
**Confidence:** HIGH

## Summary

Phase 1 is a greenfield build establishing the entire application stack: a Fastify 5 API with JWT authentication, a PostgreSQL database via Drizzle ORM, a Next.js 16 admin panel with shadcn/ui, and Railway deployment for all services. The monorepo uses npm workspaces with three packages: `api/`, `web/`, and `packages/shared/`.

The core risk is the multi-service nature — API and frontend are separate Railway services that must communicate via CORS with httpOnly cookie-based JWT auth. The technology choices are all well-established and well-documented. Zod 4 is stable and `fastify-type-provider-zod` already supports it via `zod/v4` subpath imports. Next.js 16 (stable since October 2025) uses Turbopack by default and ships with React 19.2.

**Primary recommendation:** Use `drizzle-kit push` for development speed, with a seed script that populates RSS sources, Beehiiv config, and default prompt templates on first run. Use `jose` (not `jsonwebtoken`) in Next.js middleware for Edge-compatible JWT verification.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Admin Panel Layout**: Sidebar navigation (left side): Dashboard, Clients, Sources, Templates. shadcn/ui components with Tailwind 4. Dashboard is the landing page after login. Clean, functional — internal tool for Janne, not customer-facing.
- **Industry Taxonomy**: Fixed dropdown with predefined industries (taloushallinto, markkinointi, rakennusala, terveydenhuolto, lakiala, IT/ohjelmistokehitys, logistiikka, koulutus, rahoitus, vahittaiskauppa). Stored as text field in clients table. New industries added via code only.
- **Prompt Template Editing**: Simple textarea with variable reference sidebar showing available placeholders ({{industry}}, {{company_name}}, {{news_items}}, {{previous_issues}}). No rich text editor. Each template has name, description, and template text. Version tracking via updated_at timestamp.
- **Default Seed Data**: RSS sources (OpenAI blog, Anthropic blog, Google AI blog, TechCrunch AI, The Verge AI, Ars Technica AI), Beehiiv source (aisanomat.fi), default prompt templates (viikkokatsaus_generointi, faktojen_validointi, kuvapromptit). Admin can add/modify from day one.
- **Monorepo Structure**: npm workspaces with api/ and web/ directories. packages/shared/ for TypeScript types and Zod schemas shared between API and frontend. Root package.json with workspace config.
- **Authentication**: Hardcoded admin: jannenne@gmail.com with password from ADMIN_PASSWORD env var. JWT in httpOnly cookie. No refresh token — 7-day JWT. All /api/admin/* routes require valid admin JWT.

### Claude's Discretion
- Exact shadcn/ui component choices for forms and tables
- Database migration strategy (drizzle-kit push vs generate)
- Railway deployment configuration details
- API error response format
- Exact Fastify plugin registration order

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUND-01 | PostgreSQL database schema with all tables (clients, members, news_items, issues, delivery_stats, news_sources, prompt_templates) | Drizzle ORM pgTable definitions with typed columns, enums, relations, timestamps. Schema file pattern documented. |
| FOUND-02 | Fastify API server with typed routes and JSON Schema validation | Fastify 5 + fastify-type-provider-zod for Zod-based schema validation. Plugin pattern with FastifyPluginAsyncZod documented. |
| FOUND-03 | Admin can log in with hardcoded email/password and receive JWT token | @fastify/jwt with cookie support + @fastify/cookie. bcrypt for password hashing. Decorator pattern for route protection. |
| FOUND-04 | Application deploys to Railway (API + DB + frontend) | Railway monorepo deployment with watch paths. Fastify host must be `::`. Separate services for API and web. |
| FOUND-05 | Monorepo structure with npm workspaces (api/, web/, packages/shared/) | npm workspaces config in root package.json. Shared Zod schemas importable from both api and web. |
| ADMIN-01 | Admin can add, edit, and list enterprise clients with name, industry, contact info, and plan | shadcn/ui DataTable with @tanstack/react-table for list, Dialog/Sheet for create/edit forms. Zod validation shared between API and frontend. |
| ADMIN-02 | Admin can add, edit, activate/deactivate news sources (RSS, Beehiiv, manual) | Source type enum (rss, beehiiv, manual), is_active boolean toggle. Same DataTable + form pattern as clients. |
| CONT-05 | Admin can manage prompt templates (view, edit) from the admin panel | Textarea for template body, variable reference sidebar. Templates seeded on first deploy. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastify | 5.7.x | HTTP API server | Best Node.js perf, native TypeScript, schema validation built-in |
| drizzle-orm | 0.45.x | Database ORM | Type-safe, SQL-like API, lightweight, excellent PostgreSQL support |
| drizzle-kit | 0.31.x | Migration/push tool | Companion to drizzle-orm for schema management |
| next | 16.1.x | Admin panel frontend | React 19.2, Turbopack stable, App Router with route groups |
| zod | 3.25+ (using zod/v4) | Schema validation | Shared between API and frontend, Zod 4 via subpath import |
| @fastify/jwt | latest | JWT sign/verify | Official Fastify plugin, cookie integration |
| @fastify/cookie | latest | Cookie handling | Required for httpOnly JWT cookie |
| @fastify/cors | latest | CORS headers | Required for API-frontend cross-origin communication |
| jose | latest | JWT verify in Edge | Edge-compatible JWT verification for Next.js middleware |
| pg | latest | PostgreSQL driver | Node.js PostgreSQL client for drizzle-orm |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fastify-type-provider-zod | latest | Zod type provider for Fastify | Every route definition — provides type-safe request/response |
| fastify-plugin | latest | Plugin wrapper | Wrapping auth decorator and other shared plugins |
| @tanstack/react-table | latest | Table logic | Client and source list views in admin panel |
| shadcn/ui (via CLI) | 3.8.x | UI components | All admin panel UI (sidebar, table, form, dialog, button, input, textarea, select, badge, switch) |
| tailwindcss | 4.x | CSS utility framework | All styling, configured via shadcn init |
| tw-animate-css | latest | Animation utilities | Replaces deprecated tailwindcss-animate for shadcn |
| bcrypt | latest | Password hashing | Hashing ADMIN_PASSWORD for comparison |
| dotenv | latest | Environment variables | Loading .env in development |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| zod/v4 | zod v3 (default import) | Zod 4 is stable, faster, smaller — no reason to use v3 for new project |
| drizzle-kit push | drizzle-kit generate + migrate | Push is simpler for MVP dev; switch to generate for production later |
| jose (edge) | jsonwebtoken | jsonwebtoken doesn't work in Edge runtime; jose is Edge-compatible |
| bcrypt | argon2 | bcrypt is simpler, widely used; argon2 is technically superior but overkill for single admin user |

**Installation (api/):**
```bash
npm install fastify @fastify/jwt @fastify/cookie @fastify/cors fastify-plugin fastify-type-provider-zod drizzle-orm pg zod bcrypt dotenv
npm install -D drizzle-kit @types/pg @types/bcrypt typescript tsx
```

**Installation (web/):**
```bash
npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --use-npm
cd web && npx shadcn@latest init
npx shadcn@latest add sidebar table dialog sheet form input textarea select badge switch button
npm install jose zod @tanstack/react-table
```

**Installation (packages/shared/):**
```bash
npm install zod
npm install -D typescript
```

## Architecture Patterns

### Recommended Project Structure
```
ai-sanomat-yrityksille/
├── package.json                  # Root workspace config
├── tsconfig.base.json            # Shared TS config
├── api/
│   ├── package.json
│   ├── tsconfig.json
│   ├── drizzle.config.ts         # Drizzle kit configuration
│   └── src/
│       ├── index.ts              # Server entry point
│       ├── app.ts                # Fastify app factory
│       ├── db/
│       │   ├── schema.ts         # All Drizzle table definitions
│       │   ├── index.ts          # DB connection + drizzle instance
│       │   └── seed.ts           # Seed script for default data
│       ├── plugins/
│       │   └── auth.ts           # JWT auth decorator plugin
│       ├── routes/
│       │   ├── auth.ts           # POST /api/auth/login
│       │   ├── clients.ts        # CRUD /api/admin/clients
│       │   ├── sources.ts        # CRUD /api/admin/sources
│       │   └── templates.ts      # CRUD /api/admin/templates
│       └── services/
│           ├── clients.ts        # Client business logic
│           ├── sources.ts        # Source business logic
│           └── templates.ts      # Template business logic
├── web/
│   ├── package.json
│   ├── next.config.ts
│   ├── middleware.ts             # JWT cookie check, redirect to /login
│   └── src/
│       ├── app/
│       │   ├── layout.tsx        # Root layout
│       │   ├── login/
│       │   │   └── page.tsx      # Login page (public)
│       │   └── (admin)/
│       │       ├── layout.tsx    # Admin layout with sidebar
│       │       ├── page.tsx      # Dashboard (redirect target)
│       │       ├── clients/
│       │       │   └── page.tsx  # Clients list + create/edit
│       │       ├── sources/
│       │       │   └── page.tsx  # Sources list + manage
│       │       └── templates/
│       │           └── page.tsx  # Template list + editor
│       ├── components/
│       │   ├── ui/               # shadcn/ui components
│       │   ├── app-sidebar.tsx   # Sidebar navigation
│       │   └── ...               # Feature components
│       └── lib/
│           ├── api.ts            # API client (fetch wrapper)
│           └── utils.ts          # CN utility (shadcn)
└── packages/
    └── shared/
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── schemas/
            │   ├── client.ts     # Client Zod schemas
            │   ├── source.ts     # Source Zod schemas
            │   └── template.ts   # Template Zod schemas
            └── types/
                └── index.ts      # Shared TypeScript types
```

### Pattern 1: Fastify Route with Zod Type Provider
**What:** Define routes with Zod schemas that provide both runtime validation and TypeScript type inference.
**When to use:** Every API route definition.
**Example:**
```typescript
// Source: Context7 - fastify-type-provider-zod README
import { z } from 'zod/v4';
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

const clientRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.route({
    method: 'POST',
    url: '/admin/clients',
    onRequest: [fastify.authenticate],
    schema: {
      body: z.object({
        name: z.string().min(1),
        industry: z.string(),
        contact_email: z.string().email(),
        plan: z.enum(['ai_pulse', 'ai_teams']),
      }),
      response: {
        201: z.object({
          id: z.number(),
          name: z.string(),
          industry: z.string(),
        }),
      },
    },
    handler: async (request, reply) => {
      const client = await clientService.create(request.body);
      reply.code(201).send(client);
    },
  });
};
```

### Pattern 2: Auth Plugin with Decorator
**What:** Register JWT plugin and decorate Fastify with an `authenticate` function for selective route protection.
**When to use:** Auth setup, applied to all admin routes.
**Example:**
```typescript
// Source: Context7 - @fastify/jwt README
import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';
import fcookie from '@fastify/cookie';

export default fp(async function authPlugin(fastify) {
  fastify.register(fjwt, {
    secret: process.env.JWT_SECRET!,
    cookie: { cookieName: 'token', signed: false },
  });
  fastify.register(fcookie);

  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });
});
```

### Pattern 3: Next.js Middleware for Admin Route Protection
**What:** Edge middleware that checks for JWT cookie and redirects unauthenticated users to /login.
**When to use:** Protecting all (admin) routes on the frontend.
**Example:**
```typescript
// Source: Next.js docs + jose library pattern
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;

  // Public routes
  if (request.nextUrl.pathname === '/login') {
    if (token) {
      try {
        await jwtVerify(token, secret);
        return NextResponse.redirect(new URL('/', request.url));
      } catch { /* invalid token, show login */ }
    }
    return NextResponse.next();
  }

  // Protected routes
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### Pattern 4: Drizzle Schema with Enums and Relations
**What:** Type-safe PostgreSQL table definitions with Drizzle ORM.
**When to use:** All database table definitions in schema.ts.
**Example:**
```typescript
// Source: Context7 - drizzle-orm-docs
import { pgTable, serial, text, integer, boolean, timestamp, varchar, pgEnum } from 'drizzle-orm/pg-core';

export const sourceTypeEnum = pgEnum('source_type', ['rss', 'beehiiv', 'manual']);
export const planEnum = pgEnum('plan', ['ai_pulse', 'ai_teams']);

export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  industry: varchar('industry', { length: 100 }).notNull(),
  contactEmail: varchar('contact_email', { length: 255 }).notNull(),
  contactName: varchar('contact_name', { length: 255 }),
  plan: planEnum('plan').notNull().default('ai_pulse'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

export const newsSources = pgTable('news_sources', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: sourceTypeEnum('type').notNull(),
  url: text('url'),
  config: text('config'), // JSON string for type-specific config (e.g., Beehiiv publication ID)
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

export const promptTemplates = pgTable('prompt_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  description: text('description'),
  template: text('template').notNull(),
  variables: text('variables'), // JSON array of available variable names
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});
```

### Pattern 5: shadcn/ui Sidebar Layout
**What:** Admin panel layout with persistent sidebar navigation.
**When to use:** The (admin) layout wrapping all admin pages.
**Example:**
```tsx
// Source: Context7 - shadcn/ui sidebar docs
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Users, Newspaper, FileText } from "lucide-react";
import Link from "next/link";

const navItems = [
  { title: "Hallintapaneeli", href: "/", icon: LayoutDashboard },
  { title: "Asiakkaat", href: "/clients", icon: Users },
  { title: "Uutislahteet", href: "/sources", icon: Newspaper },
  { title: "Kehotepohjat", href: "/templates", icon: FileText },
];

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>AI-Sanomat</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

// In (admin)/layout.tsx:
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <main className="p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

### Anti-Patterns to Avoid
- **Mixing schema definitions between API and frontend:** Keep Zod schemas in `packages/shared/`, import them in both api and web. Do not duplicate schemas.
- **Using jsonwebtoken in Next.js middleware:** It relies on Node.js `crypto` module, which is unavailable in Edge runtime. Use `jose` instead.
- **Hardcoding the admin password in code:** Always read `ADMIN_PASSWORD` from environment variable and hash it with bcrypt for comparison.
- **Not binding Fastify to `::` on Railway:** This causes 502 errors. Always use `fastify.listen({ port: Number(process.env.PORT) || 3000, host: '::' })`.
- **Using `tailwindcss-animate` with Tailwind 4:** It's deprecated. shadcn/ui now uses `tw-animate-css` by default.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT token management | Custom token signing/verification | @fastify/jwt + jose | Token expiry, cookie handling, edge runtime compat |
| API schema validation | Custom validation middleware | fastify-type-provider-zod | Runtime + type-time validation, serialization |
| Database schema management | Raw SQL migrations | drizzle-kit push/generate | Type-safe schema, auto-generates SQL, tracks changes |
| Admin panel components | Custom form/table components | shadcn/ui + @tanstack/react-table | Accessible, tested, consistent styling |
| CORS handling | Custom headers middleware | @fastify/cors | Preflight, credentials, complex origin matching |
| Password hashing | Custom crypto | bcrypt | Timing-safe comparison, salt rounds built in |

**Key insight:** This phase is 100% standard CRUD + auth infrastructure. Every component has a well-maintained library. The value is in correct wiring, not custom logic.

## Common Pitfalls

### Pitfall 1: CORS + Cookies Credential Issue
**What goes wrong:** Frontend fetch calls fail with CORS errors when sending httpOnly cookies cross-origin.
**Why it happens:** `credentials: 'include'` on fetch requires the API to respond with `Access-Control-Allow-Credentials: true` and a specific origin (not `*`).
**How to avoid:** Configure @fastify/cors with `credentials: true` and `origin: 'https://your-web-domain.railway.app'` (never `*` with credentials). On the frontend, always use `fetch(url, { credentials: 'include' })`.
**Warning signs:** 401 errors despite valid JWT cookie, CORS preflight failures.

### Pitfall 2: Fastify Host Binding on Railway
**What goes wrong:** Application deploys but returns 502 errors.
**Why it happens:** Railway's networking requires the app to listen on `::` (IPv6 all interfaces), not `0.0.0.0` or `localhost`.
**How to avoid:** Always use `fastify.listen({ host: '::' })`.
**Warning signs:** App starts successfully in logs but 502 from Railway domain.

### Pitfall 3: Zod Import Path Confusion
**What goes wrong:** Type errors or runtime errors from mixing Zod 3 and Zod 4 APIs.
**Why it happens:** `import { z } from 'zod'` gives Zod 3 API, `import { z } from 'zod/v4'` gives Zod 4 API. They have different error structures and some different methods.
**How to avoid:** Standardize on `import { z } from 'zod/v4'` everywhere. The shared package should re-export from `zod/v4`. `fastify-type-provider-zod` already uses `zod/v4`.
**Warning signs:** `.strict()` or `.passthrough()` not working as expected, error format differences.

### Pitfall 4: Next.js Middleware Edge Runtime Limitations
**What goes wrong:** Import errors or runtime crashes in middleware.ts.
**Why it happens:** Next.js middleware runs in Edge runtime, which lacks many Node.js APIs (no `crypto`, no `Buffer` in some cases, no `fs`).
**How to avoid:** Use `jose` library for JWT verification in middleware. Keep middleware simple — only check cookie existence and verify JWT, nothing else.
**Warning signs:** "Module not found" errors referencing Node.js built-ins.

### Pitfall 5: npm Workspaces Cross-Package Import
**What goes wrong:** `Cannot find module '@shared/schemas'` errors.
**Why it happens:** Incorrect workspace name in package.json or missing TypeScript path configuration.
**How to avoid:** In `packages/shared/package.json`, set `"name": "@ai-sanomat/shared"`. In consuming packages, add it as a dependency: `"@ai-sanomat/shared": "*"`. Configure `tsconfig.json` paths if needed. Ensure the shared package has a proper `"main"` and `"types"` field pointing to compiled output or use `tsx` for direct TS imports.
**Warning signs:** Module resolution errors, type errors in consuming packages.

### Pitfall 6: Railway Monorepo Watch Paths
**What goes wrong:** Changes to the API trigger a frontend rebuild (or vice versa), wasting build minutes.
**Why it happens:** Without watch paths, Railway rebuilds on any commit to the repo.
**How to avoid:** Configure watch paths for each Railway service. API service watches `api/**` and `packages/**`. Web service watches `web/**` and `packages/**`.
**Warning signs:** Unnecessary deploys, slow iteration cycle.

## Code Examples

### Drizzle Config File
```typescript
// api/drizzle.config.ts
// Source: Context7 - drizzle-orm-docs
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### Fastify App Factory
```typescript
// api/src/app.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import authPlugin from './plugins/auth';
import clientRoutes from './routes/clients';
import sourceRoutes from './routes/sources';
import templateRoutes from './routes/templates';
import authRoutes from './routes/auth';

export async function buildApp() {
  const app = Fastify({ logger: true });

  // Compilers
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Plugins
  await app.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  });
  await app.register(authPlugin);

  // Routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(clientRoutes, { prefix: '/api/admin' });
  await app.register(sourceRoutes, { prefix: '/api/admin' });
  await app.register(templateRoutes, { prefix: '/api/admin' });

  return app;
}
```

### Login Route
```typescript
// api/src/routes/auth.ts
import { z } from 'zod/v4';
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import bcrypt from 'bcrypt';

const ADMIN_EMAIL = 'jannenne@gmail.com';

const authRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.route({
    method: 'POST',
    url: '/login',
    schema: {
      body: z.object({
        email: z.string().email(),
        password: z.string(),
      }),
      response: {
        200: z.object({ success: z.boolean() }),
        401: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const { email, password } = request.body;

      if (email !== ADMIN_EMAIL) {
        return reply.code(401).send({ error: 'Virheelliset tunnukset' });
      }

      const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD!, 10);
      const valid = await bcrypt.compare(password, passwordHash);
      if (!valid) {
        return reply.code(401).send({ error: 'Virheelliset tunnukset' });
      }

      const token = await reply.jwtSign(
        { email, role: 'admin' },
        { expiresIn: '7d' }
      );

      reply
        .setCookie('token', token, {
          path: '/',
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60, // 7 days
        })
        .code(200)
        .send({ success: true });
    },
  });
};

export default authRoutes;
```

### Seed Script
```typescript
// api/src/db/seed.ts
import { db } from './index';
import { newsSources, promptTemplates } from './schema';

async function seed() {
  console.log('Seeding database...');

  // RSS sources
  await db.insert(newsSources).values([
    { name: 'OpenAI Blog', type: 'rss', url: 'https://openai.com/blog/rss.xml', isActive: true },
    { name: 'Anthropic Blog', type: 'rss', url: 'https://www.anthropic.com/rss.xml', isActive: true },
    { name: 'Google AI Blog', type: 'rss', url: 'https://blog.google/technology/ai/rss/', isActive: true },
    { name: 'TechCrunch AI', type: 'rss', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', isActive: true },
    { name: 'The Verge AI', type: 'rss', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', isActive: true },
    { name: 'Ars Technica AI', type: 'rss', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', isActive: true },
  ]).onConflictDoNothing();

  // Beehiiv source
  await db.insert(newsSources).values({
    name: 'AI-Sanomat (Beehiiv)', type: 'beehiiv', url: 'https://aisanomat.fi',
    config: JSON.stringify({ publicationId: '' }), // To be configured
    isActive: true,
  }).onConflictDoNothing();

  // Prompt templates
  await db.insert(promptTemplates).values([
    {
      name: 'viikkokatsaus_generointi',
      description: 'Viikottaisen tekoalykatsauksen generointi asiakkaalle',
      template: 'Olet tekoalyuutisten asiantuntija...',
      variables: JSON.stringify(['industry', 'company_name', 'news_items', 'previous_issues']),
    },
    {
      name: 'faktojen_validointi',
      description: 'Generoidun katsauksen faktojen tarkistus',
      template: 'Tarkista seuraavan tekoalykatsauksen faktat...',
      variables: JSON.stringify(['generated_digest', 'source_articles']),
    },
    {
      name: 'kuvapromptit',
      description: 'Kuvien generointi katsaukseen',
      template: 'Luo kuvapromptit seuraavalle tekoalykatsaukselle...',
      variables: JSON.stringify(['digest_sections', 'industry']),
    },
  ]).onConflictDoNothing();

  console.log('Seeding complete.');
}

seed().catch(console.error).finally(() => process.exit(0));
```

### npm Workspaces Root package.json
```json
{
  "name": "ai-sanomat-yrityksille",
  "private": true,
  "workspaces": [
    "api",
    "web",
    "packages/*"
  ],
  "scripts": {
    "dev:api": "npm run dev -w api",
    "dev:web": "npm run dev -w web",
    "dev": "npm run dev:api & npm run dev:web",
    "build:api": "npm run build -w api",
    "build:web": "npm run build -w web",
    "db:push": "npm run db:push -w api",
    "db:seed": "npm run db:seed -w api"
  }
}
```

### API Fetch Wrapper for Frontend
```typescript
// web/src/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tailwind.config.ts | CSS-based config (Tailwind 4) | Tailwind 4 (2025) | No config file needed, shadcn handles setup |
| tailwindcss-animate | tw-animate-css | shadcn/ui 2025 | New animation library, installed by shadcn init |
| zod default import | zod/v4 subpath import | Zod 3.25+ (mid 2025) | Better performance, cleaner API, coexists with v3 |
| next dev (webpack) | next dev (Turbopack) | Next.js 16 (Oct 2025) | Turbopack is default and stable, much faster HMR |
| unstable_cacheLife | cacheLife (stable) | Next.js 16 | No more unstable_ prefix needed |

**Deprecated/outdated:**
- `tailwindcss-animate`: Replaced by `tw-animate-css` in shadcn/ui
- `zod` default import for new projects: Use `zod/v4` subpath instead
- `drizzle-kit generate:pg`: Old syntax. Now just `drizzle-kit generate` with dialect in config
- Webpack dev server in Next.js: Turbopack is the default in Next.js 16

## Open Questions

1. **bcrypt password hashing strategy for single hardcoded admin**
   - What we know: The admin password comes from ADMIN_PASSWORD env var. We need to compare against it on login.
   - What's unclear: Should we pre-hash the password at startup and store in memory, or hash-and-compare on each login? Pre-hashing once at startup is more efficient.
   - Recommendation: Hash ADMIN_PASSWORD once on server startup, store the hash in memory, compare on each login with `bcrypt.compare()`.

2. **Railway service naming and domain configuration**
   - What we know: Railway auto-detects monorepo packages and creates services. Custom domains can be generated.
   - What's unclear: Exact Railway service configuration needed for npm workspaces (vs pnpm). Whether Railway free tier has limitations affecting this setup.
   - Recommendation: Test Railway monorepo import early. Configure watch paths to prevent cross-service rebuilds. Generate railway.app domains for both API and web services.

3. **Shared package compilation strategy**
   - What we know: npm workspaces can reference local packages. TypeScript needs proper resolution.
   - What's unclear: Whether to compile shared package separately or rely on consuming packages' build processes.
   - Recommendation: Use TypeScript project references or configure the shared package with `"main": "./src/index.ts"` and let tsx/Next.js handle compilation directly from source. Simpler for MVP.

## Sources

### Primary (HIGH confidence)
- Context7 `/fastify/fastify` — TypeScript type providers, route schema validation, plugin registration
- Context7 `/fastify/fastify-jwt` — JWT sign/verify, cookie integration, auth decorator pattern
- Context7 `/turkerdev/fastify-type-provider-zod` — Zod type provider setup, plugin pattern, zod/v4 imports
- Context7 `/drizzle-team/drizzle-orm-docs` — pgTable schema, enums, relations, timestamps, drizzle-kit commands
- Context7 `/vercel/next.js` (v16.1.6) — App Router, layouts, route groups
- Context7 `/shadcn-ui/ui` — Sidebar component structure, DataTable with @tanstack/react-table, form components
- [Railway Fastify deployment docs](https://docs.railway.com/guides/fastify) — Host binding `::` requirement
- [Railway monorepo docs](https://docs.railway.com/guides/monorepo) — Watch paths, service detection, workspace commands

### Secondary (MEDIUM confidence)
- [Next.js 16 announcement](https://nextjs.org/blog/next-16) — Turbopack stable, React 19.2, caching APIs stable
- [Zod v4 release notes](https://zod.dev/v4) — Subpath import, breaking changes from v3, migration guide
- [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) — tw-animate-css, OKLCH colors, data-slot attributes
- [fastify-type-provider-zod PR #176](https://github.com/turkerdev/fastify-type-provider-zod/pull/176) — zod/v4 + zod/v4-mini support confirmation

### Tertiary (LOW confidence)
- WebSearch results for npm workspaces + Fastify + Next.js monorepo patterns — community examples, no single authoritative source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified via Context7 with current versions and working code examples
- Architecture: HIGH — patterns directly from official documentation (Fastify plugins, Next.js App Router, shadcn sidebar)
- Pitfalls: HIGH — CORS/cookie credential issue, Railway host binding, and Edge runtime limitations are well-documented
- Deployment: MEDIUM — Railway monorepo auto-detection confirmed in docs but npm workspaces specifics less documented than pnpm

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (30 days — stable stack, no fast-moving dependencies)
