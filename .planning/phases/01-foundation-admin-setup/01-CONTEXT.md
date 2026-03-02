# Phase 1: Foundation and Admin Setup - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Database schema, Fastify API skeleton with typed routes, admin authentication, monorepo structure, and admin panel for managing clients, news sources, and prompt templates. Deployment to Railway. Everything needed before the content pipeline can run.

</domain>

<decisions>
## Implementation Decisions

### Admin Panel Layout
- Sidebar navigation (left side): Dashboard, Clients, Sources, Templates
- shadcn/ui components with Tailwind 4
- Dashboard is the landing page after login
- Clean, functional — this is an internal tool for Janne, not a customer-facing product

### Industry Taxonomy
- Fixed dropdown with predefined industries
- Initial set: taloushallinto, markkinointi, rakennusala, terveydenhuolto, lakiala, IT/ohjelmistokehitys, logistiikka, koulutus, rahoitus, vähittäiskauppa
- Stored as text field in clients table (not a separate table)
- New industries can be added to the dropdown via code — no need for admin UI to manage the list in MVP

### Prompt Template Editing
- Simple textarea with a variable reference sidebar showing available placeholders ({{industry}}, {{company_name}}, {{news_items}}, {{previous_issues}})
- No rich text editor — prompts are plain text
- Each template has name, description, and the template text
- Version tracking via updated_at timestamp (not full version history in MVP)

### Default Seed Data
- Full starter kit seeded on first deploy:
  - RSS sources: OpenAI blog, Anthropic blog, Google AI blog, TechCrunch AI, The Verge AI, Ars Technica AI
  - Beehiiv source: aisanomat.fi (configured with publication ID)
  - Default prompt templates: viikkokatsaus_generointi (digest generation), faktojen_validointi (fact validation), kuvapromptit (image prompt generation)
  - Industry list predefined in code
- Admin can add/modify sources from day one

### Monorepo Structure
- npm workspaces with api/ and web/ directories (research recommends this over apps/ prefix)
- packages/shared/ for TypeScript types and Zod schemas shared between API and frontend
- Root package.json with workspace config

### Authentication
- Hardcoded admin: jannenne@gmail.com with password from environment variable (ADMIN_PASSWORD)
- JWT token returned on login, stored in httpOnly cookie
- No refresh token in MVP — long-lived JWT (7 days)
- All /api/admin/* routes require valid admin JWT

### Claude's Discretion
- Exact shadcn/ui component choices for forms and tables
- Database migration strategy (drizzle-kit push vs generate)
- Railway deployment configuration details
- API error response format
- Exact Fastify plugin registration order

</decisions>

<specifics>
## Specific Ideas

- Admin panel should feel functional and fast — think Linear's admin, not a flashy marketing dashboard
- Finnish labels in the UI (this is Janne's tool, Finnish is natural)
- Prompt templates are critical infrastructure — the variable reference sidebar should make it obvious what placeholders are available

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- No existing application code — greenfield project
- .claude/skills/ contain Python scripts with patterns for env loading and error handling (not reusable in Node.js app)

### Established Patterns
- Codebase mapping prescribes: routes/ for HTTP, services/ for business logic, integrations/ for external APIs, db/ for schema
- Finnish comments and UI labels are acceptable per conventions

### Integration Points
- Railway PostgreSQL for database hosting
- Resend SDK needed for magic links in Phase 4 (not this phase)
- Next.js 16 route groups: (admin) for admin panel, (portal) for company portal

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-admin-setup*
*Context gathered: 2026-03-02*
