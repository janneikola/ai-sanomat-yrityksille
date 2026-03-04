# Phase 12: Structured Article Content - Research

**Researched:** 2026-03-04
**Domain:** AI-generated structured content (lead + bullets), email HTML rendering with Outlook/Gmail compatibility, backward-compatible JSON schema evolution, email size monitoring
**Confidence:** HIGH

## Summary

Phase 12 transforms newsletter stories from single `businessImpact` text blocks into structured content with a lead sentence, 2-4 bullet points, and rich formatting (subheadings, bold text, visual hierarchy). The infrastructure is already in place from Phase 10: `DigestStory` has optional `lead` and `contentBlocks` fields, the `digestJsonSchema` includes them as optional properties, and the `ContentBlock` union type (`LeadBlock | BulletsBlock`) is defined. What remains is three concrete work streams:

1. **AI prompt update** -- Modify the `viikkokatsaus_generointi` prompt template (stored in DB) to instruct Claude to populate `lead` and `contentBlocks` fields in its structured output. The JSON schema already accepts these fields; Claude just needs prompting to use them.

2. **Email template update** -- Update `DigestEmail.tsx` to render structured content when `lead`/`contentBlocks` are present, falling back to `businessImpact` for old digests. Use `<ul>`/`<li>` for bullet points with MSO conditional CSS for Outlook compatibility. Use `Heading` component for subheadings.

3. **Email size monitoring** -- Add `Buffer.byteLength()` logging in `emailService.ts` before every send, with a warning when HTML exceeds 80KB (Gmail clips at 102KB).

The backward compatibility requirement (CONTENT-04) is satisfied by keeping `businessImpact` as the required field in the JSON schema and rendering it as fallback when `contentBlocks` is undefined.

**Primary recommendation:** Update the DB prompt template to instruct Claude to always populate `lead` and `contentBlocks`. Update `DigestEmail.tsx` to render structured content with fallback. Add byte-length logging in `renderDigestEmail()`. Use semantic `<ul>`/`<li>` for bullets with MSO conditional CSS for Outlook, not table-based bullet lists.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONTENT-01 | Uutisartikkeli sisaltaa lead-lauseen joka tiivistaa uutisen ydinviestin | Claude prompt must instruct `lead` field population; DigestEmail.tsx renders lead as bold/italic opening text above content blocks |
| CONTENT-02 | Uutisartikkeli sisaltaa 2-4 bullet-pointtia avainpointeista | Claude prompt must instruct `contentBlocks` with `type: 'bullets'` and 2-4 items; DigestEmail.tsx renders `<ul>` with MSO conditional CSS for Outlook |
| CONTENT-03 | Uutisartikkeli kayttaa alaotsikointia, boldausta ja korostuksia luettavuuden parantamiseksi | DigestEmail.tsx uses `Heading as="h3"` for story titles, bold Text for lead, styled bullet lists with visual hierarchy; Outlook-safe inline styles |
| CONTENT-04 | Vanhat digestit (ilman uutta rakennetta) renderoityvat edelleen oikein | `lead` and `contentBlocks` remain optional in JSON schema and TypeScript type; DigestEmail.tsx falls back to rendering `businessImpact` when `contentBlocks` is undefined |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @react-email/components | 1.0.8 | Email template components (Heading, Section, Text, Img) | Already in use; provides Heading component for subheadings |
| @anthropic-ai/sdk | 0.78.x | Claude structured output generation with JSON schema | Already in use; `output_config.format.json_schema` already includes `lead`/`contentBlocks` |
| @react-email/render | 2.0.4 | HTML rendering for byte-length measurement | Already in use; `render()` returns HTML string for `Buffer.byteLength()` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-orm | 0.45.x | Read/update prompt templates from DB | For updating `viikkokatsaus_generointi` template text |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Semantic `<ul>`/`<li>` for bullets | Table-based bullet rendering | Tables break screen reader accessibility; Litmus explicitly discourages table-based bullets |
| MSO conditional CSS | Inline padding workarounds | MSO conditionals are the standard approach for Outlook-specific fixes |
| `Buffer.byteLength(html, 'utf-8')` | `html.length` | `Buffer.byteLength` gives actual byte count (important for multi-byte UTF-8 chars in Finnish text) |

