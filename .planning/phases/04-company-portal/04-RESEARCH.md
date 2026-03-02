# Phase 4: Company Portal - Research

**Researched:** 2026-03-02
**Domain:** Passwordless authentication (magic links) + company team management portal
**Confidence:** HIGH

## Summary

Phase 4 builds a separate company-facing portal with magic link authentication and team member management. The implementation leverages the existing stack entirely: @fastify/jwt for token signing/verification (already configured), Resend for sending magic link emails (single-email send via `resend.emails.send()`), React Email for the magic link HTML template (matching existing DigestEmail pattern), and the existing Next.js middleware extended with portal-aware routing.

The architecture is straightforward: a JWT-based magic link (not an opaque token stored in DB) keeps the implementation simple -- the magic link URL contains a short-lived JWT with the client's email and ID, which upon verification issues a longer-lived session JWT with `role: 'company'`. No new database tables are needed. The members table already has all required fields (email, name, isActive, isBounced, clientId).

**Primary recommendation:** Use JWT-based magic links (short-lived JWT in URL, verified with existing @fastify/jwt infrastructure) rather than opaque tokens (which would require a new DB table for token storage). Keep portal routes under `/api/portal/` prefix and `/(portal)` Next.js route group, fully parallel to the admin structure.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Portal lives at `/portal/login` -- separate route group from admin `/(admin)`
- Magic link expires in 15 minutes
- Portal session lasts 7 days (matches admin JWT expiry)
- Only the `contact_email` from the `clients` table can request a magic link -- regular team members cannot log in
- Flow: enter email -> receive magic link -> click link -> JWT issued with `role: 'company'` + `clientId`
- Simple table using shadcn Table component -- columns: email, name, status (active/bounced badge)
- Add members: both single-add via dialog (email + optional name) AND bulk import (comma-separated emails)
- Remove members: confirmation dialog, then soft-delete by setting `isActive=false` -- record preserved for delivery history, can be re-added
- Status badges visible: active (green) and bounced (red) per member
- Sidebar layout reusing admin's sidebar pattern (shadcn sidebar component)
- Company name + current plan (AI Pulse/AI Teams) shown as header
- Sidebar navigation: "Team members" + "Newsletter archive" + logout
- Newsletter archive: read-only list of past sent newsletters for the company
- Custom branded look -- portal-specific colors/styling, distinct from admin panel
- Branded HTML template built with React Email (matching newsletter visual style)
- Sender: AI-Sanomat <katsaus@mail.aisanomat.fi> (existing verified sender)
- Finnish language throughout (subject line, body, CTA button)
- Security footer: "Jos et pyytanyt tata linkkia, voit jattaa taman viestin huomiotta"
- CTA button: "Kirjaudu sisaan"

### Claude's Discretion
- Magic link JWT implementation details (signing, token structure)
- Exact portal color scheme and branding details
- Newsletter archive page layout and pagination
- Error states (invalid link, expired link, unknown email)
- Loading states and skeleton screens
- Bulk import validation and error messaging

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PORTAL-01 | Company contact receives magic link via email and logs in without password | JWT-based magic link flow using existing @fastify/jwt, Resend single-email send, React Email template. Middleware extended for portal-aware routing. |
| PORTAL-02 | Company contact can add and remove team members (email addresses) | Portal API routes for CRUD on members table (already exists). shadcn Table + Dialog + Badge components. Soft-delete pattern (isActive=false). Bulk import with email validation. |
</phase_requirements>

## Standard Stack

### Core (already installed, no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @fastify/jwt | 9.0.3 | Sign/verify magic link tokens AND session JWTs | Already configured with cookie support, same secret |
| @fastify/cookie | 11.0.2 | Cookie-based JWT session | Already registered via auth plugin |
| resend | 6.9.3 | Send magic link emails (single send) | Already in use for newsletter delivery |
| @react-email/components | 1.0.8 | Magic link email template (Button, Html, etc.) | Already used for DigestEmail template |
| @react-email/render | 2.0.4 | Render React Email to HTML/text | Already used in emailService.ts |
| jose | 5.10.0 | JWT verification in Next.js middleware | Already used in web/middleware.ts |
| drizzle-orm | 0.45.0 | Database queries for members + clients | Already the project ORM |
| shadcn/ui | 3.8.5 | Table, Dialog, Badge, Sidebar, Button, Form, Input | All components already installed |

