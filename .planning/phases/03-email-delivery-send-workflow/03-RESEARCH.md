# Phase 3: Email Delivery and Send Workflow - Research

**Researched:** 2026-03-02
**Domain:** Email delivery (Resend), email templating (React Email), webhook processing, admin send workflow
**Confidence:** HIGH

## Summary

Phase 3 adds the email delivery pipeline on top of the existing digest generation system. The core stack is **Resend** (email sending API) with **React Email** (email template components) and **svix** (webhook signature verification). The Fastify API server already uses `tsx` which supports JSX natively, so React Email components can be rendered directly in the API project without any additional build tooling.

The admin workflow extends the existing `issues` table status flow (`ready` -> `approved` -> `sent`) and the `deliveryStats` table already has all needed columns (`resendMessageId`, `sentAt`, `openedAt`, `bouncedAt`). The `members` table has `isBounced` ready for bounce suppression. This phase is primarily integration work -- connecting existing data structures to Resend's sending and webhook APIs.

**Primary recommendation:** Use `resend` SDK with `@react-email/components` + `@react-email/render` in the API project. Send emails via `resend.batch.send()` (up to 100 per call). Process webhooks via a public (unauthenticated) Fastify route with `svix` signature verification and `fastify-raw-body` for raw payload access.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Clean, professional Finnish newsletter style -- white background, readable typography
- AI-Sanomat logo/header at top, brief footer with unsubscribe link
- Hero image (1200x630) from digest, followed by story sections with section images (800x450)
- Each story: title, business impact paragraph, source link
- Responsive design -- works on mobile and desktop email clients
- Both HTML and plain text versions (EMAIL-07)
- List-Unsubscribe header per RFC 8058 (EMAIL-06)
- Admin triggers digest generation from client detail page (ADMIN-03)
- Full-page preview showing the email exactly as recipients would see it (ADMIN-04)
- Approve & Send button, or Regenerate button to re-run the pipeline (ADMIN-05)
- Issue status flow: ready -> approved -> sent (existing schema supports this)
- Send to all active, non-bounced members of the client
- Hard bounce: immediately set members.isBounced = true, suppress from future sends (EMAIL-05)
- Soft bounce: log but don't suppress (transient issue)
- Open tracking: tracking pixel in HTML email, record openedAt in deliveryStats (EMAIL-04)
- Resend webhooks: process delivery, open, bounce events via POST endpoint
- Admin dashboard (ADMIN-06) shows all clients in a table
- Per client: name, team size (member count), latest send date, open rate (opens/delivered %)
- Simple overview -- no charts for MVP, just the table with key metrics
- Domain is mail.aisanomat.fi
- Resend free tier: 100 emails/day

### Claude's Discretion
- React Email component structure and specific styling
- Webhook endpoint security (signature verification approach)
- Plain text generation from HTML content
- Exact dashboard table layout and sorting
- Resend SDK configuration details
- DNS setup instructions format (SPF/DKIM/DMARC)

