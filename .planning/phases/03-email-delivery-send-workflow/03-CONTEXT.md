# Phase 3: Email Delivery and Send Workflow - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can preview, approve, and send AI-generated digests as branded HTML emails to enterprise client team members. System tracks delivery, opens, and bounces via Resend webhooks. Hard-bounced addresses are automatically suppressed.

Scope: Email rendering, Resend integration, admin send workflow UI, webhook processing, bounce handling, admin dashboard with delivery stats. Does NOT include company portal (Phase 4) or self-service unsubscribe.

</domain>

<decisions>
## Implementation Decisions

### Email branding & template
- Clean, professional Finnish newsletter style — white background, readable typography
- AI-Sanomat logo/header at top, brief footer with unsubscribe link
- Hero image (1200x630) from digest, followed by story sections with section images (800x450)
- Each story: title, business impact paragraph, source link
- Responsive design — works on mobile and desktop email clients
- Both HTML and plain text versions (EMAIL-07)
- List-Unsubscribe header per RFC 8058 (EMAIL-06)

### Admin send workflow
- Admin triggers digest generation from client detail page (ADMIN-03)
- Full-page preview showing the email exactly as recipients would see it (ADMIN-04)
- Approve & Send button, or Regenerate button to re-run the pipeline (ADMIN-05)
- Issue status flow: ready -> approved -> sent (existing schema supports this)
- Send to all active, non-bounced members of the client

### Bounce & tracking
- Hard bounce: immediately set members.isBounced = true, suppress from future sends (EMAIL-05)
- Soft bounce: log but don't suppress (transient issue)
- Open tracking: tracking pixel in HTML email, record openedAt in deliveryStats (EMAIL-04)
- Resend webhooks: process delivery, open, bounce events via POST endpoint

### Dashboard
- Admin dashboard (ADMIN-06) shows all clients in a table
- Per client: name, team size (member count), latest send date, open rate (opens/delivered %)
- Simple overview — no charts for MVP, just the table with key metrics

### Claude's Discretion
- React Email component structure and specific styling
- Webhook endpoint security (signature verification approach)
- Plain text generation from HTML content
- Exact dashboard table layout and sorting
- Resend SDK configuration details
- DNS setup instructions format (SPF/DKIM/DMARC)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `issues` table: status enum already has 'approved' and 'sent' states — full workflow supported
- `deliveryStats` table: tracks per-member delivery with resendMessageId, sentAt, openedAt, bouncedAt
- `members` table: has isBounced field ready for bounce suppression
- `api/src/services/newsletterService.ts`: generateClientDigest() produces structured JSON content
- `api/src/types/digest.ts`: DigestContent interface (intro, stories[], closing) for template rendering
- `web/src/lib/api.ts`: apiFetch with auth, 204 handling
- shadcn/ui components: Table, Button, Card, etc. already installed
- sonner for toast notifications

### Established Patterns
- Fastify route plugins with ZodTypeProvider and authenticate middleware
- Service layer in api/src/services/ with Drizzle ORM queries
- Integration clients in api/src/integrations/ (rss, beehiiv, claude, gemini)
- Admin pages as 'use client' React components in web/src/app/(admin)/
- Next.js rewrites proxy API calls to Fastify (same-origin)

### Integration Points
- `api/src/app.ts`: register new email/webhook routes
- `api/src/routes/digests.ts`: extend with approve/send endpoints (or new route file)
- `web/src/components/app-sidebar.tsx`: add dashboard link
- Resend SDK: new integration client in api/src/integrations/

</code_context>

<specifics>
## Specific Ideas

- Domain is mail.aisanomat.fi (already noted in STATE.md blockers — SPF/DKIM/DMARC DNS records needed)
- Resend free tier: 100 emails/day — sufficient for early clients
- Newsletter should feel authoritative and industry-specific — the content quality is the selling point

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-email-delivery-send-workflow*
*Context gathered: 2026-03-02*