**Installation:**
No new packages needed. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
```
api/src/
├── emails/
│   └── DigestEmail.tsx       # Update: render lead/contentBlocks with fallback to businessImpact
├── types/
│   └── digest.ts             # Already has ContentBlock types (Phase 10)
├── services/
│   └── emailService.ts       # Update: add byte-length logging before send
├── db/
│   └── seed.ts               # Update: prompt template with structured content instructions
└── integrations/
    └── claudeClient.ts       # No changes needed (schema already supports optional fields)
packages/shared/src/schemas/
    └── digest.ts             # Update: add lead/contentBlocks to Zod schema for web compatibility
```

### Pattern 1: Conditional Content Rendering (Backward Compat)
**What:** Render structured content when `lead`/`contentBlocks` exist, fall back to `businessImpact` for old digests.
**When to use:** Any time the data shape evolved but old data must still render.
**Example:**
```tsx
// api/src/emails/DigestEmail.tsx -- per-story rendering
{story.lead || story.contentBlocks ? (
  <>
    {/* Structured content: lead + blocks */}
    {story.lead && (
      <Text style={{ fontSize: '16px', fontWeight: 'bold', fontStyle: 'italic', color: '#333333' }}>
        {story.lead}
      </Text>
    )}
    {story.contentBlocks?.map((block, j) => {
      if (block.type === 'bullets') {
        return (
          <ul key={j} style={{ paddingLeft: '20px', margin: '8px 0' }}>
            {block.items.map((item, k) => (
              <li key={k} style={{ fontSize: '15px', color: '#333333', marginBottom: '4px' }}>
                {item}
              </li>
            ))}
          </ul>
        );
      }
      // Lead blocks in contentBlocks array (if duplicated there)
      if (block.type === 'lead') {
        return (
          <Text key={j} style={{ fontSize: '16px', fontWeight: 'bold', color: '#333333' }}>
            {block.text}
          </Text>
        );
      }
      return null;
    })}
  </>
) : (
  /* Fallback: old-style businessImpact string */
  <Text style={{ fontSize: '16px', color: '#333333' }}>
    {story.businessImpact}
  </Text>
)}
```

### Pattern 2: MSO Conditional CSS for Outlook Bullet Points
**What:** Add Outlook-specific CSS in `<!--[if mso]>` conditional comments to fix bullet point rendering.
**When to use:** Any HTML email with `<ul>`/`<li>` elements that must render in Outlook desktop.
**Example:**
```tsx
// In <Head> section of DigestEmail.tsx
<style>{`
  /* ...existing dark mode styles... */

  /* Outlook bullet point fix */
  /*<!--[if (gte mso 9)|(IE)]>*/
  li {
    margin-left: 27px !important;
    mso-special-format: bullet;
  }
  .outlook-bullet-fix {
    margin-left: -25px !important;
  }
  /*<![endif]-->*/
`}</style>
```

**Important note on MSO conditionals in React Email:** React Email's `<Head>` component renders standard `<style>` tags. MSO conditional comments (`<!--[if mso]>`) must be placed as raw HTML, which may require using `dangerouslySetInnerHTML` or a `<Raw>` approach. The simpler alternative is to use inline styles on the `<ul>` and `<li>` elements directly, which works across clients including Outlook. The `mso-special-format: bullet` CSS property can also be added as an inline style.

### Pattern 3: Email Size Logging
**What:** Log the byte length of rendered HTML before sending, warn if over 80KB threshold.
**When to use:** Every email send to catch size regressions early.
**Example:**
```typescript
// api/src/services/emailService.ts -- in renderDigestEmail()
const html = await render(DigestEmail(emailProps));

const htmlBytes = Buffer.byteLength(html, 'utf-8');
console.log(`[email] HTML size: ${htmlBytes} bytes (${(htmlBytes / 1024).toFixed(1)} KB)`);
if (htmlBytes > 80 * 1024) {
  console.warn(`[email] WARNING: HTML exceeds 80KB (${(htmlBytes / 1024).toFixed(1)} KB) — Gmail may clip this email at 102KB`);
}
```