### Deferred Ideas (OUT OF SCOPE)
- None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EMAIL-01 | System renders responsive HTML email using React Email with AI-Sanomat branding | React Email components (`@react-email/components` v1.0.8) with `@react-email/render` for HTML+text output |
| EMAIL-02 | System sends emails via Resend using own domain (mail.aisanomat.fi) | Resend SDK (`resend` v4.x) with domain verification in Resend dashboard |
| EMAIL-03 | SPF, DKIM, and DMARC DNS records configured for mail.aisanomat.fi | DNS record configuration via domain registrar -- documented in research |
| EMAIL-04 | System processes Resend webhooks for delivery, open, and bounce events | Svix webhook verification + Fastify raw body plugin + webhook route |
| EMAIL-05 | Hard-bounced member emails are automatically suppressed from future sends | Webhook handler sets `members.isBounced = true` on `email.bounced` with `bounce.type === "Permanent"` |
| EMAIL-06 | Every email includes List-Unsubscribe header (RFC 8058) | Resend `headers` parameter with `List-Unsubscribe` and `List-Unsubscribe-Post` headers |
| EMAIL-07 | Both HTML and plain text versions included in every email | Resend auto-generates plain text from `react` param; optionally use `render({ plainText: true })` for manual control |
| ADMIN-03 | Admin can trigger digest generation for a specific client | Existing `POST /digests/generate` endpoint already handles this |
| ADMIN-04 | Admin can preview generated digest (with images) before sending | New client detail page with rendered email preview using React Email components |
| ADMIN-05 | Admin can approve and send, or regenerate a digest | New API endpoints: `POST /digests/:id/approve`, `POST /digests/:id/send`, `POST /digests/:id/regenerate` |
| ADMIN-06 | Dashboard shows all clients with team size, latest send date, and open rate | New dashboard API endpoint + admin page with aggregated stats per client |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| resend | ^4.x (latest) | Email sending API | Official Resend SDK, well-maintained, direct React Email integration |
| @react-email/components | ^1.0.8 | Email template components | Official React Email component library (Body, Container, Section, Text, Img, Link, etc.) |
| @react-email/render | ^1.0.x | Render React to HTML/text | Official renderer for React Email -- `render()` for HTML, `render({ plainText: true })` for text |
| svix | latest | Webhook signature verification | Resend uses Svix for webhook signing -- `new Webhook(secret).verify(payload, headers)` |
| fastify-raw-body | ^5.0.0 | Raw request body access | Required for webhook signature verification -- preserves raw bytes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react | 19.2.3 | JSX runtime | Already in web/, needed in api/ for React Email component rendering |
| react-dom | 19.2.3 | Server-side rendering | Peer dependency for @react-email/render |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Email | MJML | MJML has its own DSL; React Email uses JSX the team already knows |
| Svix verification | Manual HMAC | Svix handles timestamp tolerance, replay protection -- don't hand-roll crypto |
| resend.batch.send() | Loop with resend.emails.send() | Batch is more efficient (up to 100 emails per API call), returns all IDs at once |

**Installation (api/):**
```bash
npm install resend @react-email/components @react-email/render svix fastify-raw-body
```

**Note:** `react` and `react-dom` may need to be added to api/package.json as dependencies since they are peer deps for @react-email/render. The API project currently does not have React. Add `react` and `react-dom` (same versions as web/).

**TSX configuration:** The API project already runs via `tsx` which supports JSX natively. Add to `api/tsconfig.json`:
```json
{
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

## Architecture Patterns

### Recommended Project Structure
```
api/src/
├── emails/                    # React Email template components
│   └── DigestEmail.tsx        # Main digest newsletter template
├── integrations/
│   ├── resendClient.ts        # Resend SDK client (send + batch)
│   └── ... (existing)
├── routes/
│   ├── digests.ts             # Extended with approve/send/regenerate
│   ├── webhooks.ts            # Public webhook endpoint (no auth)
│   └── dashboard.ts           # Dashboard stats endpoint
├── services/
│   ├── emailService.ts        # Email rendering + sending orchestration
│   └── ... (existing)
└── ...

web/src/app/(admin)/
├── clients/
│   ├── page.tsx               # Client list (existing)
│   └── [id]/
│       └── page.tsx           # Client detail with digest workflow (NEW)
├── dashboard/
│   └── page.tsx               # Dashboard with delivery stats (NEW, or extend existing /)
└── ...
```

### Pattern 1: Email Template as React Component
**What:** Define the newsletter email as a React Email component that accepts DigestContent + client data as props
**When to use:** For rendering the branded HTML email
**Example:**
```tsx
// api/src/emails/DigestEmail.tsx
import {
  Html, Head, Body, Container, Section, Text, Img, Link, Hr, Preview
} from '@react-email/components';
import type { DigestContent } from '../types/digest.js';

interface DigestEmailProps {
  clientName: string;
  digest: DigestContent & { stories: Array<DigestContent['stories'][number] & { imageUrl?: string }> };
  heroImageUrl: string | null;
  unsubscribeUrl: string;
}