### Supporting (no new packages needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js crypto | built-in | NOT needed -- using JWT as magic link token | -- |
| zod | 3.25.x | Request/response schema validation | All portal API routes |
| react-hook-form | 7.71.2 | Form management for add-member dialog | Already installed in web |
| lucide-react | 0.484.0 | Icons (Mail, Users, Archive, LogOut, Plus, Trash2) | Portal UI icons |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JWT magic link | Opaque token in DB | Opaque token requires new DB table + cleanup job; JWT is stateless and uses existing infrastructure |
| Separate portal cookie name | Same `token` cookie | Same cookie name works because JWT payload contains `role` field to differentiate; separate cookie would add complexity to middleware |

**Installation:**
```bash
# No new packages needed. Everything is already installed.
```

## Architecture Patterns

### Recommended Project Structure
```
api/src/
  routes/
    portal.ts              # All portal API routes (login, verify, members, archive)
  emails/
    MagicLinkEmail.tsx     # React Email template for magic link
  services/
    portalAuth.ts          # Magic link generation + verification + email sending

web/src/app/
  (portal)/
    layout.tsx             # Portal layout with sidebar, distinct from admin
    tiimi/                 # Team members page
      page.tsx
    arkisto/               # Newsletter archive page
      page.tsx
  portal/
    login/
      page.tsx             # Magic link request form
    verify/
      page.tsx             # Magic link verification + redirect

web/src/components/
  portal-sidebar.tsx       # Portal-specific sidebar component
```

### Pattern 1: JWT-Based Magic Link Flow
**What:** Use a short-lived JWT as the magic link token (not an opaque DB-stored token)
**When to use:** When the existing infrastructure already supports JWT signing/verification
**Example:**
```typescript
// API: Generate magic link (api/src/services/portalAuth.ts)
// Sign a short-lived JWT with the client's email
const magicToken = app.jwt.sign(
  { email: contactEmail, clientId: client.id, purpose: 'magic-link' },
  { expiresIn: '15m' }
);
const magicLink = `${process.env.PUBLIC_URL}/portal/verify?token=${magicToken}`;

// API: Verify magic link and issue session token
// POST /api/portal/verify
const decoded = app.jwt.verify(token); // throws if expired/invalid
if (decoded.purpose !== 'magic-link') throw new Error('Invalid token purpose');
// Issue session JWT
const sessionToken = reply.jwtSign(
  { email: decoded.email, role: 'company', clientId: decoded.clientId },
  { expiresIn: '7d' }
);
// Set cookie same as admin login
reply.setCookie('token', sessionToken, {
  path: '/', secure: process.env.NODE_ENV === 'production',
  httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60,
});
```

### Pattern 2: Portal-Aware Middleware
**What:** Extend existing Next.js middleware to handle portal routes differently from admin
**When to use:** Portal and admin share the same cookie but need different login redirects
**Example:**
```typescript
// web/middleware.ts - extended
export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const pathname = request.nextUrl.pathname;

  // Public portal pages (login form, verification)
  if (pathname === '/portal/login' || pathname === '/portal/verify') {
    // If already has valid portal token, redirect to portal dashboard
    if (token) {
      const payload = await verifyAndDecode(token);
      if (payload?.role === 'company') {
        return NextResponse.redirect(new URL('/tiimi', request.url));
      }
    }
    return NextResponse.next();
  }

  // Portal pages require 'company' role
  if (pathname.startsWith('/tiimi') || pathname.startsWith('/arkisto')) {
    if (!token) return NextResponse.redirect(new URL('/portal/login', request.url));
    const payload = await verifyAndDecode(token);
    if (!payload || payload.role !== 'company') {
      return NextResponse.redirect(new URL('/portal/login', request.url));
    }
    return NextResponse.next();
  }

  // Admin pages (existing logic unchanged)
  if (pathname === '/login') { /* existing */ }
  // ... rest of existing middleware
}
```

