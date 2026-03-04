# Feature Research: v1.2 Newsletter Quality & Design

**Domain:** Premium AI-curated enterprise newsletter — email content quality, image handling, branding
**Researched:** 2026-03-04
**Milestone:** v1.2 — Structured article content, relevant images, branded header
**Overall confidence:** HIGH for email HTML patterns (caniemail.com verified, React Email well-documented), MEDIUM for OG image reliability (scraping fragility known, site-specific behavior varies)

## Context

v1.1 is built and running. The email template uses React Email + Tailwind with `pixelBasedPreset`. Each article (`DigestStory`) currently has a single `businessImpact: string` text block rendered as a `<Text>` component. The header is plain text ("AI-Sanomat" in a `<Text>` with bold styling). Images are AI-generated via Gemini for every story.

This research covers the three new feature areas for v1.2:

1. **Structured article content** — subheadings, bullet lists, bold highlights instead of one long paragraph
2. **Relevant images** — OG images fetched from source URLs, AI infographic as fallback
3. **Branded header** — real AI-Sanomat logo (image asset) + logotype text

Dependencies on existing code:

| Existing piece | What v1.2 touches |
|----------------|-------------------|
| `DigestStory` type in `digest.ts` | Must extend with structured content fields |
| `digestJsonSchema` in `digest.ts` | Must add new fields for structured output |
| `DigestEmail.tsx` | Major render changes for structured content and new header |
| `imageService.ts` | New OG image fetch logic added before AI fallback |
| Claude generation prompt (DB template) | Must instruct structured output with subheadings/lists |

---

## Table Stakes

Features that premium B2B newsletters are expected to have. Missing these makes the email feel unpolished relative to what enterprise clients pay for.

### 1. Structured Article Content (Subheadings, Lists, Bold)

| Aspect | Detail |
|--------|--------|
| **Why expected** | Premium B2B newsletters (Morning Brew, The Hustle, TLDR) all use visual hierarchy inside each story. Single-paragraph blobs are a hallmark of basic auto-generated content. Structured content signals care and craft. |
| **Complexity** | MEDIUM |
| **Dependencies** | Claude JSON schema change, `DigestStory` type change, `DigestEmail.tsx` render change |
| **Confidence** | HIGH — React Email components and email HTML list support are well-documented |

**What premium newsletters actually do:**

Studied Morning Brew, The Hustle, TLDR, and HubSpot newsletter patterns. The consistent structure is:

```
[Bold story title]        <- already have this
[Lead sentence]           <- 1-2 sentences, the "so what"
• Key point one           <- 2-3 bullet bullets max
• Key point two
• Key point three
[Business impact]         <- 1 sentence call to action or implication
[Source link →]           <- already have this
```

Headlines are 18-22px bold. Body text is 14-16px. Bullets break up dense AI-generated prose and dramatically improve scannability. Enterprise readers skim — they need to grab the signal in 10 seconds per story.

**How to implement in existing architecture:**

The cleanest approach is to extend the Claude JSON schema output rather than post-process plain text into structure. Claude generates structure at generation time; the email template renders it.

New `DigestStory` shape:

```typescript
export interface DigestStory {
  title: string;
  lead: string;            // NEW: 1-2 sentence hook
  bullets: string[];       // NEW: 2-4 key points
  businessImpact: string;  // EXISTING: repurposed as the "so what" closing sentence
  sourceUrl: string;
}
```

Claude structured output schema additions (in `digestJsonSchema`):

```typescript
lead: { type: 'string', description: 'One or two sentences: what happened and why it matters' }
bullets: {
  type: 'array',
  description: 'Two to four key points. Each point is a short, standalone sentence.',
  items: { type: 'string' },
  minItems: 2,
  maxItems: 4
}
```

Email rendering in `DigestEmail.tsx` — replace the single `<Text>` block with structured components:

```tsx
<Heading as="h2" className="text-[20px] font-bold ...">
  {story.title}
</Heading>
<Text className="text-[16px] ...">
  {story.lead}
</Text>
{story.bullets && story.bullets.length > 0 && (
  <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
    {story.bullets.map((bullet, i) => (
      <li key={i} style={{ marginBottom: '4px', fontSize: '15px', lineHeight: '1.6', color: '#333333' }}>
        {bullet}
      </li>
    ))}
  </ul>
)}
<Text className="text-[15px] italic ...">
  {story.businessImpact}
</Text>
```

**Email client compatibility for `<ul>/<li>`:**