export function DigestEmail({ clientName, digest, heroImageUrl, unsubscribeUrl }: DigestEmailProps) {
  return (
    <Html lang="fi">
      <Head />
      <Preview>{digest.intro.substring(0, 100)}</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
          {/* Header with logo */}
          <Section style={{ textAlign: 'center', paddingBottom: '20px' }}>
            <Text style={{ fontSize: '24px', fontWeight: 'bold' }}>AI-Sanomat</Text>
            <Text style={{ fontSize: '14px', color: '#666' }}>{clientName}</Text>
          </Section>

          {/* Hero image */}
          {heroImageUrl && (
            <Img src={heroImageUrl} width="600" height="315" alt="Viikkokatsaus"
                 style={{ width: '100%', height: 'auto' }} />
          )}

          {/* Intro */}
          <Text style={{ fontSize: '16px', lineHeight: '1.6' }}>{digest.intro}</Text>

          {/* Stories */}
          {digest.stories.map((story, i) => (
            <Section key={i} style={{ paddingTop: '20px' }}>
              {story.imageUrl && (
                <Img src={story.imageUrl} width="560" height="315" alt={story.title}
                     style={{ width: '100%', height: 'auto', borderRadius: '8px' }} />
              )}
              <Text style={{ fontSize: '20px', fontWeight: 'bold' }}>{story.title}</Text>
              <Text style={{ fontSize: '16px', lineHeight: '1.6' }}>{story.businessImpact}</Text>
              <Link href={story.sourceUrl} style={{ color: '#0066cc' }}>Lue lisaa</Link>
            </Section>
          ))}

          {/* Closing */}
          <Hr />
          <Text style={{ fontSize: '16px', lineHeight: '1.6' }}>{digest.closing}</Text>

          {/* Footer */}
          <Hr />
          <Section style={{ textAlign: 'center', paddingTop: '10px' }}>
            <Text style={{ fontSize: '12px', color: '#999' }}>
              AI-Sanomat - Tekoalyuutiset yrityksellesi
            </Text>
            <Link href={unsubscribeUrl} style={{ fontSize: '12px', color: '#999' }}>
              Peruuta tilaus
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

### Pattern 2: Resend Integration Client
**What:** Encapsulate Resend SDK as an integration client following existing pattern
**When to use:** For sending emails and batch operations
**Example:**
```typescript
// api/src/integrations/resendClient.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendBatchEmails(
  emails: Array<{
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    headers: Record<string, string>;
  }>
): Promise<Array<{ id: string }>> {
  // Resend batch.send supports up to 100 emails per call
  const { data, error } = await resend.batch.send(emails);
  if (error) {
    throw new Error(`Batch send failed: ${error.message}`);
  }
  return data ?? [];
}
```

### Pattern 3: Webhook Route Without Auth
**What:** Register webhook route WITHOUT the `authenticate` middleware since Resend sends to it
**When to use:** For the webhook endpoint
**Example:**
```typescript
// api/src/routes/webhooks.ts
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { Webhook } from 'svix';

const webhookRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post('/webhooks/resend', {
    config: { rawBody: true },  // Enable raw body for this route
    handler: async (request, reply) => {
      const secret = process.env.RESEND_WEBHOOK_SECRET;
      if (!secret) throw new Error('RESEND_WEBHOOK_SECRET not configured');

      const wh = new Webhook(secret);
      const payload = (request as any).rawBody;
      const headers = {
        'svix-id': request.headers['svix-id'] as string,
        'svix-timestamp': request.headers['svix-timestamp'] as string,
        'svix-signature': request.headers['svix-signature'] as string,
      };

      const event = wh.verify(payload, headers) as {
        type: string;
        data: { email_id: string; to: string[]; bounce?: { type: string } };
      };

      // Process event based on type
      switch (event.type) {
        case 'email.delivered':
          // Update deliveryStats status
          break;
        case 'email.opened':
          // Update deliveryStats openedAt
          break;
        case 'email.bounced':
          // Update deliveryStats bouncedAt + set member.isBounced if permanent
          break;
      }

      return reply.code(200).send({ received: true });
    },
  });
};
```

### Pattern 4: Email Preview via Rendered HTML
**What:** Admin preview uses the same React Email component rendered to HTML, served via API
**When to use:** For the ADMIN-04 preview feature
**Example:**
```typescript
// GET /digests/:id/preview -- returns rendered HTML for iframe preview
handler: async (request, reply) => {
  const issue = await getIssueById(request.params.id);
  const html = await renderDigestEmail(issue);
  return reply.type('text/html').send(html);
}
```
The frontend renders this in an `<iframe>` for pixel-perfect preview.

### Anti-Patterns to Avoid
- **Do NOT register webhooks under `/api/admin` prefix** -- webhooks are called by Resend, not the admin. Use a separate prefix like `/api/webhooks` or register at root.
- **Do NOT apply `fastify.authenticate` to webhook routes** -- Resend cannot provide JWT tokens. Use Svix signature verification instead.
- **Do NOT parse webhook body as JSON before verification** -- This breaks the cryptographic signature. Use `fastify-raw-body` to preserve raw bytes.
- **Do NOT send emails one-by-one in a loop** -- Use `resend.batch.send()` for efficiency (up to 100 per call).
- **Do NOT store images as data URIs in emails** -- Email clients block inline data URIs. Serve images via HTTP URLs (the existing `IMAGE_STORAGE_PATH` approach or a served endpoint).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email HTML rendering | Custom HTML string concatenation | React Email components + @react-email/render | Email HTML is notoriously inconsistent across clients; React Email handles cross-client quirks |
| Webhook signature verification | Manual HMAC computation | `svix` npm package | Handles timestamp tolerance, replay protection, base64 decoding of secret |
| Plain text email version | Regex HTML stripping | `@react-email/render` with `plainText: true` or Resend auto-generation | Proper text extraction preserves structure and links |
| Responsive email layout | Custom CSS media queries | React Email `Container`, `Section`, `Column` components | Email client CSS support is wildly inconsistent; React Email handles it |
| Email preview rendering | Client-side HTML construction | Server-rendered HTML via React Email served as `text/html` | Ensures preview matches exactly what recipients see |

**Key insight:** Email HTML is the most hostile rendering environment in web development. Every email client has different CSS support, different image handling, and different quirks. React Email abstracts these away with tested components.

## Common Pitfalls

### Pitfall 1: Raw Body for Webhook Verification
**What goes wrong:** Webhook signature verification fails because Fastify auto-parses JSON body, altering whitespace/ordering
**Why it happens:** Svix HMAC is computed over the exact raw bytes; JSON.parse then JSON.stringify changes the string
**How to avoid:** Register `fastify-raw-body` plugin with `global: false`, enable `rawBody: true` only on webhook routes via route config
**Warning signs:** `WebhookVerificationError` or similar errors on every incoming webhook

### Pitfall 2: Webhook Route Must Be Public
**What goes wrong:** Resend webhooks return 401 because they hit the authenticate middleware
**Why it happens:** All routes under `/api/admin` require JWT authentication
**How to avoid:** Register webhook routes under a different prefix (e.g., `/api/webhooks`) that does NOT have the `authenticate` middleware
**Warning signs:** Webhook delivery failures in Resend dashboard showing 401 responses

### Pitfall 3: Image URLs Must Be Absolute Public URLs
**What goes wrong:** Images show as broken in emails
**Why it happens:** Email clients cannot access relative URLs or localhost URLs
**How to avoid:** Images must be served via absolute public HTTPS URLs. For production, serve uploaded images via a public route or use a CDN. For development/testing, use placeholder URLs.
**Warning signs:** Broken image icons in email previews

### Pitfall 4: Batch Send Limitations
**What goes wrong:** Batch send fails or returns partial results
**Why it happens:** Resend batch.send() supports max 100 emails per call, max 50 recipients per email. Attachments and `scheduled_at` are not supported in batch.
**How to avoid:** If a client has >100 members, chunk into multiple batch calls. Each email in the batch should have a single `to` recipient (one email per member for individual tracking).
**Warning signs:** Error responses from batch API, missing delivery stats for some members

### Pitfall 5: Resend Free Tier Rate Limits
**What goes wrong:** Emails fail to send after hitting daily limit
**Why it happens:** Resend free tier allows only 100 emails/day
**How to avoid:** Track send counts, warn admin before sending if count + recipients exceeds limit. Display member count before the "Send" action.
**Warning signs:** 429 rate limit errors from Resend API

### Pitfall 6: List-Unsubscribe Requires Both Headers
**What goes wrong:** Gmail/Yahoo don't show the unsubscribe button
**Why it happens:** RFC 8058 requires both `List-Unsubscribe` AND `List-Unsubscribe-Post` headers
**How to avoid:** Always set both headers:
```typescript
headers: {
  'List-Unsubscribe': '<https://yourapp.com/unsubscribe?token=xxx>',
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
}
```
**Warning signs:** No unsubscribe button visible in Gmail/Yahoo mail client UI

### Pitfall 7: Webhook Mapping Requires resendMessageId
**What goes wrong:** Cannot match webhook events to deliveryStats records
**Why it happens:** Resend webhook payload contains `email_id` which corresponds to the ID returned by `emails.send()` or `batch.send()`
**How to avoid:** Store the returned message ID in `deliveryStats.resendMessageId` when sending. Look up by this ID when processing webhooks.
**Warning signs:** Webhook events arrive but no matching delivery record found

## Code Examples

### Rendering Email to HTML and Plain Text
```typescript
// Source: @react-email/render docs + Resend docs
import { render } from '@react-email/render';
import { DigestEmail } from '../emails/DigestEmail.js';

async function renderDigestEmail(props: DigestEmailProps) {
  const html = await render(<DigestEmail {...props} />);
  const text = await render(<DigestEmail {...props} />, { plainText: true });
  return { html, text };
}
```

### Sending Batch Emails with Resend
```typescript
// Source: Resend batch API docs
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const emails = members.map(member => ({
  from: 'AI-Sanomat <noreply@mail.aisanomat.fi>',
  to: [member.email],
  subject: `AI-Sanomat viikkokatsaus: ${clientName}`,
  html: renderedHtml,
  text: renderedText,
  headers: {
    'List-Unsubscribe': `<https://app.aisanomat.fi/api/unsubscribe?member=${member.id}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  },
}));

