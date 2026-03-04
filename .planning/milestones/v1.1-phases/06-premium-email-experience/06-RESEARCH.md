# Phase 6: Premium Email Experience - Research

**Researched:** 2026-03-03
**Domain:** Email template design (React Email), dark mode CSS, JWT-based feedback, Drizzle schema
**Confidence:** HIGH

## Summary

Phase 6 redesigns the `DigestEmail.tsx` React Email template with premium AI-Sanomat branding (teal accent, client co-branding), adds an "AI-Sanomat suosittelee" featured section sourced from existing Beehiiv-collected `news_items`, implements CSS dark mode via `prefers-color-scheme`, and builds a stateless one-click feedback system (thumbs up/down) with JWT-signed vote links.

The existing codebase already has all foundational pieces: React Email + `@react-email/components` for templates, `@fastify/jwt` for token signing, Drizzle ORM for schema, `beehiivClient.ts` for aisanomat.fi post fetching, and a Next.js admin dashboard with shadcn/ui. The primary work is: (1) redesign the email template with Tailwind CSS via the `<Tailwind>` component, (2) add dark mode styles, (3) query `news_items` for aisanomat.fi posts at render time, (4) create a `feedbackVotes` DB table + public vote endpoint, and (5) add satisfaction scores to the admin dashboard.