Verified against caniemail.com (March 2026):
- Gmail: PARTIAL (reversed attribute not supported, basic lists work)
- Outlook: PARTIAL (same reversed attribute gap, standard lists render correctly)
- Apple Mail: FULL
- Samsung Email: FULL
- ProtonMail: FULL

Verdict: Basic `<ul>/<li>` renders correctly in all major clients. The gap is only for the `reversed` attribute (which we won't use). Use inline `style` on `<ul>` and `<li>` for consistent cross-client rendering — do not rely on CSS classes for list spacing.

**What NOT to do:**

- Do not use `<Markdown>` component from React Email for this. It works but loses type-safety and makes the Claude output harder to validate. Structured JSON fields are better.
- Do not embed markdown strings in JSON and parse them at render time — same reason.
- Do not add more than 4 bullets — becomes as dense as the original paragraph.
- Do not add subheadings inside each story (h3, h4) — at 3-5 stories per newsletter, that's too much visual noise. Lead + bullets + impact is sufficient.

**Prompt template change needed:**

The Claude generation prompt (stored in DB) must be updated to instruct structure. Key instruction to add:

```
Each story must have:
- title: Uutisen otsikko (max 10 words)
- lead: 1-2 virkkeen kärki — mitä tapahtui ja miksi se merkitsee
- bullets: 2-4 lyhyttä, itsenäistä tietoraepistettä
- businessImpact: 1 virke — konkreettinen vaikutus tai toimintakehotus
- sourceUrl: Lähteen URL
```

### 2. Relevant Images from Source OG Metadata

| Aspect | Detail |
|--------|--------|
| **Why expected** | Real article images (editorial photos, product screenshots, charts) are far more relevant than AI-generated abstract art. The current Gemini-generated images are decorative, not informative. Premium newsletters use article images when they exist. |
| **Complexity** | MEDIUM |
| **Dependencies** | New OG fetch step in `newsletterService.ts` or `imageService.ts`, fallback to existing Gemini flow |
| **Confidence** | MEDIUM — OG fetch is a solved problem but reliability varies per source (paywalls, bot detection, slow sites) |

**How OG image extraction works:**

Every modern news site embeds `<meta property="og:image" content="...">` in HTML `<head>`. This is the same image shown when you paste a link in Slack/Twitter/LinkedIn. It is reliably 1200x630px (or similar 1.91:1 ratio), editorial-quality, and directly relevant to the article.

**Recommended library: `open-graph-scraper` (npm)**

- 6.9M weekly downloads (HIGH adoption signal)
- Uses Fetch API under the hood; passes through standard Fetch options
- Timeout configurable via `fetchOptions.signal` (AbortController)
- Returns structured result: `{ ogTitle, ogDescription, ogImage: [{ url, width, height }] }`
- Has a `open-graph-scraper-lite` variant that takes pre-fetched HTML (avoids double fetch if you already have the page content)

```typescript
import ogs from 'open-graph-scraper';

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s max

    const { result, error } = await ogs({
      url,
      fetchOptions: { signal: controller.signal },
      onlyGetOpenGraphInfo: true, // skip HTML parsing of non-OG content
    });

    clearTimeout(timeout);

    if (error || !result.ogImage?.length) return null;

    const image = result.ogImage[0];
    if (!image.url) return null;

    // Skip SVG — poor email client support (Outlook blocks since Oct 2025)
    if (image.url.endsWith('.svg') || image.type === 'image/svg+xml') return null;

    return image.url;
  } catch {
    return null; // timeout, network error, or blocked
  }
}
```

**Known failure modes and mitigations:**

| Failure mode | Frequency | Mitigation |
|---|---|---|
| Site blocks scraper bots | MEDIUM (paywalled sites: FT, WSJ, Bloomberg) | Return null, fall through to AI fallback |
| Site returns no OG tags | LOW (rare for news sites) | Return null, fall through to AI fallback |
| OG image is an SVG | LOW | Skip SVGs — Outlook blocks them since Oct 2025 |
| OG image is too small (<400px wide) | LOW | Check dimensions if available, fall through if too small |
| Fetch times out | MEDIUM (slow/overloaded sites) | 5 second hard timeout via AbortController |
| OG image URL is relative path | LOW | Convert to absolute using source URL base |

**Fallback chain:**

```
1. Fetch OG image from article sourceUrl
   ↓ (if null or error)
2. Generate AI infographic via Gemini (existing flow, existing imagePrompts)
   ↓ (if Gemini fails)
3. Use PLACEHOLDER_IMAGE_URL (existing fallback)
```

**Where this logic lives:**

Add a new function `fetchArticleOgImage(url: string): Promise<string | null>` in `imageService.ts`. In `newsletterService.ts`, after Claude generates the digest, attempt OG fetch for each story before falling through to Gemini generation. This keeps the OG fetch co-located with image logic and leaves the email rendering untouched — the story's `imageUrl` field is populated the same way regardless of source.

**Image format considerations:**

Prefer JPEG or PNG from OG sources. WebP is increasingly common in OG tags (modern CMS platforms) — email client support for WebP is partial (Gmail supports it, Outlook does not). Consider a future image proxy/conversion step, but for v1.2 accept WebP and let clients with poor WebP support show a broken image rather than adding complexity. Note this in PITFALLS.

**When NOT to fetch OG images:**

- Do not fetch OG images from aisanomat.fi sources — those would be the "AI-Sanomat suosittelee" featured posts, which have their own visual treatment
- Do not fetch if the article is from X/Twitter — tweet embed images are rarely article-relevant
- Do not attempt retry logic — one attempt with a timeout is sufficient; better to fall through to AI than to delay the whole pipeline

### 3. Branded Header with Real Logo

| Aspect | Detail |
|--------|--------|
| **Why expected** | Text "AI-Sanomat" in a `<Text>` component is not a brand mark — it's a label. Premium newsletters have a visual logo: recognizable, consistent, professional. The header is the first thing readers see. |
| **Complexity** | LOW |
| **Dependencies** | Logo asset (PNG file), hosted URL for the image, `DigestEmail.tsx` header section |
| **Confidence** | HIGH — email image hosting and header design patterns are well-established |

**What premium branded headers look like (2026 best practices):**

Studied Mailtrap, Stripo, MailerLite, and BeeFree guidance. Consistent patterns:

1. **Logo placement:** Centered or left-aligned at very top, before any content
2. **Logo format:** PNG with transparent background — safest choice for all email clients
3. **SVG is not viable in 2026:** Microsoft blocked inline SVG in Outlook on the web and Windows starting October 2025. Rollout is now complete. Never use SVG in email.
4. **Header height:** Keep total header area under 200px to leave room for content above the fold
5. **Logo image dimensions:** Provide 2x resolution PNG for Retina displays but constrain display size via `width`/`height` attributes
6. **Simple is better:** Logo + tagline (optional) is enough. No navigation, no banner imagery in the header.

**Recommended implementation:**

The current header section in `DigestEmail.tsx`:

```tsx
{/* BRAND HEADER */}
<Section className="pt-[32px] pb-[16px] px-[24px] text-center">
  <Text className="text-[30px] font-bold text-[#111111] m-0 email-heading">
    AI-Sanomat
  </Text>
  <Text className="text-[14px] text-[#666666] m-0 mt-[4px] email-muted">
    {clientName} | {clientIndustry}
  </Text>
</Section>
```

Replace with:

```tsx
{/* BRAND HEADER */}
<Section className="pt-[32px] pb-[16px] px-[24px] text-center">
  <Img
    src="https://aisanomat.fi/assets/logo/ai-sanomat-logo.png"
    alt="AI-Sanomat"
    width="160"
    height="auto"
    style={{ display: 'block', margin: '0 auto 8px' }}
  />
  <Text className="text-[13px] text-[#666666] m-0 email-muted">
    {clientName} — {clientIndustry}
  </Text>
</Section>
```

**Logo asset requirements:**

- Format: PNG with transparent background
- Minimum dimensions: 320x80px (displayed at 160x40px = 2x Retina)
- Include both wordmark (icon + "AI-Sanomat" text) or icon + separate text is fine
- Must have a version that works on white background (for light mode) and dark/charcoal background (for dark mode)

**Hosting the logo:**

Three viable options:

| Option | Pros | Cons |
|--------|------|------|
| Host on aisanomat.fi (e.g., `/assets/logo/ai-sanomat-logo.png`) | Same domain, easy to update, CDN if site uses one | Depends on aisanomat.fi uptime; if site goes down, logo breaks |
| Host on Railway alongside the API | Controlled, same infra | Railway volumes are not CDN; slower delivery |
| Use Resend's CDN or an object store (e.g., Railway + object storage, or Cloudflare R2) | Fast, reliable, purpose-built for static assets | Slightly more setup |

**Recommendation:** Host on aisanomat.fi for v1.2 since the site is presumably always up. The risk of the logo breaking is low enough compared to adding CDN infrastructure.

**Dark mode handling for the logo:**

The existing template has dark mode overrides via `@media (prefers-color-scheme: dark)`. A PNG on a transparent background will show correctly on dark backgrounds if the logo design has sufficient contrast. If the primary logo is dark text on transparent, add a white/light version for dark mode via CSS class targeting. Note: CSS targeting of email images for dark mode switching is only supported in Apple Mail and a few other clients — Outlook and Gmail ignore it. The safest solution is a logo design that reads on both light and dark backgrounds (e.g., the teal `#0D9488` icon + white text works on both if the icon has a slight shadow or the teal is legible on dark).

---

## Differentiators

Features that exceed what generic AI newsletters provide.

### Structured Content as Editorial Craft Signal

| Value Proposition | The editorial structure (lead → bullets → impact) signals human-crafted curation, not raw AI dump. Most AI newsletter tools output single paragraphs. Structured output differentiates without adding cost — it's a prompt engineering win. |
|---|---|
| **Complexity** | LOW once schema changes are made |
| **Confidence** | HIGH |

### OG Image as "I read the article" Signal

| Value Proposition | Using the actual article's editorial image signals that the platform engaged with the source material, not just its title. This builds reader trust. AI-generated "related" images signal the opposite. |
|---|---|
| **Complexity** | MEDIUM (fetch reliability, fallback chain) |
| **Confidence** | MEDIUM |

---

## Anti-Features

Features that seem like natural additions but should be explicitly avoided in v1.2.

### Markdown String in JSON Schema

| Why considered | Why to avoid | What to do instead |
|---|---|---|
| Simpler Claude prompt ("generate markdown per story") | Markdown parsing at render time adds a dependency, loses type-safety, makes validation harder, and the `<Markdown>` React Email component has known rendering inconsistencies across clients | Use structured JSON fields (`lead`, `bullets`, `businessImpact`) — type-safe, validatable, renders predictably |

### Inline SVG Logo

| Why considered | Why to avoid | What to do instead |
|---|---|---|
| Crisp at any size, no external HTTP request | Microsoft blocked inline SVG in Outlook completely (Oct 2025 rollout complete) — logo simply disappears for all Outlook users | Host a 2x PNG, display at 50% size for Retina |

### Image Proxy / Resizing Service

| Why considered | Why to avoid | What to do instead |
|---|---|---|
| Normalize all OG images to consistent dimensions, handle WebP conversion | Adds significant infrastructure complexity (need a proxy service or Cloudflare Worker), new failure mode, cost | Accept OG images as-is for v1.2. OG images from reputable news sites are consistently 1200x630. Add email `max-width: 100%` on the `<Img>` tag. Revisit in v2.0 if inconsistent sizing becomes a visual problem. |

### Per-Story AI Image When OG Available

| Why considered | Why to avoid | What to do instead |
|---|---|---|
| Always generate AI images for visual consistency | OG images are more relevant and save Gemini API calls. Mixing editorial photos and AI art in the same newsletter looks inconsistent anyway. | Use OG when available, AI infographic as fallback only. Both styles won't appear in the same email (since most stories will either have OG or not). |

### Rich Text Editor for businessImpact

| Why considered | Why to avoid | What to do instead |
|---|---|---|
| Lets admin manually bold/highlight text in the impact field | Adds editor dependency, admin complexity, and breaks the automated generation pipeline | Fix at the prompt level — instruct Claude to write sharp, punchy impact sentences that don't need formatting emphasis |

---

## Feature Dependencies (v1.2 specific)

```
[Claude JSON Schema: add lead + bullets fields]
    |
    v (enables)
[Claude generation prompt update (DB template)]
    |
    v (generates structured DigestStory)
[DigestStory TypeScript type extension]
    |
    v (flows into)
[DigestEmail.tsx structured article render]
    |
    v (final HTML)
[Resend email delivery — unchanged]


[OG image fetch (new fetchArticleOgImage function)]
    |
    v (populates story.imageUrl if found)
[Existing imageService.ts Gemini generation]
    |
    v (fallback if no OG image)
[PLACEHOLDER_IMAGE_URL]
    |
    v (final fallback)
[DigestEmail.tsx Img component — unchanged]


[Logo PNG asset created and hosted]
    |
    v (referenced in)
[DigestEmail.tsx header section redesign]
```

### Dependency Notes

- **Schema change is the load-bearing dependency.** All structured content work (new fields in JSON schema, TypeScript type, email render) flows from extending the Claude output schema. Do this first.
- **Prompt template update follows schema change.** The DB-stored prompt template must tell Claude to populate the new fields. The admin can update this through the existing template editor.
- **OG image fetch is independent of content structure.** It only touches `imageService.ts` and the story's `imageUrl` field, which the email template already consumes. Can be built in parallel with content structure work.
- **Logo is fully independent.** Header redesign in `DigestEmail.tsx` touches only the header `<Section>`. Can be done first, last, or in parallel.
- **Backward compatibility:** Old issued that are already stored in the DB (with `generatedContent` in the old format, without `lead` and `bullets`) must still render. The email template should fall back to rendering `businessImpact` alone if `lead` and `bullets` are absent. This is a required constraint.

---

## Complexity and Effort Summary

| Feature | Dev Complexity | Risk | New Dependencies |
|---------|---------------|------|-----------------|
| Structured article content | MEDIUM | LOW — schema change is mechanical, render is straightforward | None new |
| OG image fetch | MEDIUM | MEDIUM — reliability varies by source; fallback chain handles it | `open-graph-scraper` npm |
| Branded header with logo | LOW | LOW — standard email image pattern | Logo PNG asset |

**No new API costs for v1.2.** OG images are fetched directly from source sites (no API). Logo is hosted on aisanomat.fi. Gemini image generation cost is reduced (fewer AI images generated when OG images are available).

---

## MVP Recommendation for v1.2

### Build in this order:

1. **Branded header with logo** (LOW complexity, quick win, independent) — immediate visual quality signal, no schema changes needed
2. **Structured article content** (MEDIUM complexity, highest impact) — this is the core content quality improvement; schema → type → prompt → render
3. **OG image fetch** (MEDIUM complexity, some risk) — build last because fallback chain relies on existing Gemini flow being stable; add OG as the new first step in an existing working pipeline

### Rationale

Start with the header because it's independent, fast, and changes how the newsletter looks immediately. The structured content change requires coordinated changes across 4 files (schema, type, prompt template, email render) — do it as a single cohesive unit, not incrementally. OG image fetch is last because it has the most operational uncertainty (site-specific blocking, timeout tuning) and relies on the existing image pipeline being stable.

---

## Sources

### HIGH confidence (caniemail.com verified, official docs)

- [Can I email: `<ul>`, `<ol>`, `<dl>`](https://www.caniemail.com/features/html-lists/) — verified March 2026, confirms basic list support in Gmail/Outlook
- [React Email Heading component](https://react.email/docs/components/heading) — official docs, h1-h6 support confirmed
- [React Email Components list](https://react.email/components) — full component inventory including Section, Text, Img, Heading, Link
- [Outlook blocks SVG images in emails](https://lettermint.co/knowledge-base/deliverability/outlook-blocks-svg-images-in-emails) — Oct 2025 rollout confirmed
- [Microsoft retiring inline SVG in Outlook](https://blog-en.topedia.com/2025/08/microsoft-is-retiring-support-for-inline-svg-images-in-outlook/) — August 2025 announcement
- [Email Header Design Step-by-Step 2026](https://mailtrap.io/blog/email-header-design/) — header height, logo placement best practices

### MEDIUM confidence (multiple industry sources agree)

- [open-graph-scraper npm](https://www.npmjs.com/package/open-graph-scraper) — weekly downloads confirm adoption, API options (timeout, fetchOptions) confirmed from README
- [OG image optimal dimensions](https://cloudinary.com/glossary/og-image) — 1200x630px standard confirmed
- [PNG over SVG for email logos](https://blog.cerulean.studio/best-practices-for-embedding-images-in-emails) — format comparison, email client support matrix
- [Email newsletter design best practices 2026](https://www.brevo.com/blog/email-design-best-practices/) — typography sizes, spacing, mobile-first patterns
- [Email Header Design: 16 best practices](https://stripo.email/blog/email-header-best-practices/) — logo placement, header height, simplicity guidelines
- [Newsletter article structure — Morning Brew analysis](https://www.newsletterexamples.co/p/want-to-design-a-morning-brew-style-email-here-s-a-cheat-sheet) — headline-image-body pattern, brief length

### LOW confidence (single source or training knowledge)

- WebP in OG images email compatibility — Outlook known to not support WebP (training knowledge, not verified against caniemail.com for this specific concern; flag for verification at implementation time)

---

*Feature research for: AI-Sanomat Yrityksille v1.2 Newsletter Quality & Design*
*Researched: 2026-03-04*