// Batch send (max 100 per call)
const { data, error } = await resend.batch.send(emails);
// data = [{ id: 'msg-uuid-1' }, { id: 'msg-uuid-2' }, ...]
```

### Processing Webhook Events
```typescript
// Source: Resend webhook event types + svix verification
import { Webhook } from 'svix';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { deliveryStats, members } from '../db/schema.js';

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    bounce?: {
      message: string;
      type: string;     // 'Permanent' or 'Temporary'
      subType: string;
    };
  };
}

async function processWebhookEvent(event: ResendWebhookEvent) {
  const { email_id } = event.data;

  // Find delivery stat by resendMessageId
  const [stat] = await db
    .select()
    .from(deliveryStats)
    .where(eq(deliveryStats.resendMessageId, email_id));

  if (!stat) return; // Unknown message, ignore

  switch (event.type) {
    case 'email.delivered':
      await db.update(deliveryStats)
        .set({ status: 'delivered' })
        .where(eq(deliveryStats.id, stat.id));
      break;

    case 'email.opened':
      await db.update(deliveryStats)
        .set({ status: 'opened', openedAt: new Date() })
        .where(eq(deliveryStats.id, stat.id));
      break;

    case 'email.bounced':
      await db.update(deliveryStats)
        .set({ status: 'bounced', bouncedAt: new Date() })
        .where(eq(deliveryStats.id, stat.id));

      // Hard bounce -> suppress member
      if (event.data.bounce?.type === 'Permanent') {
        await db.update(members)
          .set({ isBounced: true })
          .where(eq(members.id, stat.memberId));
      }
      break;
  }
}
```

### Dashboard Aggregation Query
```typescript
// Source: Drizzle ORM patterns from existing codebase
import { eq, count, max, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clients, members, issues, deliveryStats } from '../db/schema.js';