### Pattern 3: Portal API Routes with Role Check
**What:** New `/api/portal/` prefix with decorator that checks `role: 'company'` in JWT
**When to use:** All portal-specific endpoints
**Example:**
```typescript
// api/src/routes/portal.ts
const portalRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  // Portal authentication decorator - checks role=company
  const authenticatePortal = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      if (request.user.role !== 'company') {
        return reply.code(403).send({ error: 'Forbidden' });
      }
    } catch {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  };

  // GET /portal/members - list team members for the logged-in company
  f.route({
    method: 'GET',
    url: '/members',
    onRequest: [authenticatePortal],
    handler: async (request, reply) => {
      const members = await db.select().from(membersTable)
        .where(eq(membersTable.clientId, request.user.clientId))
        .orderBy(membersTable.createdAt);
      return reply.send(members);
    },
  });
};
```

### Pattern 4: Resend Single Email Send
**What:** Send individual magic link emails using `resend.emails.send()` (not batch)
**When to use:** Magic link delivery -- one email at a time
**Example:**
```typescript
// api/src/integrations/resendClient.ts - add single send function
export async function sendSingleEmail(payload: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ id: string }> {
  const response = await getResend().emails.send(payload);
  if (response.error) {
    throw new Error(`Resend send failed: ${response.error.message}`);
  }
  return { id: response.data!.id };
}
```

### Anti-Patterns to Avoid
- **Storing magic link tokens in DB:** Adds unnecessary table, cleanup cron, and complexity when JWT is stateless and self-expiring
- **Sharing the admin authenticate decorator for portal:** The admin `authenticate` doesn't check role -- portal needs its own decorator that verifies `role: 'company'`
- **Using separate JWT secret for portal:** Same @fastify/jwt instance, same secret -- differentiate via `role` in payload, not separate secrets
- **Client-side JWT decode for clientId:** Always extract clientId from server-side JWT verification, never trust client-side decoded values

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Magic link token | Custom crypto token + DB storage | JWT via @fastify/jwt | Self-expiring, no cleanup needed, existing infrastructure |
| Email template | Raw HTML string | React Email components (Button, Container, etc.) | Consistent with DigestEmail, cross-client rendering |
| Email sending | Manual SMTP/fetch | Resend `emails.send()` | Already configured, has delivery tracking |
| Form validation | Manual validation | Zod schemas + react-hook-form | Project pattern, type-safe |
| Member table UI | Custom table | shadcn Table + @tanstack/react-table | Already used in admin, accessible |
| Sidebar navigation | Custom nav | shadcn Sidebar component | Exact same pattern as admin AppSidebar |

**Key insight:** This entire phase uses zero new dependencies. Every piece of infrastructure exists -- the work is extending existing patterns into a new route group.

## Common Pitfalls

### Pitfall 1: Magic Link Token Replay
**What goes wrong:** A magic link JWT can be used multiple times within its 15-minute window
**Why it happens:** JWTs are stateless -- there's no server-side record of "used" tokens
**How to avoid:** For an MVP this is acceptable. The risk is low because: (1) magic links are emailed to the contact, not shared, (2) the 15-minute window is short, (3) clicking the link just creates a session, it doesn't perform a destructive action. If needed later, add a `usedMagicTokens` set in memory or Redis.
**Warning signs:** Not a practical concern for this scale

