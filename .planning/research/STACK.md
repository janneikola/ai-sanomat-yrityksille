# Stack Research: v1.2 Newsletter Quality & Design

**Domain:** Enterprise AI-curated newsletter platform — quality and design improvements
**Researched:** 2026-03-04
**Confidence:** HIGH (existing stack verified via codebase, new additions verified via npm/official docs)

## Scope

This covers ONLY the new capabilities needed for v1.2. The existing validated stack is NOT re-researched:

- Fastify 5.7, Next.js 16, PostgreSQL 16, Drizzle ORM 0.45
- Claude Sonnet 4.5 via `@anthropic-ai/sdk` ^0.78.0
- `@google/genai` ^1.43.0 with `gemini-2.5-flash-image` model
- Resend 6.9, React Email 1.0.8, `@react-email/components` 1.0.8
- node-cron 4.2, Zod 3.25, Svix 1.86, OpenAI 6.25.0

The four new capabilities needed:
1. OG image extraction from source URLs
2. AI-generated infographic/chart images as fallback (using existing Gemini)
3. Structured HTML content in emails (lists, bold, subheadings)
4. Logo integration in email header

---

## Recommended New Dependencies

### 1. OG Image Extraction: `open-graph-scraper`

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `open-graph-scraper` | ^6.11.0 | Extract `og:image` URLs from news article source pages | Only actively maintained, battle-tested OG scraper. Full TypeScript support, ESM-native (matches project `"type": "module"`), uses native Fetch API (no extra HTTP client), returns typed `ogImage[]` array with URL/dimensions. 81 dependent packages, last published 2 months ago (current). |

**Why `open-graph-scraper` over alternatives:**

| Option | Version | Why Not |
|--------|---------|---------|
| `open-graph-scraper` | 6.11.0 | RECOMMENDED |
| `@devmehq/open-graph-extractor` | — | Under-documented, less community trust |
| `open-graph` (npm) | — | Unmaintained (last publish 2020) |
| `metascraper` | — | Plugin architecture is overkill; 15+ plugins to install for basic OG extraction |
| Rolling your own with `node-fetch` + HTML parsing | — | Would need cheerio for parsing, adding another dep; og-scraper is purpose-built |

**ESM compatibility (verified):** `open-graph-scraper` ships both CJS and ESM builds. The package.json `exports` field provides `/dist/esm/` for ESM consumers. Project is `"type": "module"` — confirmed compatible.

**Key API for this use case:**

```typescript
// api/src/integrations/ogExtractor.ts
import ogs from 'open-graph-scraper';

export async function extractOgImage(url: string): Promise<string | null> {
  try {
    const { result, error } = await ogs({
      url,
      fetchOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AI-Sanomat/1.0; +https://aisanomat.fi)',
        },
        signal: AbortSignal.timeout(5000), // 5s timeout via native AbortSignal
      },
    });
    if (error || !result.ogImage?.length) return null;
    return result.ogImage[0].url ?? null;
  } catch {
    return null; // Always fall through to Gemini fallback
  }
}
```

**Result shape for `ogImage`:**
```typescript
// ogImage is: Array<{ url?: string; width?: string; height?: string; type?: string }>
// Always check [0].url — may be empty even when array exists
```

**Production notes:**
- Some sites block scrapers regardless of user-agent (Cloudflare-protected sites, paywalls). Always treat OG extraction as best-effort with a silent fallback.
- Use `AbortSignal.timeout()` (Node 18+ native) instead of the `timeout` option — avoids an open issue in older versions.
- OG image URLs can be relative paths on some sites. `open-graph-scraper` resolves them to absolute URLs automatically.
- Do NOT attempt OG extraction in parallel for all stories simultaneously — adds latency proportional to slowest site. Sequential with 5s timeout each is safe for newsletter generation (offline process, no user waiting).

**Confidence:** HIGH — package is on npm, ESM-compatible, TypeScript-typed, actively maintained.

---

## Features Requiring NO New Dependencies

### 2. Infographic/Chart Fallback: Existing Gemini Client

**Zero new libraries.** The existing `geminiClient.ts` using `@google/genai` ^1.43.0 with `gemini-2.5-flash-image` already handles this. The only change is the **prompt strategy** passed to `generateImage()`.

**Current usage (in imageService.ts):** Generates a generic "hero image" for the whole digest plus one "section image" per story — both abstract/illustrative.