### Anti-Patterns to Avoid
- **Table-based bullet lists:** Screen readers announce table rows/columns instead of list items. Litmus explicitly discourages this approach. Use semantic `<ul>`/`<li>` with MSO fixes instead.
- **CSS flexbox or grid for layout:** Outlook desktop strips both. Use `Row`/`Column` components from React Email for multi-column layouts (already used in the project).
- **Adding `lead`/`contentBlocks` to `required` array in JSON schema:** This would break Claude's structured output for old prompts and cause validation errors on historical digest data.
- **Rendering `contentBlocks` without fallback:** Old digests in the DB have `businessImpact` only, no `contentBlocks`. The template MUST handle both shapes.
- **Using `html.length` instead of `Buffer.byteLength`:** Finnish text has characters like a, o, a which are multi-byte in UTF-8. `html.length` gives character count, not byte count. Gmail's 102KB limit is byte-based.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email-safe bullet rendering | Custom table-based bullets | Semantic `<ul>`/`<li>` + MSO conditional CSS | Accessibility, Litmus-recommended, simpler code |
| Subheadings in email | Raw `<h3>` tags | React Email `Heading` component with `as="h3"` | Handles cross-client rendering, proper attribute encoding |
| HTML byte measurement | Character-counting length check | `Buffer.byteLength(html, 'utf-8')` | Accurate for UTF-8 multi-byte characters |
| Prompt template updates | Hardcoded prompts in source | DB-stored `viikkokatsaus_generointi` template via seed.ts | Prompt is editable from admin UI at `/templates` |

**Key insight:** The data types and JSON schema are already in place from Phase 10. This phase is purely about (1) prompting Claude to use the new fields, (2) rendering them in the email template, and (3) adding size monitoring. No schema migrations or type changes needed.

## Common Pitfalls

### Pitfall 1: Claude Not Populating Optional Fields
**What goes wrong:** The JSON schema has `lead` and `contentBlocks` as optional (not in `required`), so Claude may skip them entirely, producing the same output as before.
**Why it happens:** Claude's structured output only guarantees required fields. Optional fields may be omitted unless the prompt explicitly requests them.
**How to avoid:** The system prompt (stored in DB template `viikkokatsaus_generointi`) must explicitly instruct: "Every story MUST include a `lead` field with a single sentence and a `contentBlocks` array with a bullets block containing 2-4 items." The JSON schema keeps them optional for backward compat, but the prompt ensures new outputs include them.
**Warning signs:** New digests render with the old `businessImpact` fallback instead of structured content.

### Pitfall 2: Outlook Rendering Breaks with Unsupported CSS
**What goes wrong:** Bullet points show with giant spacing, wrong indentation, or tiny dots in Outlook desktop.
**Why it happens:** Outlook desktop uses Word 2007 rendering engine, which handles `<ul>` margins and padding differently.
**How to avoid:** Use inline styles on `<ul>` (e.g., `margin: 0; padding-left: 20px;`) and `<li>` elements. The `mso-special-format: bullet` inline style forces Outlook to render proper bullet points. Wrap list in a `<div>` to eliminate extra Outlook margins.
**Warning signs:** Bullet points look fine in Gmail/Apple Mail but broken in Outlook desktop.