**Primary recommendation:** Use React Email's `<Tailwind>` component with `pixelBasedPreset` for all styling (replacing current inline `React.CSSProperties`), inject dark mode via `<Head>` style tag with `@media (prefers-color-scheme: dark)`, and implement feedback as JWT-signed GET links that redirect to aisanomat.fi after recording the vote.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Clean minimal style: generous whitespace, restrained color use, modern feel
- Styled text "AI-Sanomat" header (not image logo) with teal accent color bar below
- Client co-branding: client name + industry as subtitle below the AI-Sanomat header (e.g., "Acme Corp | Rakennus & Kiinteisto")
- Accent color: Teal (#0D9488) for brand bar, links, and UI accents
- Image above, text below per story (current layout improved with better spacing/typography)
- Subtle divider lines between story sections
- "Lue lisaa" links as teal text links (not buttons)
- Full branded footer: AI-Sanomat tagline, links to aisanomat.fi, social links, company info, unsubscribe link
- Compact card block positioned after digest content, before footer for featured section
- Show 3 latest aisanomat.fi blog posts (graceful fallback if fewer exist)
- Each card shows: post title (as link) + short description (Beehiiv subtitle)
- Source: reuse existing Beehiiv source -- query news_items for the aisanomat.fi source at render time, no new collector needed
- Thumbs up/down only (two options, no neutral) -- maximum simplicity
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

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DESIGN-01 | Newsletter uses premium clean layout with generous whitespace and modern typography | Tailwind CSS via `<Tailwind>` component with `pixelBasedPreset`; system font stack; generous padding values |
| DESIGN-02 | Newsletter includes AI-Sanomat brand header with logo and accent color bar | Styled text header + teal (#0D9488) `<Hr>` or `<Section>` bar; no image logo needed |
| DESIGN-03 | Newsletter includes client company name and industry in header area | `clientName` and `industry` props passed to template; displayed as subtitle text |
| DESIGN-04 | Newsletter supports dark mode via prefers-color-scheme media query | `<Head>` style tag with `color-scheme: light dark` meta + `@media (prefers-color-scheme: dark)` overrides |
| DESIGN-05 | Newsletter includes "AI-Sanomat suosittelee" featured section with recent aisanomat.fi posts | Query `news_items` table filtered by aisanomat.fi Beehiiv source at render time; pass as `featuredPosts` prop |
| DESIGN-06 | Newsletter footer includes AI-Sanomat links, company info, and consistent branding | Footer section with tagline, aisanomat.fi link, social links, company info, unsubscribe link |
| SRC-05 | System checks aisanomat.fi for new blog posts and makes them available for the featured section | Already implemented via `beehiivClient.ts` + news collector; posts stored in `news_items` with `sourceId` referencing the Beehiiv source |
| FEED-01 | Newsletter includes thumbs up/down feedback links at the bottom | Two links in email body with thumb emoji + text; JWT-signed URLs pointing to vote endpoint |
| FEED-02 | Feedback is recorded per member per digest with one-click (no login required) | JWT token encodes `memberId`, `issueId`, `vote`; GET endpoint verifies and records; no auth cookie needed |
| FEED-03 | Admin dashboard shows per-digest and per-client satisfaction scores | New dashboard API endpoint aggregating `feedbackVotes` by issue and client; displayed in existing dashboard page |
| FEED-04 | Low satisfaction digests are flagged for prompt template review | Compute satisfaction ratio; flag issues where thumbs-down exceeds threshold (e.g., >50% negative) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@react-email/components` | ^1.0.8 | Email template components (Html, Head, Body, Container, Section, Text, Link, Img, Hr, Preview, Tailwind) | Already in use; official React Email component library |
| `@react-email/render` | ^2.0.4 | Renders React Email to HTML string and plaintext | Already in use for email rendering |
| `@fastify/jwt` | ^9.0.3 | JWT signing for feedback vote tokens | Already registered; reuse `app.jwt.sign()` pattern from `portalAuth.ts` |
| `drizzle-orm` | ^0.45.0 | Database schema and queries for new `feedbackVotes` table | Already in use across all services |
| `zod` | ^3.25.0 | Request/response validation for feedback API route | Already in use via `fastify-type-provider-zod` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pixelBasedPreset` (from `@react-email/components`) | same | Converts Tailwind rem units to px for email clients | Required when using `<Tailwind>` component -- email clients do not support rem |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `<Tailwind>` component | Inline `React.CSSProperties` (current approach) | Tailwind is now the recommended React Email approach; enables dark mode via `dark:` prefix; existing code uses inline styles but Tailwind is cleaner and supports media queries |
| JWT-signed vote links | Hashed HMAC links | JWT is already in the stack; HMAC would require a separate utility; JWT carries payload and expiry natively |

**Installation:**
No new packages needed. All dependencies are already in `api/package.json`.

## Architecture Patterns

### Recommended Project Structure
```
api/src/
├── emails/
│   └── DigestEmail.tsx          # Redesigned premium template (replace existing)
├── db/
│   └── schema.ts                # Add feedbackVotes table
├── routes/
│   └── feedback.ts              # New public route: GET /api/feedback/vote?token=...
│   └── dashboard.ts             # Extend with satisfaction stats endpoint
├── services/
│   └── emailService.ts          # Extend renderDigestEmail() to accept featuredPosts + feedbackUrls
│   └── feedbackService.ts       # New: recordVote(), getSatisfactionStats()
web/src/app/(admin)/
└── page.tsx                     # Extend dashboard with satisfaction card/table
```

### Pattern 1: React Email Tailwind Template
**What:** Use `<Tailwind>` wrapper with `pixelBasedPreset` for all email styling
**When to use:** All email template components
**Example:**
```tsx
// Source: Context7 /resend/react-email SKILL.md
import {
  Html, Head, Preview, Body, Container, Section, Text,
  Link, Img, Hr, Tailwind, pixelBasedPreset,
} from '@react-email/components';

export function DigestEmail({ clientName, clientIndustry, digest, featuredPosts, feedbackUrls, unsubscribeUrl }: DigestEmailProps) {
  return (
    <Html lang="fi">
      <Tailwind config={{ presets: [pixelBasedPreset], theme: { extend: { colors: { brand: '#0D9488' } } } }}>
        <Head>
          <meta content="light dark" name="color-scheme" />
          <meta content="light dark" name="supported-color-schemes" />
          <style>{`
            :root { color-scheme: light dark; }
            @media (prefers-color-scheme: dark) {
              .email-body { background-color: #1a1a1a !important; }
              .email-container { background-color: #262626 !important; }
              .email-text { color: #e5e5e5 !important; }
              .email-heading { color: #f5f5f5 !important; }
              .email-footer { color: #a3a3a3 !important; }
            }
          `}</style>
        </Head>
        <Preview>{digest.intro.slice(0, 100)}</Preview>
        <Body className="bg-gray-100 font-sans">
          <Container className="max-w-xl mx-auto bg-white">
            {/* ... template content ... */}
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
```

### Pattern 2: JWT-Signed Feedback Vote Links
**What:** Generate stateless vote links that encode member, issue, and vote direction
**When to use:** Generating per-member email content
**Example:**
```typescript
// Reuses existing app.jwt.sign() from portalAuth.ts pattern
function generateFeedbackUrl(
  app: FastifyInstance,
  memberId: number,
  issueId: number,
  vote: 'up' | 'down'
): string {
  const token = app.jwt.sign(
    { memberId, issueId, vote, purpose: 'feedback' },
    { expiresIn: '90d' } // Long-lived: readers may open emails weeks later
  );
  const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
  return `${baseUrl}/api/feedback/vote?token=${token}`;
}
```

### Pattern 3: Public Feedback Endpoint (No Auth)
**What:** GET endpoint that verifies JWT token, records vote, redirects to aisanomat.fi
**When to use:** Processing email feedback clicks
**Example:**
```typescript
// Registered WITHOUT fastify.authenticate -- this is a public endpoint
fastify.route({
  method: 'GET',
  url: '/feedback/vote',
  schema: { querystring: z.object({ token: z.string() }) },
  handler: async (request, reply) => {
    const { token } = request.query as { token: string };
    const decoded = fastify.jwt.verify<{
      memberId: number; issueId: number; vote: string; purpose: string;
    }>(token);
    if (decoded.purpose !== 'feedback') throw new Error('Invalid token');
    await recordVote(decoded.memberId, decoded.issueId, decoded.vote);
    return reply.redirect('https://aisanomat.fi');
  },
});
```

### Pattern 4: Featured Posts Query at Render Time
**What:** Query `news_items` filtered by the aisanomat.fi Beehiiv source at email render time
**When to use:** Building the "AI-Sanomat suosittelee" section data
**Example:**
```typescript
// In emailService.ts, before rendering
const featuredPosts = await db
  .select({
    title: newsItems.title,
    url: newsItems.url,
    summary: newsItems.summary,
  })
  .from(newsItems)
  .innerJoin(newsSources, eq(newsItems.sourceId, newsSources.id))
  .where(
    and(
      eq(newsSources.type, 'beehiiv'),
      eq(newsSources.isActive, true)
    )
  )
  .orderBy(desc(newsItems.publishedAt))
  .limit(3);
```

### Anti-Patterns to Avoid
- **Using rem units in email CSS:** Email clients do not support rem -- always use `pixelBasedPreset` or explicit px values
- **Relying on dark: prefix alone for dark mode:** Only Apple Mail fully supports Tailwind dark: classes; must also include `@media (prefers-color-scheme: dark)` in `<style>` tag with class-based selectors and `!important`
- **Making feedback endpoint require authentication:** Vote links must work without login -- the JWT IS the authentication
- **Creating a new Beehiiv collector for featured posts:** The posts are already collected daily via `newsCollectorService.ts` and stored in `news_items` -- just query the table
- **Pure white (#FFFFFF) or pure black (#000000) in dark mode:** These trigger aggressive color inversion in some email clients; use off-whites (#F7F7F7) and near-blacks (#1a1a1a, #262626) instead

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email-safe CSS | Custom inline style system | `<Tailwind>` from `@react-email/components` with `pixelBasedPreset` | Handles rem-to-px conversion, CSS variable resolution, media query extraction to `<head>`, RGB normalization |
| JWT tokens | Custom token signing | `app.jwt.sign()` from `@fastify/jwt` | Already registered, handles secret management, expiry, verification |
| Dark mode email CSS | Custom dark mode detection | `@media (prefers-color-scheme: dark)` in `<Head>` `<style>` | Standard CSS approach; ~42% email client support is the ceiling regardless of approach |
| Email rendering | Custom HTML builder | `render()` from `@react-email/render` | Handles HTML + plaintext generation, component tree serialization |
| Satisfaction scoring | Complex scoring algorithm | Simple ratio: thumbsUp / totalVotes * 100 | Two-option feedback (no neutral) means simple ratio is sufficient; threshold flagging (e.g., <50%) is clear |

**Key insight:** Every building block is already in the project's dependency tree. This phase adds no new packages -- it composes existing tools in new ways.

## Common Pitfalls

### Pitfall 1: Dark Mode Color Inversion in Gmail/Outlook
**What goes wrong:** Gmail strips `@media (prefers-color-scheme)` entirely. Outlook applies its own dark mode transformations that override inline styles.
**Why it happens:** Gmail transforms the media query selector into `@media ( _filtered_a )`, making it ineffective. Outlook uses `[data-ogsc]` and `[data-ogsb]` selectors for its own dark mode.
**How to avoid:** Design the light mode template with colors that degrade gracefully when inverted. Avoid pure white backgrounds (use #F7F7F7), avoid pure black text (use #1a1a1a). The `prefers-color-scheme` media query will work in Apple Mail, iOS Mail, and Outlook.com -- which covers the premium audience well.
**Warning signs:** White text on white background, invisible logos, unreadable content in Gmail dark mode testing.

### Pitfall 2: Feedback Vote Token Expiry Too Short
**What goes wrong:** Readers receive email newsletters but may not open them for days or weeks. If the JWT token expires in hours, the feedback link is dead.
**Why it happens:** Copying the 15-minute expiry from magic link tokens.
**How to avoid:** Use 90-day expiry for feedback tokens. The security risk is minimal (the worst case is someone votes on behalf of a member, which has negligible impact).
**Warning signs:** Spike in "invalid token" errors in feedback endpoint logs.

### Pitfall 3: Duplicate Vote Recording
**What goes wrong:** Reader clicks thumbs-up, then clicks again (or email client prefetches both links). Multiple votes recorded, skewing satisfaction data.
**Why it happens:** No deduplication at the database level.
**How to avoid:** Use a UNIQUE constraint on `(memberId, issueId)` in the `feedbackVotes` table. Use `ON CONFLICT DO UPDATE` to allow changing vote (reader clicks up, then changes to down).
**Warning signs:** Vote count exceeding delivered email count for an issue.

### Pitfall 4: Featured Posts Section Shows Stale Content
**What goes wrong:** The aisanomat.fi Beehiiv source fails to collect for weeks; featured section shows month-old posts.
**Why it happens:** Source health degradation without checking freshness at render time.
**How to avoid:** Order by `publishedAt DESC` and optionally add a freshness filter (e.g., posts from last 30 days). If no posts match, gracefully omit the section.
**Warning signs:** Featured posts with very old `publishedAt` dates.

### Pitfall 5: Missing `clientIndustry` in Email Props
**What goes wrong:** The new template needs `clientIndustry` for the co-branding header, but `renderDigestEmail()` only receives `{ name: string }` for client.
**Why it happens:** Current `emailService.ts` selects only `client.name`.
**How to avoid:** Extend the client query in `sendDigestToClient()` to include `industry` field, and pass it through to the email template.
**Warning signs:** Empty or undefined industry text in the email header.

## Code Examples

### Drizzle Schema: feedbackVotes Table
```typescript
// Source: Existing schema.ts patterns
export const voteEnum = pgEnum('vote_type', ['up', 'down']);

export const feedbackVotes = pgTable('feedback_votes', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id').notNull().references(() => members.id),
  issueId: integer('issue_id').notNull().references(() => issues.id),
  vote: voteEnum('vote').notNull(),
  votedAt: timestamp('voted_at').notNull().defaultNow(),
}, (table) => ({
  uniqueMemberIssue: unique().on(table.memberId, table.issueId),
}));
```

### Email Template: Featured Section
```tsx
// "AI-Sanomat suosittelee" section
{featuredPosts.length > 0 && (
  <Section className="px-5 pt-6 pb-2">
    <Text className="text-sm font-bold text-brand uppercase tracking-wide m-0 mb-4">
      AI-Sanomat suosittelee
    </Text>
    {featuredPosts.map((post, i) => (
      <Section key={i} className="mb-4">
        <Link href={post.url} className="text-base font-semibold text-gray-900 no-underline">
          {post.title}
        </Link>
        {post.summary && (
          <Text className="text-sm text-gray-600 m-0 mt-1">
            {post.summary}
          </Text>
        )}
      </Section>
    ))}
  </Section>
)}
```

### Email Template: Feedback Section
```tsx
// Feedback thumbs up/down
<Section className="px-5 py-6 text-center">
  <Text className="text-base text-gray-700 m-0 mb-3">
    Oliko tama katsaus hyodyllinen?
  </Text>
  <Link href={feedbackUrls.up} className="text-2xl no-underline mx-4">
    &#128077;
  </Link>
  <Link href={feedbackUrls.down} className="text-2xl no-underline mx-4">
    &#128078;
  </Link>
</Section>
```

### Satisfaction Stats Query
```typescript
// Per-issue satisfaction scores for admin dashboard
const stats = await db
  .select({
    issueId: feedbackVotes.issueId,
    totalVotes: sql<number>`count(*)::int`,
    thumbsUp: sql<number>`count(case when ${feedbackVotes.vote} = 'up' then 1 end)::int`,
    thumbsDown: sql<number>`count(case when ${feedbackVotes.vote} = 'down' then 1 end)::int`,
  })
  .from(feedbackVotes)
  .groupBy(feedbackVotes.issueId);
// satisfaction = (thumbsUp / totalVotes) * 100
// flag if satisfaction < 50
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline `React.CSSProperties` | `<Tailwind>` component with utility classes | React Email 2.x (2024) | Cleaner code, dark mode support via media queries, automatic rem-to-px conversion |
| No dark mode in emails | `prefers-color-scheme` media query | Gradual 2023-2025 | ~42% email client support (Apple Mail, iOS, Outlook.com, ProtonMail) |
| `<Head>` outside `<Tailwind>` | `<Head>` INSIDE `<Tailwind>` | React Email Tailwind update | Required for styles to be correctly processed; old placement causes styles to be dropped |

**Deprecated/outdated:**
- Inline `React.CSSProperties` for complex layouts: Still works but `<Tailwind>` is now the recommended approach in React Email docs and skills
- `rem` units in email CSS: Never worked in email clients; `pixelBasedPreset` was added specifically to prevent this

## Open Questions

1. **Emoji rendering in feedback links across email clients**
   - What we know: HTML entities `&#128077;` and `&#128078;` render thumbs up/down in most modern email clients
   - What's unclear: Whether some corporate Outlook clients strip or replace emoji
   - Recommendation: Use HTML entities (not Unicode emoji) for maximum compatibility; optionally add text fallback ("Kylla" / "Ei") next to emoji

2. **Email link prefetching triggering false votes**
   - What we know: Some email security scanners (Barracuda, Mimecast) prefetch/click links in emails to check for malware
   - What's unclear: How common this is among the Finnish enterprise audience
   - Recommendation: Make the vote endpoint idempotent (UPSERT). If prefetch is a real problem in production, could add a confirmation redirect page (but this conflicts with the "one-click" requirement, so start simple)

3. **React Email Tailwind `dark:` prefix support in email clients**
   - What we know: The `<Tailwind>` component extracts media queries to `<style>` in `<head>`. The `dark:` prefix generates `@media (prefers-color-scheme: dark)` rules.
   - What's unclear: Whether React Email's `dark:` variant properly generates the right selectors for all email clients
   - Recommendation: Use explicit `@media (prefers-color-scheme: dark)` CSS in the `<Head>` `<style>` tag with class selectors and `!important` as the primary dark mode method. Test with `dark:` prefix as enhancement.

## Sources

### Primary (HIGH confidence)
- Context7 `/resend/react-email` - Tailwind component usage, dark mode patterns, `pixelBasedPreset`, Head component placement
- Context7 `/fastify/fastify-jwt` - `jwt.sign()` and `jwt.verify()` API for stateless token generation
- Existing codebase: `DigestEmail.tsx`, `emailService.ts`, `portalAuth.ts`, `beehiivClient.ts`, `schema.ts`, `dashboard.ts`

### Secondary (MEDIUM confidence)
- [Can I Email: @media (prefers-color-scheme)](https://www.caniemail.com/features/css-at-media-prefers-color-scheme/) - ~42% email client support; Apple Mail, iOS Mail, Outlook.com full support; Gmail strips it
- [React Email GitHub Discussion #591](https://github.com/resend/react-email/discussions/591) - Dark mode implementation approaches with `<Head>` style tag and color-scheme meta tags
- [Litmus Dark Mode Guide](https://www.litmus.com/blog/the-ultimate-guide-to-dark-mode-for-email-marketers) - Best practices: avoid pure white/black, use off-colors, defensive coding for Gmail

### Tertiary (LOW confidence)
- Email link prefetching behavior by security scanners - anecdotal reports; actual impact depends on recipient email infrastructure

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies; patterns verified via Context7
- Architecture: HIGH - Follows existing patterns (JWT signing from portalAuth, Drizzle schema from schema.ts, route patterns from dashboard.ts, email template from DigestEmail.tsx)
- Pitfalls: MEDIUM - Dark mode email client support is well-documented but Gmail behavior is frustrating and largely unavoidable; emoji rendering edge cases need production testing
- Dark mode: MEDIUM - Implementation approach is sound but email client support is inherently fragmented (~42%); design must degrade gracefully

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable -- React Email and Fastify JWT APIs are mature)