**v1.2 change:** When OG extraction fails for a story, generate an infographic-style image using a more specific prompt that references concrete data points from the story content.

Gemini 2.5 Flash Image capabilities relevant here (MEDIUM confidence, from official docs + release notes):
- Text rendering in images: legible text for infographics, diagrams, marketing assets
- Data visualization: can generate chart-like visuals and structured diagrams from text descriptions
- Format: returns inline `base64` PNG data, which existing code already writes to `/uploads/images/`

**Prompt pattern for infographic fallback:**

```typescript
// In newsletterService.ts — modified generateDigestImages() logic
async function getStoryImage(story: DigestStory, i: number): Promise<string> {
  // 1. Try OG extraction first
  const ogImage = await extractOgImage(story.sourceUrl);
  if (ogImage) return ogImage;

  // 2. Generate infographic via Gemini
  const infographicPrompt = `
    Create a clean, professional infographic-style image for a Finnish business newsletter.
    Topic: ${story.title}
    Key point: ${story.businessImpact.slice(0, 200)}
    Style: minimal, corporate, teal (#0D9488) and white color palette.
    Include a clear headline and 2-3 data points as icons or simple chart elements.
    No photorealistic people. Text must be in Finnish.
    Aspect ratio: 16:9, width 800px.
  `;
  const result = await generateImage(infographicPrompt, 800, 450);
  return result ?? PLACEHOLDER_IMAGE_URL;
}
```

**Why not a chart library (Chart.js, D3, Recharts)?** Generating a PNG from Chart.js would require a headless browser (Puppeteer) or canvas library (node-canvas), both of which add significant Railway complexity. Gemini handles this in a single API call with zero infra overhead. For newsletter-quality infographics (not interactive, no live data), Gemini output is sufficient.

**Confidence:** HIGH for Gemini being able to generate infographic-style images. MEDIUM for text legibility in generated images (AI image models sometimes garble text at smaller sizes — test with actual story content before shipping).

---

### 3. Structured HTML Content: Existing React Email Components

**Zero new libraries.** All required components are in `@react-email/components` ^1.0.8, already installed.

**What's needed vs what exists:**

| Requirement | React Email Component | Email Client Support |
|------------|----------------------|---------------------|
| Story subheadings | `<Heading as="h3">` | Full: Gmail, Apple Mail, Outlook (verified via caniemail.com) |
| Bold emphasis | `<Text style={{ fontWeight: 'bold' }}>` or `<strong>` via `<Html>` | Full across all major clients |
| Bullet lists | `<ul><li>` via React standard JSX, styled with inline margin | Partial: Gmail/Outlook support `<ul>` and `<ol>` with quirks (caniemail.com data) |
| Lead paragraph | `<Text>` with larger font-size | Full: inline style, always works |
| Highlighted callout | `<Section>` with background-color inline style | Full: table-based email rendering handles background |

**The real change is in data model and Claude output, not the template library.**

Currently `DigestStory.businessImpact` is a single text string. To render structured content, Claude must output structure — and then `DigestEmail.tsx` must render it.

**Required changes:**

1. **Extend `DigestStory` type** (in `api/src/types/digest.ts`):

```typescript
export interface StorySection {
  type: 'paragraph' | 'bullet_list' | 'callout';
  text?: string;        // for paragraph and callout
  items?: string[];     // for bullet_list
}

export interface DigestStory {
  title: string;
  subheading?: string;          // NEW: optional subheading below title
  sections: StorySection[];     // NEW: replaces businessImpact string
  businessImpact: string;       // KEEP for backward compat with existing issues
  sourceUrl: string;
  imageUrl?: string;
}
```

2. **Update `digestJsonSchema`** with new fields so Claude structured output enforces the shape.

3. **Render in `DigestEmail.tsx`** using existing components:

```tsx
// Subheading
{story.subheading && (
  <Text className="text-[14px] font-semibold text-[#0D9488] m-0 mb-[8px] uppercase tracking-wide">
    {story.subheading}
  </Text>
)}

// Structured sections
{story.sections.map((section, j) => {
  if (section.type === 'paragraph') {
    return <Text key={j} className="text-[16px] leading-relaxed text-[#333333] m-0 mb-[8px] email-text">{section.text}</Text>;
  }
  if (section.type === 'bullet_list') {
    return (
      <ul key={j} style={{ paddingLeft: '20px', margin: '0 0 8px', color: '#333333' }}>
        {section.items?.map((item, k) => (
          <li key={k} style={{ fontSize: '15px', lineHeight: '1.6', marginBottom: '4px' }}>{item}</li>
        ))}
      </ul>
    );
  }
  if (section.type === 'callout') {
    return (
      <Section key={j} style={{ backgroundColor: '#F0FDFA', borderLeft: '3px solid #0D9488', padding: '12px 16px', margin: '8px 0' }}>
        <Text className="text-[15px] text-[#0D9488] m-0 font-medium">{section.text}</Text>
      </Section>
    );
  }
  return null;
})}
```

**Email client list rendering note:** Outlook 2016+ and Gmail both support `<ul>/<li>` but Outlook can strip or ignore `list-style-type`. Use `style={{ listStyleType: 'disc' }}` on `<ul>` and ensure `paddingLeft` is set via inline styles (not Tailwind classes) for Outlook compatibility. This is the safe pattern — no need for image-based bullets.

**Confidence:** HIGH for components being available. HIGH for email client support when using inline styles. MEDIUM for Outlook list rendering specifics (Outlook 2019+ is fine; Outlook 2016 has quirks — test with Litmus or email clients locally).

---

### 4. Logo in Email Header: Hosted PNG via Existing @fastify/static

**Zero new libraries.** The logo PNG is already served as a static asset via `@fastify/static` (already installed and configured). The `DigestEmail.tsx` uses `<Img>` from `@react-email/components`, which renders as a standard `<img>` tag.

**Implementation:**

```tsx
// In DigestEmail.tsx — replace text-only header with logo image
<Section className="pt-[32px] pb-[16px] px-[24px] text-center">
  <Img
    src="https://aisanomat.fi/images/logo.png"
    alt="AI-Sanomat"
    width="160"
    height="40"
    style={{ display: 'block', margin: '0 auto 8px' }}
  />
  <Text className="text-[13px] text-[#666666] m-0 email-muted">
    {clientName} | {clientIndustry}
  </Text>
</Section>
```

**Format: PNG, not SVG.**
SVG is not supported in Outlook (any version) and has inconsistent support in Gmail. PNG with transparency is the universal email logo format. Source the logo as a transparent-background PNG at 2x resolution (320x80px file displayed at 160x40px) for retina displays.

**Hosting options (in priority order):**

| Option | Pros | Cons | Recommended? |
|--------|------|------|-------------|
| `https://aisanomat.fi/images/logo.png` | Zero infra cost, permanent URL | Depends on aisanomat.fi uptime for logo loads | YES — simplest |
| Railway API static (`/images/logo.png` via `@fastify/static`) | Already configured | Railway URL changes per deployment slot | NO — URL instability |
| Dedicated CDN (Cloudflare R2, S3) | Reliable, fast | Added infra complexity | Only if aisanomat.fi is unreliable |

**Use `https://aisanomat.fi/images/logo.png` as the absolute URL.** Email clients cache images aggressively; using the production domain URL is the most reliable approach. If the logo changes, update the file at the same URL.

**Alt text is required.** When images are blocked (Outlook default for external senders), `alt="AI-Sanomat"` ensures brand recognition is maintained. Keep `alt` to brand name only, not a description.

**Confidence:** HIGH — PNG via hosted absolute URL is the industry-standard approach for email logos.

---

## Complete Installation

### New Production Dependencies

```bash
# From the project root (monorepo workspace)
npm install -w api open-graph-scraper@^6.11.0
```

That is the only new dependency for the entire v1.2 milestone.

### No New Environment Variables

All needed APIs (Gemini, Claude, Resend) are already configured.

### No Database Schema Changes

OG image URLs are stored in the existing `story.imageUrl` field (already in `DigestContent` stored as JSON in `issues.generatedContent`). No migration needed.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Puppeteer / Playwright | Headless browser to screenshot pages for images; Railway memory overhead, complex lifecycle | `open-graph-scraper` for OG images + Gemini for fallback |
| `sharp` (image processing) | Would need to resize/convert OG images; adds native binary dep that complicates Railway builds | Pass OG image URLs directly to `<Img>` — email clients do their own fetching |
| Chart.js / D3 / Recharts | Server-side chart PNG generation requires node-canvas (native C++ dep) or Puppeteer | Gemini generates infographic-style images with a single API call |
| `mjml` | Alternative email template system; would require migrating entire DigestEmail.tsx | React Email already does the job |
| `sanitize-html` / DOMPurify | Only needed if accepting user HTML input; Claude output is structured JSON, not raw HTML | Use Claude structured output schema — no unsanitized HTML enters the template |
| `jsdom` | DOM parsing in Node.js for OG scraping; `open-graph-scraper` handles this internally | `open-graph-scraper` |
| Multiple OG extraction libraries | Redundancy for a best-effort feature | Single library with try/catch fallback to Gemini is sufficient |
| External image proxy service | Would be needed if resizing OG images; unnecessary | Use OG URLs directly |
| SVG for logo | Not supported in Outlook | PNG with transparent background |

---

## Integration Map

### New Files to Create

| File | Purpose | Dependencies |
|------|---------|-------------|
| `api/src/integrations/ogExtractor.ts` | Extract OG image URL from a news article URL | `open-graph-scraper` |

### Existing Files to Modify

| File | Change | Why |
|------|--------|-----|
| `api/src/types/digest.ts` | Add `subheading?`, `sections: StorySection[]` to `DigestStory`; update `digestJsonSchema` | Enable structured Claude output |
| `api/src/services/imageService.ts` | Add OG extraction step before Gemini fallback per story | Use source images where available |
| `api/src/services/newsletterService.ts` | Update `generateDigestImages()` to use OG-first logic; update prompt templates to request structured `sections[]` | Wire up new image strategy |
| `api/src/emails/DigestEmail.tsx` | Render `sections[]` instead of `businessImpact` string; add `<Img>` for logo header; render subheadings | Email structure improvements |

### Files That Stay Unchanged

| File | Why |
|------|-----|
| `api/src/integrations/geminiClient.ts` | Image generation API unchanged; only prompt content changes |
| `api/src/integrations/claudeClient.ts` | API call structure unchanged; prompt content and JSON schema change |
| `api/src/integrations/resendClient.ts` | Email sending unchanged |
| `api/src/db/schema.ts` | No schema changes needed |
| All source collection integrations | Unrelated to quality improvements |

---

## Version Compatibility Checklist

| Package | Version | Node.js Req | ESM | TypeScript | Notes |
|---------|---------|-------------|-----|------------|-------|
| `open-graph-scraper` | ^6.11.0 | 18+ | YES | YES (built-in types) | Matches project `"type": "module"`, native Fetch API |
| `@react-email/components` | ^1.0.8 | — | YES | YES | Already installed; `Heading`, `Text`, `Section`, `Img` all available |
| `@google/genai` | ^1.43.0 | — | YES | YES | Already installed; no version change needed for infographic prompts |

---

## Sources

- [open-graph-scraper npm](https://www.npmjs.com/package/open-graph-scraper) — v6.11.0 confirmed, HIGH confidence
- [openGraphScraper GitHub](https://github.com/jshemas/openGraphScraper) — ESM build confirmed, HIGH confidence
- [React Email Heading component](https://react.email/docs/components/heading) — `as` prop for h1-h6, HIGH confidence
- [Can I email: `<ul>`, `<ol>`, `<dl>`](https://www.caniemail.com/features/html-lists/) — partial Outlook/Gmail support, HIGH confidence
- [Can I email: list-style](https://www.caniemail.com/features/css-list-style/) — inline style fallback required for Outlook, HIGH confidence
- [SVG in email: caniemail.com](https://www.caniemail.com/features/image-svg/) — NOT supported in Outlook, HIGH confidence
- [A Guide for SVG Support in Email (CSS-Tricks)](https://css-tricks.com/a-guide-on-svg-support-in-email/) — confirms PNG-only for email logos, HIGH confidence
- [Gemini image generation docs](https://ai.google.dev/gemini-api/docs/image-generation) — infographic and text rendering support confirmed, HIGH confidence
- [Nano Banana 2 announcement (Google)](https://blog.google/innovation-and-ai/technology/ai/nano-banana-2/) — infographic capability confirmed, MEDIUM confidence
- [Resend embed inline images](https://resend.com/docs/dashboard/emails/embed-inline-images) — CDN-hosted PNG is recommended approach, HIGH confidence
- [Email image best practices (Omnisend)](https://www.omnisend.com/blog/email-images/) — absolute URL for hosted logos, MEDIUM confidence
- [Email image blocking (Litmus)](https://www.litmus.com/blog/the-ultimate-guide-to-email-image-blocking) — alt text required for blocked-image fallback, HIGH confidence

---

*Stack research for: AI-Sanomat Yrityksille v1.2 Newsletter Quality & Design*
*Researched: 2026-03-04*
