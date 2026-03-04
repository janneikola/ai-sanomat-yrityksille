# Phase 10: Foundation & Branding - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

DB schema extension (ogImageUrl column on newsItems, DigestStory type gains lead + contentBlocks), TypeScript types update, and real logo in email header. Existing newsletters render without errors. No content restructuring (Phase 12), no OG fetching (Phase 11), no infographic generation (Phase 13).

</domain>

<decisions>
## Implementation Decisions

### Logo hosting
- Logo PNG uploaded to Railway static files — same infrastructure as Gemini-generated images (served via /api/images/)
- Logo URL stored as environment variable or hardcoded path in the email template

### Email header layout
- Logo image placed ABOVE the existing "AI-Sanomat" text heading
- Current text header ("AI-Sanomat" 30px bold + client name/industry subtitle) stays below the logo
- User provides existing logo file with transparent background

### Dark mode handling
- Transparent PNG logo gets a white island/container background behind it
- Prevents logo from disappearing on dark email backgrounds
- Uses inline styles for maximum email client compatibility

### Content blocks structure
- `contentBlocks` on DigestStory uses an array of typed blocks: `[{type: 'lead', text: '...'}, {type: 'bullets', items: [...]}]`
- Flexible and extensible for future block types

### Claude's Discretion
- Migration strategy: nullable new fields vs backfill (recommend nullable for backward compat)
- Whether `lead` is a separate top-level field on DigestStory or the first block in contentBlocks array
- `ogImageUrl` column constraints (recommend plain text nullable, matching existing column patterns)
- Logo image dimensions and padding in email header
- White island sizing and border-radius for dark mode

</decisions>

<specifics>
## Specific Ideas

- User has an existing AI-Sanomat logo file (icon + wordmark, transparent background)
- Logo should be a hosted PNG URL — no base64, no SVG (Outlook compatibility)
- White island approach for dark mode (not baked-in white background on the PNG itself)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DigestEmail.tsx`: Current email template with text header, dark mode CSS, Tailwind config — header section at lines 91-98 is the replacement target
- `emailService.ts`: `toImageUrl()` helper converts relative paths to absolute URLs via `/api/images/` — reuse for logo URL
- `api/src/db/schema.ts`: Drizzle ORM schema with existing patterns (text columns, nullable fields)
- `api/src/types/digest.ts`: DigestStory interface and digestJsonSchema — both need extension

### Established Patterns
- Images served via Railway at `{PUBLIC_URL}/api/images/{filename}.png`
- Dark mode handled via CSS `@media (prefers-color-scheme: dark)` block in DigestEmail.tsx
- Database columns use `text()` type for URLs (see `heroImageUrl` on issues table)
- JSON schemas use `additionalProperties: false` and all fields in `required` array

### Integration Points
- `api/src/db/schema.ts` — add ogImageUrl column to newsItems table
- `api/src/types/digest.ts` — extend DigestStory interface and digestJsonSchema
- `api/src/emails/DigestEmail.tsx` — update header section with logo image
- `api/src/services/emailService.ts` — may need to handle logo URL (or hardcode in template)
- New SQL migration file in `api/src/db/migrations/`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-foundation-branding*
*Context gathered: 2026-03-04*