### Pitfall 2: Middleware Route Matching Order
**What goes wrong:** Portal routes get caught by admin's catch-all redirect to `/login`
**Why it happens:** Current middleware redirects ALL unauthenticated users to `/login` -- no distinction between admin and portal routes
**How to avoid:** Update middleware matcher and add portal route checks BEFORE the admin catch-all. Use the route group structure: `/(portal)` routes map to `/tiimi`, `/arkisto`; `/portal/login` and `/portal/verify` are public.
**Warning signs:** Portal users getting redirected to admin login instead of portal login

### Pitfall 3: JWT Payload Type Mismatch
**What goes wrong:** TypeScript types for `request.user` don't include `clientId`
**Why it happens:** The existing `FastifyJWT` interface declares `payload: { email: string; role: string }` -- no `clientId`
**How to avoid:** Extend the FastifyJWT interface in the auth plugin to include `clientId` as optional: `{ email: string; role: string; clientId?: number }`. The admin JWT won't have it (undefined), portal JWT will.
**Warning signs:** TypeScript errors when accessing `request.user.clientId`

### Pitfall 4: Same Cookie for Two Roles
**What goes wrong:** Admin logs in, then visits portal -- the admin JWT cookie is present but has `role: 'admin'`, not `role: 'company'`
**Why it happens:** Both admin and portal use the same `token` cookie
**How to avoid:** Middleware must check the `role` claim, not just token validity. Portal routes require `role: 'company'`, admin routes continue working as-is (any valid token). If a user has the wrong role, redirect to the appropriate login page.
**Warning signs:** Admin users seeing 403 on portal pages or vice versa

### Pitfall 5: Email Not Found Silent Behavior
**What goes wrong:** An attacker probes email addresses and learns which ones are registered clients
**Why it happens:** Different response for "email found, link sent" vs "email not found"
**How to avoid:** Always return the same success response ("If this email is registered, you'll receive a login link") regardless of whether the email exists in the clients table. This is standard security practice for magic link flows.
**Warning signs:** Different API responses or timing for valid vs invalid emails

### Pitfall 6: Bulk Import Edge Cases
**What goes wrong:** Duplicate emails, malformed entries, or emails that already exist in the team
**Why it happens:** Users paste messy data from spreadsheets
**How to avoid:** (1) Parse comma-separated, trim whitespace, filter empty strings. (2) Validate each email with Zod `z.string().email()`. (3) Check for duplicates within the input AND against existing members. (4) For existing-but-inactive members, re-activate (set isActive=true) instead of creating duplicates. (5) Return a summary: added N, skipped N duplicates, N invalid.
**Warning signs:** Unique constraint violations, duplicate member rows

## Code Examples

### Magic Link Email Template (React Email)
```tsx
// api/src/emails/MagicLinkEmail.tsx
// Follows exact pattern of existing DigestEmail.tsx
import {
  Html, Head, Body, Container, Section, Text, Button, Preview,
} from '@react-email/components';

export interface MagicLinkEmailProps {
  magicLinkUrl: string;
  companyName: string;
}

export function MagicLinkEmail({ magicLinkUrl, companyName }: MagicLinkEmailProps) {
  return (
    <Html lang="fi">
      <Head />
      <Preview>Kirjaudu AI-Sanomat-portaaliin</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={logoStyle}>AI-Sanomat</Text>
            <Text style={subtitleStyle}>{companyName}</Text>
          </Section>
          <Section style={contentStyle}>
            <Text style={paragraphStyle}>
              Hei! Klikkaa alla olevaa painiketta kirjautuaksesi AI-Sanomat-portaaliin.
            </Text>
            <Button href={magicLinkUrl} style={buttonStyle}>
              Kirjaudu sisaan
            </Button>
            <Text style={footerNote}>
              Linkki vanhenee 15 minuutin kuluttua.
            </Text>
          </Section>
          <Section style={securityFooterStyle}>
            <Text style={securityText}>
              Jos et pyytanyt tata linkkia, voit jattaa taman viestin huomiotta.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

### Portal Authentication Decorator
```typescript
// Extends existing authenticate pattern from api/src/plugins/auth.ts
// Add to FastifyJWT interface:
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { email: string; role: string; clientId?: number };
    user: { email: string; role: string; clientId?: number };
  }
}
```

### Member Soft-Delete (Re-activatable)
```typescript
// Soft-delete: set isActive=false, preserve record
await db.update(members)
  .set({ isActive: false, updatedAt: new Date() })
  .where(and(eq(members.id, memberId), eq(members.clientId, clientId)));