async function getDashboardStats() {
  // Use subqueries for per-client aggregation
  const stats = await db
    .select({
      clientId: clients.id,
      clientName: clients.name,
      teamSize: sql<number>`(SELECT COUNT(*) FROM members WHERE client_id = clients.id AND is_active = true)`,
      latestSend: sql<string>`(SELECT MAX(sent_at) FROM delivery_stats ds JOIN issues i ON ds.issue_id = i.id WHERE i.client_id = clients.id)`,
      openRate: sql<number>`(
        SELECT CASE WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND(COUNT(*) FILTER (WHERE ds.opened_at IS NOT NULL)::numeric / COUNT(*)::numeric * 100, 1)
        END
        FROM delivery_stats ds JOIN issues i ON ds.issue_id = i.id
        WHERE i.client_id = clients.id AND ds.status != 'failed'
      )`,
    })
    .from(clients)
    .where(eq(clients.isActive, true));

  return stats;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Table-based HTML emails | React Email components | 2023-2024 | Type-safe, component-based email templates with built-in cross-client compatibility |
| Nodemailer + custom SMTP | Resend API | 2023+ | No SMTP server management, built-in analytics, webhook events |
| Manual webhook HMAC | Svix library | 2023+ | Standard webhook verification with replay protection |
| Separate HTML + text templates | Single React Email component + render options | React Email v1+ | One source of truth, auto-generated plain text |
| Custom HTML string templates | @react-email/render | 2024+ | Consistent rendering, Tailwind support, component reuse |

**Deprecated/outdated:**
- `@react-email/html` (individual packages): Use `@react-email/components` (unified package) instead
- Manual Resend API calls via fetch: Use `resend` SDK which handles auth, error handling, types

## Open Questions

1. **Image serving in production**
   - What we know: Images are stored locally (IMAGE_STORAGE_PATH), currently served for admin preview
   - What's unclear: How to serve images via public HTTPS URLs in production for email rendering
   - Recommendation: Add a public static file serving route in Fastify for uploaded images, or use the Railway deployment URL. Images need absolute URLs in emails.

2. **Unsubscribe endpoint implementation**
   - What we know: RFC 8058 requires a POST endpoint that processes unsubscribe; List-Unsubscribe header points to a URL
   - What's unclear: Since self-service unsubscribe is out of scope (company contact manages team), how to handle one-click unsubscribe
   - Recommendation: Create a minimal public endpoint that logs the unsubscribe request and notifies admin. Don't auto-remove -- just mark and flag. This satisfies the RFC while keeping enterprise control.

3. **DNS record verification timing**
   - What we know: SPF/DKIM/DMARC need DNS records; propagation takes hours, monitoring takes weeks
   - What's unclear: Whether DNS is already partially configured
   - Recommendation: Document the required DNS records. Implementation can proceed using Resend's sandbox domain for testing, switching to mail.aisanomat.fi once verified.

## Sources

### Primary (HIGH confidence)
- [Resend Node.js SDK docs](https://resend.com/docs/send-with-nodejs) - Send API, react parameter, headers
- [Resend batch send API](https://resend.com/docs/api-reference/emails/send-batch-emails) - Batch up to 100, response format, limitations
- [Resend webhook event types](https://resend.com/docs/dashboard/webhooks/event-types) - All event types, payload structure
- [Resend webhook verification](https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests) - Svix-based, three headers, secret
- [Resend List-Unsubscribe docs](https://resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails) - Headers parameter usage
- [React Email GitHub](https://github.com/resend/react-email) - Components, render, version 5.2.9
- [Svix webhook verification docs](https://docs.svix.com/receiving/verifying-payloads/how) - npm package, verify API
- [fastify-raw-body GitHub](https://github.com/Eomm/fastify-raw-body) - v5.0.0, route config, usage
- [@react-email/components npm](https://www.npmjs.com/package/@react-email/components) - v1.0.8, unified package
- [RFC 8058](https://datatracker.ietf.org/doc/html/rfc8058) - One-click List-Unsubscribe specification

### Secondary (MEDIUM confidence)
- [Resend automatic plain text](https://resend.com/changelog/automatic-plain-text-emails) - Auto-generates text from HTML/react
- [Resend webhook bounce payload](https://resend.com/blog/webhooks) - Bounce object with type (Permanent/Temporary)

### Tertiary (LOW confidence)
- React Email render plainText option API: confirmed by multiple sources but exact API may vary by version

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages verified via npm, official docs, and GitHub
- Architecture: HIGH - Follows existing codebase patterns (integration clients, Fastify routes, Drizzle ORM)
- Pitfalls: HIGH - Webhook raw body issue is well-documented; email rendering quirks are known
- Email template: MEDIUM - Component structure is discretionary; React Email API is stable but specific styling needs testing across clients

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (30 days -- Resend and React Email are stable)