### Pitfall 3: Email Size Blow-Up from Structured Content
**What goes wrong:** Adding lead + bullets + subheadings significantly increases HTML size, pushing emails past Gmail's 102KB clip threshold.
**Why it happens:** Each story now has more DOM elements (lead text, ul, li items, heading). Combined with Tailwind CSS classes and dark mode styles, bytes add up quickly.
**How to avoid:** (1) Log byte length before every send (the 80KB warning). (2) Keep bullet items concise (prompt Claude: "each bullet point under 15 words"). (3) Limit stories to 3-5 per digest (already the case). (4) Consider minifying HTML if approaching limit (React Email's render() already produces reasonably compact output).
**Warning signs:** `[email] WARNING: HTML exceeds 80KB` in server logs.

### Pitfall 4: Shared Zod Schema Out of Sync
**What goes wrong:** The web frontend (portal archive or admin digest preview) rejects digest JSON because `packages/shared/src/schemas/digest.ts` doesn't include `lead`/`contentBlocks` in the Zod schema.
**Why it happens:** Phase 10 updated the TypeScript types in `api/src/types/digest.ts` but did NOT update the shared Zod schema. New digest JSON with `lead`/`contentBlocks` would pass `additionalProperties: false` check but may be stripped by Zod's strict parsing if the schema doesn't include them.
**How to avoid:** Update `packages/shared/src/schemas/digest.ts` to add optional `lead` and `contentBlocks` fields to `digestStorySchema`. These must be `.optional()` for backward compatibility.
**Warning signs:** Zod validation errors when fetching digests through the admin API (digest routes parse JSON through shared schema).

### Pitfall 5: businessImpact Becomes Redundant
**What goes wrong:** Claude populates both `businessImpact` (required) and `lead`/`contentBlocks` (optional) with overlapping content, making emails repetitive.
**Why it happens:** The prompt tells Claude to fill in `businessImpact` (it's required in the JSON schema) AND the new structured fields.
**How to avoid:** The prompt should instruct Claude to make `businessImpact` a brief summary (1-2 sentences) that serves as the plain-text fallback, while `lead` is the prominent lead sentence and `contentBlocks` provides the detailed bullet points. The email template should render EITHER structured content OR `businessImpact`, never both.
**Warning signs:** Stories show the same information twice in emails.

## Code Examples

Verified patterns from existing codebase and official documentation:

### DigestEmail.tsx -- Structured Story Rendering
```tsx
// Source: api/src/emails/DigestEmail.tsx -- replace story content section (lines 167-172)
import { Heading } from '@react-email/components';

// Per story in the map:
<Heading as="h3" className="text-[20px] font-bold text-[#111111] m-0 mb-[8px] email-heading">
  {story.title}
</Heading>

{story.lead ? (
  <>
    {/* Lead sentence -- bold/emphasized opening */}
    <Text className="text-[16px] leading-relaxed font-semibold text-[#222222] m-0 mb-[8px] email-text">
      {story.lead}
    </Text>

    {/* Content blocks */}
    {story.contentBlocks?.map((block, j) => {
      if (block.type === 'bullets') {
        return (
          <div key={j} className="outlook-bullet-fix">
            <ul style={{ paddingLeft: '20px', margin: '8px 0 12px 0', listStyleType: 'disc' }}>
              {block.items.map((item, k) => (
                <li key={k} style={{
                  fontSize: '15px',
                  lineHeight: '1.5',
                  color: '#333333',
                  marginBottom: '4px',
                  // @ts-expect-error -- MSO-specific CSS property
                  msoSpecialFormat: 'bullet',
                }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        );
      }
      return null;
    })}
  </>
) : (
  /* Backward-compatible fallback for old digests */
  <Text className="text-[16px] leading-relaxed text-[#333333] m-0 mb-[8px] email-text">
    {story.businessImpact}
  </Text>
)}
```

### Email Size Logging
```typescript
// Source: api/src/services/emailService.ts -- after render() call
const html = await render(DigestEmail(emailProps));

const htmlBytes = Buffer.byteLength(html, 'utf-8');
console.log(`[email] HTML size: ${htmlBytes} bytes (${(htmlBytes / 1024).toFixed(1)} KB)`);
if (htmlBytes > 80 * 1024) {
  console.warn(
    `[email] WARNING: Email HTML ${(htmlBytes / 1024).toFixed(1)} KB exceeds 80KB threshold — Gmail clips at 102KB`
  );
}
```

### Updated Prompt Template (DB seed)
```typescript
// Source: api/src/db/seed.ts -- viikkokatsaus_generointi template
// The prompt must explicitly instruct Claude to populate the new fields.
// Note: The prompt template is editable from the admin UI at /templates.

`Olet tekoalyuutisten asiantuntija, joka kirjoittaa ammattimaisia viikkokatsauksia suomalaisille yrityksille.

Toimiala: {{industry}}
Yrityksen nimi: {{company_name}}
Viikon uutisartikkelit:
{{news_items}}

Aiemmat katsaukset (kontekstia varten):
{{previous_issues}}

Kirjoita lyhyt, asiantunteva viikkokatsaus tekoalyn kehityksesta {{industry}}-alalla. Katsauksen tulee:
- Olla 300-400 sanaa
- Sisaltaa 3-5 tarkeinta uutista tai kehitysta
- Selittaa liiketoimintavaikutukset selkeasti
- Kayttaa ammattimaista mutta ymmارrettavaa kielta
- Olla kirjoitettu suomeksi

JOKAISEN UUTISEN RAKENNE:
- title: Uutisen otsikko
- businessImpact: Lyhyt 1-2 lauseen tiivistelma liiketoimintavaikutuksesta (kaytettava varakuvauksena)
- sourceUrl: Lahdeartikkelin URL (kayta alkuperaista URL:ia uutislistalta)
- lead: Yksi lause joka tiivistaa uutisen ydinviestin -- kirjoita napakasti ja informatiivisesti
- contentBlocks: Taulukko rakenteellisista sisaltolohkoista:
  - Kayta aina tyyppia "bullets" ja listaa 2-4 avainpointtia "items"-taulukkoon
  - Jokainen bullet-pointti on lyhyt (max 15 sanaa) ja konkreettinen
  - Bullet-pointit kertovat "mita tama tarkoittaa yritykselle" ja "mita tapahtui"

ESIMERKKI yhdesta storysta:
{
  "title": "OpenAI julkaisi GPT-5:n",
  "businessImpact": "GPT-5 tuo merkittavia parannuksia yritysten tekoalysovelluksiin.",
  "sourceUrl": "https://openai.com/blog/gpt-5",
  "lead": "OpenAI julkaisi GPT-5-mallin, joka parantaa paattelykykya 40% edeltajaansa nahden.",
  "contentBlocks": [
    {
      "type": "bullets",
      "items": [
        "Paattelykyky parantunut 40% GPT-4o:hon verrattuna",
        "Tukee natiivisti suomen kielta ilman kaannosta",
        "Yrityshinta laskee 30% tehokkaamman laskennan ansiosta",
        "Saatavilla API:n kautta valittomasti"
      ]
    }
  ]
}`
```

### Shared Zod Schema Update
```typescript
// Source: packages/shared/src/schemas/digest.ts
// Must add lead and contentBlocks as optional fields for web frontend compatibility

const contentBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('lead'), text: z.string() }),
  z.object({ type: z.literal('bullets'), items: z.array(z.string()) }),
]);

export const digestStorySchema = z.object({
  title: z.string(),
  businessImpact: z.string(),
  sourceUrl: z.string(),
  imageUrl: z.string().optional(),
  lead: z.string().optional(),
  contentBlocks: z.array(contentBlockSchema).optional(),
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Table-based bullet lists in email | Semantic `<ul>`/`<li>` + MSO conditional CSS | 2024+ best practice | Better accessibility, less HTML bloat |
| Single `businessImpact` text block | Structured lead + content blocks | Phase 10 types, Phase 12 implementation | Richer newsletter stories with visual hierarchy |
| No email size monitoring | `Buffer.byteLength()` logging before send | Phase 12 | Early warning before Gmail 102KB clip limit |
| MSO conditional comments in `<head>` | Inline `mso-*` CSS properties | Outlook 2025-2026 dual-engine period | Works in both Word-engine and Chromium-engine Outlook |

**Deprecated/outdated:**
- Table-based bullet list rendering: Litmus explicitly discourages this for accessibility reasons
- Outlook desktop Word engine: Microsoft ends support Oct 2026, but must support through 2026

## Open Questions

1. **MSO conditional CSS in React Email `<Head>`**
   - What we know: React Email's `<Head>` renders standard `<style>` tags. MSO conditional comments (`<!--[if mso]>`) are HTML comments that must appear in the HTML output.
   - What's unclear: Whether React Email handles MSO conditional comments gracefully inside `<style>` blocks, or if they need to be injected as raw HTML.
   - Recommendation: Start with inline styles on `<ul>` and `<li>` elements (works everywhere including Outlook). If Outlook rendering is still broken, add MSO conditional CSS. The simplest approach -- inline `style={{ paddingLeft: '20px', margin: '0' }}` on `<ul>` and `style={{ marginBottom: '4px' }}` on `<li>` -- is likely sufficient. Test with Litmus/Email on Acid if available (noted as pending todo in STATE.md).

2. **Prompt template update mechanism**
   - What we know: The prompt template `viikkokatsaus_generointi` is stored in the DB `promptTemplates` table, seeded via `seed.ts`, and editable via the admin UI at `/templates`.
   - What's unclear: Whether updating `seed.ts` affects an already-seeded database (it uses `onConflictDoNothing`).
   - Recommendation: Update `seed.ts` for new deployments AND provide a migration script or SQL statement to update the existing template in production. Alternatively, update the template manually via the admin UI. The plan should specify the exact new template text.

3. **contentBlocks array flexibility**
   - What we know: Phase 10 defined `ContentBlock = LeadBlock | BulletsBlock`. The current schema allows both types in the `contentBlocks` array.
   - What's unclear: Whether to also allow `lead` blocks inside `contentBlocks` array or only use the top-level `lead` field for the lead sentence.
   - Recommendation: Use top-level `lead` for the lead sentence. `contentBlocks` should contain only `bullets` type blocks for Phase 12. The `lead` type in `contentBlocks` exists for future extensibility but should not be used now. The prompt should instruct Claude to populate `lead` as a top-level field and `contentBlocks` with only `bullets` blocks.

## Sources

### Primary (HIGH confidence)
- `api/src/types/digest.ts` -- ContentBlock types, DigestStory with optional lead/contentBlocks, digestJsonSchema (verified in codebase)
- `api/src/emails/DigestEmail.tsx` -- Current email template structure, story rendering at lines 150-186 (verified in codebase)
- `api/src/services/emailService.ts` -- renderDigestEmail function, toImageUrl helper (verified in codebase)
- `api/src/db/seed.ts` -- viikkokatsaus_generointi prompt template text (verified in codebase)
- `api/src/integrations/claudeClient.ts` -- Claude structured output with output_config.format.json_schema (verified in codebase)
- `packages/shared/src/schemas/digest.ts` -- Shared Zod schema missing lead/contentBlocks (verified gap)
- [React Email Heading component](https://context7.com/resend/react-email) -- `Heading as="h1|h2|h3"` with Tailwind classes (Context7 verified)
- [React Email Section/Row/Column](https://context7.com/resend/react-email) -- Table-based layout components for Outlook compatibility (Context7 verified)
- [Anthropic SDK structured outputs](https://context7.com/anthropics/anthropic-sdk-typescript) -- `output_config.format.json_schema` with optional fields (Context7 verified)

### Secondary (MEDIUM confidence)
- [Litmus Ultimate Guide to Bullet Points in HTML Email](https://www.litmus.com/blog/the-ultimate-guide-to-bulleted-lists-in-html-email) -- Semantic lists preferred over table-based, MSO conditional CSS for Outlook (WebSearch verified with official source)
- [Email on Acid: Gmail Email Clipping](https://www.emailonacid.com/blog/article/email-development/gmail-email-clipping/) -- 102KB byte limit, 80KB recommended threshold (WebSearch verified with official source)
- [DEV Community: Email Client Rendering Differences 2026](https://dev.to/aoifecarrigan/the-complete-guide-to-email-client-rendering-differences-in-2026-243f) -- Dual Outlook engine support through 2026 (WebSearch, cross-referenced)

### Tertiary (LOW confidence)
- None -- all findings verified against codebase patterns and official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies needed
- Architecture: HIGH -- types and JSON schema already exist from Phase 10, rendering is straightforward React Email component update
- Pitfalls: HIGH -- Outlook compatibility concerns well-documented by Litmus; backward compat path clear from existing optional field patterns
- Prompt engineering: MEDIUM -- the exact prompt wording for Claude to reliably populate optional fields may need iteration; structured output with optional fields is well-supported by the SDK

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable domain, no fast-moving dependencies)
