# Phase 10: Foundation & Branding - Research

**Researched:** 2026-03-04
**Domain:** Database schema extension, TypeScript types, email branding (logo in header)
**Confidence:** HIGH

## Summary

Phase 10 has three distinct work streams: (1) adding an `ogImageUrl` column to the `newsItems` database table, (2) extending the `DigestStory` TypeScript interface and JSON schema with `lead` and `contentBlocks` fields, and (3) placing the AI-Sanomat logo PNG in the email header with dark mode protection. All three are additive changes with no breaking modifications to existing functionality.

The project uses `drizzle-kit push` (not file-based migrations), so adding a nullable column is a single schema edit followed by `npm run db:push`. The TypeScript type extensions must keep `businessImpact` as the existing fallback field so old digests render without errors. The logo must be a hosted PNG served via the existing `@fastify/static` infrastructure at `/api/images/logo.png`, referenced as an absolute URL in the email template.

**Primary recommendation:** Add all new fields as optional/nullable to preserve backward compatibility. Place the logo PNG file in the existing image storage directory and use the established `toImageUrl()` pattern in `emailService.ts` to construct the absolute URL.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Logo PNG uploaded to Railway static files -- same infrastructure as Gemini-generated images (served via /api/images/)
- Logo URL stored as environment variable or hardcoded path in the email template
- Logo image placed ABOVE the existing "AI-Sanomat" text heading
- Current text header ("AI-Sanomat" 30px bold + client name/industry subtitle) stays below the logo
- User provides existing logo file with transparent background
- Transparent PNG logo gets a white island/container background behind it
- Prevents logo from disappearing on dark email backgrounds
- Uses inline styles for maximum email client compatibility
- `contentBlocks` on DigestStory uses an array of typed blocks: `[{type: 'lead', text: '...'}, {type: 'bullets', items: [...]}]`
- Flexible and extensible for future block types

### Claude's Discretion
- Migration strategy: nullable new fields vs backfill (recommend nullable for backward compat)
- Whether `lead` is a separate top-level field on DigestStory or the first block in contentBlocks array
- `ogImageUrl` column constraints (recommend plain text nullable, matching existing column patterns)
- Logo image dimensions and padding in email header
- White island sizing and border-radius for dark mode

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BRAND-01 | Uutiskirjeen header sisaltaa AI-Sanomat logo-ikonin ja "AI-Sanomat" tekstin | Logo PNG served via /api/images/, Img component in DigestEmail.tsx header section (lines 91-98), white island for dark mode |
| BRAND-02 | Logo on hosted PNG-kuva (ei base64, ei SVG) sahkopostiyhteensopivuuden vuoksi | @fastify/static serves /api/images/ prefix, logo.png placed in IMAGE_STORAGE_PATH/images/ directory, absolute URL constructed via toImageUrl() |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.x | Database ORM for schema definition | Already in use, `text()` type for nullable URL columns |
| drizzle-kit | 0.31.x | Schema push to PostgreSQL | Project uses `db:push` not file migrations |
| @react-email/components | 1.0.8 | Email template components (Img, Section, Text) | Already in use for DigestEmail.tsx |
| @fastify/static | 9.0.0 | Static file serving for images | Already configured at `/api/images/` prefix |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-email/render | 2.0.4 | HTML rendering of React Email templates | Already used in emailService.ts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hosted PNG via /api/images/ | External CDN (e.g., Cloudflare R2) | Adds infra complexity; /api/images/ already works on Railway |
| Inline style white island | CSS media query swap (light/dark logos) | Media query support patchy in email clients; inline is safest |

**Installation:**
No new packages needed. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
```
api/src/
├── db/
│   └── schema.ts           # Add ogImageUrl to newsItems
├── types/
│   └── digest.ts            # Extend DigestStory + digestJsonSchema
├── emails/
│   └── DigestEmail.tsx       # Add logo Img in header section
├── services/
│   └── emailService.ts       # Logo URL construction (toImageUrl or env var)
└── uploads/images/
    └── logo.png              # Static logo asset (320x80px, transparent)
```