// Re-add: if email exists but inactive, reactivate
const existing = await db.select().from(members)
  .where(and(eq(members.email, email), eq(members.clientId, clientId)));
if (existing.length > 0) {
  await db.update(members)
    .set({ isActive: true, isBounced: false, name: name || existing[0].name, updatedAt: new Date() })
    .where(eq(members.id, existing[0].id));
} else {
  await db.insert(members).values({ email, name, clientId, isActive: true });
}
```

### Newsletter Archive Query
```typescript
// Get sent issues for a specific client
const sentIssues = await db.select({
  id: issues.id,
  weekNumber: issues.weekNumber,
  year: issues.year,
  status: issues.status,
  createdAt: issues.createdAt,
  updatedAt: issues.updatedAt,
}).from(issues)
  .where(and(eq(issues.clientId, clientId), eq(issues.status, 'sent')))
  .orderBy(desc(issues.updatedAt));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Opaque token in DB for magic links | JWT-based magic links (stateless) | Common since 2023 | No DB table needed, self-expiring |
| Separate auth service for passwordless | Same JWT infrastructure + short-lived token | N/A | Simplicity -- one JWT library handles both |
| Custom email HTML strings | React Email components | 2023+ | Type-safe, component-based email templates |

**Deprecated/outdated:**
- None relevant -- all project dependencies are current

## Open Questions

1. **Portal Route Group Naming**
   - What we know: Context says portal lives at `/portal/login`, sidebar has "Team members" + "Newsletter archive"
   - What's unclear: The exact URL structure for portal pages. Using `/(portal)/tiimi` and `/(portal)/arkisto` (Finnish) is consistent with Finnish UI, but `/portal/login` and `/portal/verify` are outside the route group (public pages)
   - Recommendation: Use `/(portal)/tiimi/page.tsx` and `/(portal)/arkisto/page.tsx` for authenticated portal pages. Public pages at `/portal/login/page.tsx` and `/portal/verify/page.tsx` (outside route group, no sidebar).

2. **Newsletter Archive Scope (v1 vs v2)**
   - What we know: CONTEXT.md lists "Newsletter archive" as sidebar item. REQUIREMENTS.md lists PORTAL-05 as v2 feature.
   - What's unclear: Whether a basic read-only archive should be included in v1 or deferred entirely
   - Recommendation: Include a minimal archive page (list of sent issues with date/week number) since the context explicitly mentions it as a sidebar item. Keep it read-only, no rich previewing. This is a simple query with no new infrastructure.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `api/src/plugins/auth.ts`, `api/src/routes/auth.ts` -- JWT + cookie auth pattern
- Existing codebase: `api/src/emails/DigestEmail.tsx` -- React Email template pattern
- Existing codebase: `api/src/integrations/resendClient.ts` -- Resend client usage
- Existing codebase: `web/middleware.ts` -- JWT verification with jose
- Existing codebase: `api/src/db/schema.ts` -- members table with all needed fields

### Secondary (MEDIUM confidence)
- [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email) -- `resend.emails.send()` for single emails
- [React Email Button component](https://react.email/docs/components/button) -- Button with `href` prop for CTA
- [@fastify/jwt GitHub](https://github.com/fastify/fastify-jwt) -- JWT signing/verification API

### Tertiary (LOW confidence)
- None -- all findings verified against existing codebase or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - everything already installed and used in the project
- Architecture: HIGH - extends existing patterns (route groups, JWT auth, Resend, React Email)
- Pitfalls: HIGH - identified from analyzing actual codebase integration points (middleware, JWT types, cookie sharing)

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable -- no external dependency changes expected)
