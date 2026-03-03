# Phase 6: Premium Email Experience - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the newsletter email template with premium AI-Sanomat branding and client co-branding, add an "AI-Sanomat suosittelee" section featuring recent aisanomat.fi blog posts, implement dark mode support, and build a one-click reader feedback system (thumbs up/down). The existing `DigestEmail.tsx` React Email template is replaced with the new premium design.

</domain>

<decisions>
## Implementation Decisions

### Newsletter visual direction
- Clean minimal style: generous whitespace, restrained color use, modern feel
- Styled text "AI-Sanomat" header (not image logo) with teal accent color bar below
- Client co-branding: client name + industry as subtitle below the AI-Sanomat header (e.g., "Acme Corp | Rakennus & Kiinteisto")
- Accent color: Teal (#0D9488) for brand bar, links, and UI accents

### Story layout
- Image above, text below per story (current layout improved with better spacing/typography)
- Subtle divider lines between story sections
- "Lue lisaa" links as teal text links (not buttons)

### Footer
- Full branded footer: AI-Sanomat tagline, links to aisanomat.fi, social links, company info, unsubscribe link

### Featured section ("AI-Sanomat suosittelee")
- Compact card block positioned after digest content, before footer
- Show 3 latest aisanomat.fi blog posts (graceful fallback if fewer exist)
- Each card shows: post title (as link) + short description (Beehiiv subtitle)
- Source: reuse existing Beehiiv source — query news_items for the aisanomat.fi source at render time, no new collector needed

### Dark mode
- Claude's Discretion — user skipped this area
- Requirements say: support prefers-color-scheme media query (DESIGN-04)

### Feedback system
- Thumbs up/down only (two options, no neutral) — maximum simplicity
- Placed after closing text, before footer: "Oliko tama katsaus hyodyllinen?"
- JWT-signed vote links: each link contains memberId + issueId + vote, no login required
- After clicking: redirect to aisanomat.fi homepage (drives traffic + confirms vote)

### Claude's Discretion
- Dark mode implementation depth and color palette
- Featured section header visual treatment (teal accent vs simple text divider)
- Typography choices (font family, sizes, line heights)
- Exact spacing and padding values
- Loading skeleton / error state handling
- Admin satisfaction dashboard layout (per-digest scores, low-satisfaction flagging per FEED-03/FEED-04)

</decisions>

<specifics>
## Specific Ideas

- Clean minimal style inspired by Linear/Notion newsletters
- Teal (#0D9488) is the AI-Sanomat brand color from PRD
- Featured section reuses existing beehiivClient.ts data — no new collection pipeline

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DigestEmail.tsx` (api/src/emails/): Current React Email template — will be replaced/redesigned in this phase
- `MagicLinkEmail.tsx` (api/src/emails/): Existing email template pattern to follow
- `beehiivClient.ts` (api/src/integrations/): Already fetches aisanomat.fi posts with title, url, subtitle, publishedAt
- `emailService.ts` (api/src/services/): Renders DigestEmail and sends via Resend — will need to pass featured posts and feedback URLs

### Established Patterns
- React Email with `@react-email/components` for email templates
- Inline CSS styles as React.CSSProperties objects (email client compatibility)
- `render()` from `@react-email/render` for HTML and plaintext generation
- Drizzle ORM for database schema and queries
- JWT tokens for auth (existing in portalAuth.ts) — reuse pattern for feedback vote tokens

### Integration Points
- `emailService.ts` `renderDigestEmail()` — needs new props for featured posts and feedback URLs
- `DigestEmailProps` interface — extend with featuredPosts and feedbackUrls
- DB schema — new `feedbackVotes` table needed (memberId, issueId, vote, votedAt)
- New API endpoint needed: GET /api/feedback/vote?token=... (processes JWT, records vote, redirects)
- Resend webhook processing — no changes needed (feedback is separate from delivery tracking)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-premium-email-experience*
*Context gathered: 2026-03-03*