### Pattern 1: Nullable Column Addition (drizzle-kit push)
**What:** Add a new nullable `text()` column to an existing table in schema.ts, then run `drizzle-kit push` to apply.
**When to use:** Adding optional data fields that existing rows don't have.
**Example:**
```typescript
// api/src/db/schema.ts -- newsItems table
// Existing pattern from issues table:
heroImageUrl: text('hero_image_url'),  // nullable text for URLs

// New column follows same pattern:
ogImageUrl: text('og_image_url'),      // nullable text, no constraint
```

### Pattern 2: Backward-Compatible Type Extension
**What:** Add optional fields to TypeScript interface and JSON schema, so old data (without new fields) still validates and renders.
**When to use:** Extending structured output types that have existing data in the database.
**Example:**
```typescript
// api/src/types/digest.ts

// Content block discriminated union
export interface LeadBlock {
  type: 'lead';
  text: string;
}

export interface BulletsBlock {
  type: 'bullets';
  items: string[];
}

export type ContentBlock = LeadBlock | BulletsBlock;

export interface DigestStory {
  title: string;
  businessImpact: string;       // KEEP -- backward compat for old digests
  sourceUrl: string;
  lead?: string;                 // Optional -- new field
  contentBlocks?: ContentBlock[]; // Optional -- new field
}
```

### Pattern 3: Logo Image in Email Header with Dark Mode Protection
**What:** Place a logo `<Img>` inside a container with white background and border-radius, using inline styles only.
**When to use:** Email header branding that must survive dark mode across Gmail, Outlook, Apple Mail.
**Example:**
```tsx
// api/src/emails/DigestEmail.tsx -- header section
<Section className="pt-[32px] pb-[16px] px-[24px] text-center">
  {/* White island container for dark mode protection */}
  <table role="presentation" width="100%" style={{ border: 0, borderCollapse: 'collapse' }}>
    <tr>
      <td align="center" style={{ padding: 0 }}>
        <div style={{
          display: 'inline-block',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          padding: '16px 24px',
        }}>
          <Img
            src={logoUrl}
            alt="AI-Sanomat"
            width="200"
            height="50"
            style={{ display: 'block', maxWidth: '200px', height: 'auto' }}
          />
        </div>
      </td>
    </tr>
  </table>
  <Text className="text-[30px] font-bold text-[#111111] m-0 mt-[12px] email-heading">
    AI-Sanomat
  </Text>
  <Text className="text-[14px] text-[#666666] m-0 mt-[4px] email-muted">
    {clientName} | {clientIndustry}
  </Text>
</Section>
```

### Anti-Patterns to Avoid
- **Base64 inline images:** Inflates HTML toward Gmail's 102KB clip limit. Use hosted URLs only.
- **SVG in emails:** Blocked by Outlook since Oct 2025 (confirmed in STATE.md). Use PNG.
- **CSS-only dark mode logo swap:** `@media (prefers-color-scheme: dark)` support is inconsistent across email clients. The white island approach with inline styles is more reliable.
- **Breaking schema changes:** Never make existing fields required or rename them. Old `generatedContent` JSON stored in issues table must continue to parse correctly.
- **Adding new required fields to digestJsonSchema:** This would break Claude's structured output for in-flight or historical digests. Make new fields optional in the schema too.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image URL construction | Custom URL builder | Existing `toImageUrl()` in emailService.ts | Handles PUBLIC_URL prefix and /api/ path correctly |
| Static file serving | Custom route handler | `@fastify/static` already configured | Already handles /api/images/ prefix, caching, MIME types |
| Schema push to DB | Raw SQL ALTER TABLE | `drizzle-kit push` | Handles diff detection, type mapping, nullable defaults |
| Email component rendering | Raw HTML strings | React Email components (Img, Section, Text) | Cross-client tested, proper HTML entity encoding |

**Key insight:** All infrastructure for hosting and serving images in emails already exists. The logo is just another PNG in the same directory Gemini uses for generated images.

## Common Pitfalls

### Pitfall 1: Breaking Old Digests with Required Fields
**What goes wrong:** Adding `lead` or `contentBlocks` as required fields in `DigestStory` causes TypeScript errors when parsing old `generatedContent` JSON from the issues table that doesn't have these fields.
**Why it happens:** Old digest JSON was serialized before these fields existed.
**How to avoid:** Make ALL new fields optional (`lead?: string`, `contentBlocks?: ContentBlock[]`). Keep `businessImpact` as the fallback field. DigestEmail.tsx must render correctly when `contentBlocks` is undefined.
**Warning signs:** TypeScript compiler errors in emailService.ts, runtime JSON parse failures.

### Pitfall 2: Logo URL Not Absolute
**What goes wrong:** Logo renders in dev but shows broken image in sent emails because the URL is relative (`/api/images/logo.png`) instead of absolute (`https://app.aisanomat.fi/api/images/logo.png`).
**Why it happens:** Email clients resolve image URLs differently from browsers. Relative URLs have no base to resolve against in email.
**How to avoid:** Use `toImageUrl('/images/logo.png')` or construct from `process.env.PUBLIC_URL` to get a fully qualified URL.
**Warning signs:** Logo visible in React Email preview but broken in actual sent emails.

### Pitfall 3: Dark Mode Inverting White Island Background
**What goes wrong:** Some email clients (Outlook dark mode, some Android clients) invert background colors, turning the white island dark and making the logo invisible again.
**Why it happens:** "Partial color inversion" in Outlook targets elements with explicit white backgrounds.
**How to avoid:** Use off-white (#FAFAFA or #F5F5F5) instead of pure #FFFFFF for the island. Alternatively, add a subtle border (`1px solid #E5E5E5`) so the island is visually bounded even if colors shift. Include the white island in the existing `@media (prefers-color-scheme: dark)` block to force-set its background.
**Warning signs:** Logo disappears in Outlook desktop dark mode but works everywhere else.

### Pitfall 4: drizzle-kit push Requires DATABASE_URL
**What goes wrong:** Running `npm run db:push` fails because `DATABASE_URL` environment variable is not set in the local environment.
**Why it happens:** drizzle.config.ts reads `process.env.DATABASE_URL!` which is undefined locally.
**How to avoid:** Ensure `api/.env` has `DATABASE_URL` set before running push. Or run push against the Railway database directly.
**Warning signs:** Connection refused or undefined URL error from drizzle-kit.

### Pitfall 5: Logo File Not in IMAGE_STORAGE_PATH
**What goes wrong:** Logo PNG is placed in `api/src/assets/` or project root but `@fastify/static` serves from `IMAGE_STORAGE_PATH/images/` directory.
**Why it happens:** Confusion about where static files are served from.
**How to avoid:** Place `logo.png` in the same `{IMAGE_STORAGE_PATH}/images/` directory that Gemini-generated images use. On Railway this is configured via the `IMAGE_STORAGE_PATH` env var (defaults to `./uploads`). For deployment, the logo must either be copied into this directory at startup or committed to the repo at the expected path.
**Warning signs:** 404 on `/api/images/logo.png` in production.

## Code Examples

Verified patterns from existing codebase:

### Adding Nullable Column to Schema
```typescript
// Source: api/src/db/schema.ts -- existing pattern from issues table (line 118)
heroImageUrl: text('hero_image_url'),

// New column for newsItems table, same pattern:
ogImageUrl: text('og_image_url'),
```

### Extending DigestStory Interface (Backward Compatible)
```typescript
// Source: api/src/types/digest.ts -- extend without breaking

export interface LeadBlock {
  type: 'lead';
  text: string;
}

export interface BulletsBlock {
  type: 'bullets';
  items: string[];
}

export type ContentBlock = LeadBlock | BulletsBlock;

export interface DigestStory {
  title: string;
  businessImpact: string;        // KEEP for backward compat
  sourceUrl: string;
  lead?: string;                  // NEW optional
  contentBlocks?: ContentBlock[]; // NEW optional
}
```

### Extending digestJsonSchema (Backward Compatible)
```typescript
// Source: api/src/types/digest.ts -- digestJsonSchema
// New fields are NOT in required[] array

export const digestJsonSchema = {
  type: 'object' as const,
  properties: {
    intro: { type: 'string' as const, description: 'Opening paragraph' },
    stories: {
      type: 'array' as const,
      description: 'Between 3 and 5 news stories',
      items: {
        type: 'object' as const,
        properties: {
          title: { type: 'string' as const },
          businessImpact: { type: 'string' as const },
          sourceUrl: { type: 'string' as const },
          lead: { type: 'string' as const, description: 'Lead sentence summarizing the story' },
          contentBlocks: {
            type: 'array' as const,
            description: 'Structured content blocks',
            items: {
              type: 'object' as const,
              properties: {
                type: { type: 'string' as const, enum: ['lead', 'bullets'] },
                text: { type: 'string' as const },
                items: { type: 'array' as const, items: { type: 'string' as const } },
              },
              required: ['type'] as const,
              additionalProperties: false,
            },
          },
        },
        required: ['title', 'businessImpact', 'sourceUrl'] as const,  // NO new required fields
        additionalProperties: false,
      },
    },
    closing: { type: 'string' as const, description: 'Closing paragraph' },
  },
  required: ['intro', 'stories', 'closing'] as const,
  additionalProperties: false,
};
```

**IMPORTANT NOTE on additionalProperties: false:** The existing schema uses `additionalProperties: false` on story items. This means if we add new properties to the schema but old JSON was stored without them, parsing will still work (missing optional properties are fine). However, if the Claude structured output schema includes these new fields, Claude may or may not include them -- they must remain optional in the `required` array. But there is a subtle issue: the JSON schema with `additionalProperties: false` means the schema explicitly lists all allowed properties. Old stored JSON that already passed the old schema (without `lead`/`contentBlocks`) will still be valid under the new schema since those were optional. New Claude outputs will include the new fields. This is safe and backward compatible.

### Logo in Email Header (React Email + White Island)
```tsx
// Source: api/src/emails/DigestEmail.tsx -- replace header section (lines 91-98)

// Logo URL constructed from PUBLIC_URL environment variable
const logoUrl = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/api/images/logo.png`;

{/* BRAND HEADER */}
<Section className="pt-[32px] pb-[16px] px-[24px] text-center">
  {/* White island for dark mode protection */}
  <div style={{
    display: 'inline-block',
    backgroundColor: '#FAFAFA',
    borderRadius: '12px',
    padding: '16px 24px',
  }}>
    <Img
      src={logoUrl}
      alt="AI-Sanomat"
      width="200"
      height="50"
      style={{ display: 'block', maxWidth: '200px', height: 'auto' }}
    />
  </div>
  <Text className="text-[30px] font-bold text-[#111111] m-0 mt-[12px] email-heading">
    AI-Sanomat
  </Text>
  <Text className="text-[14px] text-[#666666] m-0 mt-[4px] email-muted">
    {clientName} | {clientIndustry}
  </Text>
</Section>
```

### toImageUrl Helper (Reuse for Logo)
```typescript
// Source: api/src/services/emailService.ts (lines 28-35)
const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
const toImageUrl = (imgPath: string) => {
  const path = imgPath.startsWith('/') ? imgPath : `/${imgPath}`;
  return `${baseUrl}/api${path}`;
};

// Logo: toImageUrl('/images/logo.png') => 'https://app.aisanomat.fi/api/images/logo.png'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SVG logos in email | PNG only | Outlook blocked SVG Oct 2025 | Must use PNG, no SVG fallback |
| Base64 inline images | Hosted URL images | Always best practice | Gmail clips at 102KB, base64 inflates HTML |
| CSS media query logo swap | White island with inline styles | 2024+ email best practice | Inline styles work in all clients, media queries don't |
| drizzle-kit generate (migrations) | drizzle-kit push (direct) | Project choice | No migration files, schema.ts is source of truth |

**Deprecated/outdated:**
- SVG in emails: Blocked by Outlook, unreliable elsewhere
- `div` with `background-image` for logos: Many email clients strip background-image CSS

## Design Recommendations (Claude's Discretion Items)

### 1. Migration Strategy: Nullable Fields
**Recommendation:** Use nullable fields, no backfill.
**Rationale:** The `ogImageUrl` column on newsItems will be populated by Phase 11 (OG fetch). The `lead` and `contentBlocks` fields on DigestStory will be populated by Phase 12 (content restructuring). Adding them now as nullable placeholders ensures the schema is ready without requiring data backfill. Existing rows simply have NULL/undefined for these fields.

### 2. lead as Separate Field vs First ContentBlock
**Recommendation:** Add `lead` as a separate top-level optional field on DigestStory AND also include it as the first contentBlock when contentBlocks are present.
**Rationale:** Having `lead` as a separate field provides a simple accessor for the most common use case (showing a lead sentence). The contentBlocks array provides the full structured rendering. Phase 12 will populate both. For this phase, just define the type -- no content generation changes.

### 3. ogImageUrl Column Constraints
**Recommendation:** Plain `text()` nullable, no unique constraint, no foreign key.
**Rationale:** Matches the existing `heroImageUrl` pattern on the issues table. Multiple newsItems could theoretically share the same OG image URL (same source article). No constraint needed.

### 4. Logo Image Dimensions
**Recommendation:** Logo image max-width 200px in the email, actual file ~320px wide (2x for retina). Height auto-scaled. White island padding 16px vertical, 24px horizontal.
**Rationale:** Email container is 600px wide. Logo at 200px leaves comfortable margins. The STATE.md todo mentions "320x80px, transparent, under 10KB" -- this is the file size, displayed at half width for retina clarity.

### 5. White Island Styling
**Recommendation:** Background `#FAFAFA` (off-white to avoid aggressive dark mode inversion), border-radius `12px`, padding `16px 24px`. Add the island to the dark mode CSS block to force-maintain its background color.
**Rationale:** Pure white (#FFFFFF) is more aggressively inverted by Outlook dark mode. Off-white resists inversion better. The border-radius gives a modern card-like appearance. Adding explicit dark mode CSS override for the island background ensures it stays light even in aggressive dark mode environments.

## Open Questions

1. **Logo PNG file location for deployment**
   - What we know: Logo must exist at `{IMAGE_STORAGE_PATH}/images/logo.png` on Railway
   - What's unclear: Whether to commit logo.png to the repo and copy it at build time, or upload it manually to Railway volume
   - Recommendation: Commit logo.png to `api/static/logo.png` in the repo and add a startup script that copies it to `IMAGE_STORAGE_PATH/images/` if not already present. This ensures the logo survives Railway redeploys. Alternative: hardcode the logo URL to point to an externally hosted copy on aisanomat.fi.

2. **Logo URL: env var vs hardcoded path**
   - What we know: CONTEXT.md says "stored as environment variable or hardcoded path"
   - Recommendation: Use the `toImageUrl('/images/logo.png')` pattern (hardcoded path, dynamic base URL). The path `/images/logo.png` is predictable and won't change. The base URL already comes from `PUBLIC_URL` env var. No need for a separate `LOGO_URL` env var.

3. **DigestEmail.tsx: logoUrl prop vs computed inside component**
   - What we know: React Email components are rendered server-side, `process.env` is available
   - Recommendation: Pass `logoUrl` as a prop to `DigestEmail` (same as `heroImageUrl`), computed in `emailService.ts` using `toImageUrl`. This keeps the component pure and testable.

## Sources

### Primary (HIGH confidence)
- `api/src/db/schema.ts` -- existing nullable text column patterns (heroImageUrl on issues)
- `api/src/types/digest.ts` -- current DigestStory interface and digestJsonSchema structure
- `api/src/emails/DigestEmail.tsx` -- current header section (lines 91-98), dark mode CSS, Img usage
- `api/src/services/emailService.ts` -- toImageUrl helper, renderDigestEmail function
- `api/src/app.ts` -- @fastify/static configuration for /api/images/ prefix
- `api/src/integrations/geminiClient.ts` -- image storage path and file naming patterns
- `api/drizzle.config.ts` -- drizzle-kit push configuration (no migration files)
- `.planning/STATE.md` -- logo spec: "320x80px, transparent, under 10KB"

### Secondary (MEDIUM confidence)
- [React Email Img component docs](https://react.email/docs/components/image) -- Img component API
- [Audienceful dark mode logo guide](https://www.audienceful.com/help/dark-mode-logo-images-HTML-emails) -- white outline and island techniques
- [Litmus dark mode guide](https://www.litmus.com/blog/the-ultimate-guide-to-dark-mode-for-email-marketers) -- background color on table cells for email clients

### Tertiary (LOW confidence)
- None -- all findings verified against codebase patterns and official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, versions verified from package.json
- Architecture: HIGH -- all patterns derived from existing codebase (schema.ts, emailService.ts, DigestEmail.tsx)
- Pitfalls: HIGH -- backward compatibility risks identified from actual data flow (generatedContent JSON, digestJsonSchema)
- Dark mode: MEDIUM -- white island technique is well-documented but email client behavior varies; testing recommended

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable domain, no fast-moving dependencies)
