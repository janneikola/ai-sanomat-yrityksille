# Research Summary: AI-Sanomat Yrityksille v1.2 — Newsletter Quality & Design

**Synthesized:** 2026-03-04
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
**Overall Confidence:** HIGH

---

## Executive Summary

AI-Sanomat Yrityksille v1.2 is a focused quality milestone that upgrades an already-running enterprise newsletter platform without touching its infrastructure. The three improvements — structured article content, relevant OG-sourced images, and a branded email header — all extend the existing React Email + Fastify + Claude/Gemini stack. Only one new npm dependency is added (`open-graph-scraper`), no new API credentials are needed, and no database schema breaking changes are required. The changes are additive and the fallback chains ensure the newsletter always sends even when new enrichment steps fail.

The recommended approach is schema-first: extend the Claude JSON output schema to produce `lead`, `bullets`, and `businessImpact` fields, then wire the new shape through the TypeScript types and React Email template. OG image extraction is built as a non-blocking enrichment at news collection time, storing the result in a new `newsItems.ogImageUrl` column and passing it to Claude so it can reference the URL in the generated digest. The AI infographic fallback via Gemini is unchanged in its API surface — only the prompt strategy changes. Logo integration is a single `<Img>` tag addition to `DigestEmail.tsx` pointing to a hosted PNG on `aisanomat.fi`.

The primary risks are operational, not architectural: Gmail's 102KB email clipping limit is a real concern as structured HTML adds bytes, Outlook's Word-based rendering engine breaks CSS-only layouts, and some OG images will be generic placeholders rather than article-specific photos. All three risks have concrete mitigations defined in the research. The correct build order is logo first (independent, zero risk), then structured content (schema-driven, coordinated change across 4 files), then OG image extraction (most operational uncertainty, depends on existing pipeline being stable).

---

## Key Findings

### From STACK.md

Only one new dependency is needed for the entire v1.2 milestone:

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `open-graph-scraper` | ^6.11.0 | Extract `og:image` URLs from news article source pages | HIGH |

All other capabilities (structured HTML, logo, AI infographic fallback) use the existing stack with no changes:

| Existing Capability | How v1.2 Uses It |
|---------------------|-----------------|
| `@react-email/components` ^1.0.8 | `<Heading>`, `<Text>`, `<Section>`, `<Img>` already installed |
| `@google/genai` ^1.43.0 (Gemini 2.5 Flash Image) | AI infographic generation via prompt change only |
| `@anthropic-ai/sdk` ^0.78.0 (Claude Sonnet 4.5) | Structured JSON output via updated schema in `digestJsonSchema` |
| `@fastify/static` | Logo PNG served from `aisanomat.fi` — no Railway hosting needed |

Installation: `npm install -w api open-graph-scraper@^6.11.0`. No new environment variables. No new database tables (one new column: `newsItems.ogImageUrl`).

Key technology decisions:
- **No Puppeteer/Playwright** — OG scraping via `open-graph-scraper` covers all cases; headless browsers add Railway complexity for zero benefit at this scale
- **No image resizing (sharp/canvas)** — OG image URLs are passed directly to `<Img>`; email clients fetch and render them natively
- **No chart libraries (Chart.js/D3)** — Gemini generates infographic-style PNG in a single API call; server-side chart rendering requires native C++ canvas dependencies
- **PNG not SVG for logo** — Outlook blocked inline SVG completely in October 2025; PNG with transparent background is the universal email logo format

---

### From FEATURES.md

**Table Stakes (missing these signals an unpolished product at this price point):**

1. **Structured article content** — Lead sentence + 2–4 bullets + business impact. Every premium B2B newsletter (Morning Brew, TLDR, The Hustle) uses visual hierarchy per story. Single-paragraph AI output signals "raw dump" not "curated intelligence."
2. **Relevant images** — Editorial OG photos are far more credible than abstract AI art. Using actual article images signals the platform engaged with source material, not just headlines.
3. **Branded header with real logo** — Text "AI-Sanomat" in a `<Text>` tag is a label, not a brand mark. Premium newsletters have a visual logo. The header is the first element recipients see.

**Build order recommendation from FEATURES.md:**
1. Branded header (LOW complexity, fully independent, immediate visual impact)
2. Structured article content (MEDIUM complexity, schema-driven, highest content impact)
3. OG image extraction (MEDIUM complexity, most operational uncertainty, last because it depends on stable image pipeline)

**Anti-features explicitly deferred:**
- Markdown strings in Claude JSON output (loses type-safety, adds runtime parsing)
- Inline SVG logo (blocked by Outlook since Oct 2025)
- Image proxy/resizing service (significant infra overhead for a v1.2 quality improvement)
- Per-story AI images when OG is available (mixing editorial and AI art in one newsletter looks inconsistent)
- Rich text editor for business impact (breaks automated generation pipeline)

---

### From ARCHITECTURE.md

Four features, four clean integration points — no restructuring of the existing pipeline:

| Feature | Integration Point | Files Changed |
|---------|-----------------|---------------|
| OG image extraction | News collection phase — `ogService.ts` called after `newsItems` insert | `newsCollectorService.ts`, `db/schema.ts`, new `ogService.ts`, new migration |
| Structured content | Digest generation — Claude JSON schema + TypeScript type | `digest.ts` (types + schema), `newsletterService.ts` (prompt context), new `StoryContent.tsx` |
| AI infographic fallback | Orchestration logic — conditional Gemini generation per story | `newsletterService.ts` (conditional per-story logic only) |
| Logo in header | Email render — single `<Img>` swap in `DigestEmail.tsx` | `DigestEmail.tsx` header section only |

**Key patterns to follow:**

**Pattern 1: Non-blocking enrichment at collection time** — OG fetch runs after newsItem insert, errors caught and ignored. The same pattern as existing `logFetchAttempt()` in the collector. Never fetch OG at render time (would block per-member email rendering with network calls).

**Pattern 2: Schema-first structured output** — Define TypeScript interface and JSON schema in `digest.ts` first, then update Claude prompt template via admin panel. Claude's structured output guarantees the JSON shape at inference time — no runtime parsing guards needed. Precedent: `digestJsonSchema`, `validationJsonSchema`, `imagePromptsJsonSchema` all follow this pattern.

**Pattern 3: Absolute vs relative URL split in `toImageUrl()`** — Gemini images store as relative `/images/{uuid}.png` paths, converted to absolute at render time. OG image URLs are already-absolute remote URLs and must pass through unchanged. The `toImageUrl()` function needs a `startsWith('http')` check added to handle mixed origins.

**Full data flow after v1.2:**
```
COLLECTION: newsItem inserted → ogService.fetchOgImage() [non-blocking] → newsItems.ogImageUrl

GENERATION: newsItems (with ogImageUrl) → Claude prompt context includes OG URLs →
  Claude generates DigestContent { intro, stories[{ title, lead, contentBlocks[], imageUrl? }], closing } →
  Conditional Gemini: only for stories where story.imageUrl is null →
  Merge: OG stories keep their URL, others get Gemini /images/{uuid}.png →
  DB: issues.generatedContent (merged JSON)

RENDER: generatedContent parsed → toImageUrl() passes http:// URLs through unchanged →
  DigestEmail: logo Img + per story: image + title + lead + StoryContent(contentBlocks) + link
```

---

### From PITFALLS.md

**Top 5 pitfalls by severity:**

**Pitfall 1 — Gmail clips email at 102KB (CRITICAL, Structured HTML Content phase)**
React Email compiles JSX to verbose inline-styled HTML. Structured content per article (lead, bullets, callout boxes) can push a 10-article newsletter past Gmail's 102KB limit, hiding the footer, unsubscribe link, and feedback buttons. Prevention: add `Buffer.byteLength(html, 'utf8')` logging before every send; alert at 80KB; truncate article list before truncating content structure.

**Pitfall 2 — Outlook ignores CSS on structural elements (CRITICAL, Structured HTML Content phase)**
Enterprise clients (Finnish B2B sector) predominantly use Outlook desktop, which uses Word 2007's rendering engine. Flexbox, CSS `max-width` on divs, and default list styles all collapse. Every new structured element must use `<Section>/<Row>/<Column>` (which compile to tables) and `bgcolor` attribute (not CSS `background-color`). Test in Litmus or Email on Acid against Outlook 2016/2019/365 desktop before shipping — browser preview is meaningless for this client.

**Pitfall 3 — OG fetch hangs and blocks pipeline (HIGH, OG Image Extraction phase)**
Sites behind Cloudflare, paywalls, or slow CDNs can take 10–30 seconds to respond or never respond. 20 articles × hanging fetches = 10+ minutes of pipeline time. Prevention: 3-second `AbortController` timeout per fetch, `Promise.allSettled()` (not `Promise.all()`) for parallel batches, OG fetch cached in DB by article URL so it never runs twice for the same URL.

**Pitfall 4 — Generic site-wide OG image treated as valid article image (HIGH, OG Image Extraction phase)**
JavaScript-rendered sites (Next.js, React SPAs) serve pre-rendered HTML where og:image is the site's default sharing image, not article-specific. The fallback AI infographic never fires because the URL is non-null. Prevention: check og:image URL path for `default`, `logo`, `fallback`, `placeholder`, `og-generic`, `share`; treat these as missing and fall through to AI infographic.

**Pitfall 5 — Dark logo invisible in dark mode (MEDIUM, Logo Branding phase)**
Dark icon/text logos disappear on dark email backgrounds (Apple Mail, iOS Mail, Outlook macOS dark mode). Prevention: wrap logo `<Img>` in a table cell with explicit `bgcolor="#FFFFFF"` — creates a white background island that renders correctly in dark mode even for clients that ignore CSS `background-color`. Prepare two logo variants if the primary logo design cannot work on both light and dark.

Additional pitfalls documented: base64 logo inflates HTML size by 33% toward Gmail clipping threshold (always use hosted URL); Gemini billing must be enabled for image generation (free tier is 0 IPM); Gemini safety filter rejects AI-topic prompts (use visual metaphor prompts, not article subject matter); `<Heading>` component incompatible with Tailwind in React Email (use native `<h2>/<h3>` with inline styles); OG relative URLs break in email clients (resolve against article origin with `new URL()`).

---

## Implications for Roadmap

### Suggested Phase Structure

All four features can be delivered in a single milestone with 5 ordered implementation steps. They are not large enough to warrant separate multi-week phases — the complexity is focused on a handful of files.

---

**Step 1: DB schema + migration** (prerequisite for everything else)

Scope: Add `ogImageUrl TEXT` column to `newsItems` table. Extend `DigestStory` TypeScript type with `lead: string`, `bullets: string[]` (or `contentBlocks: DigestStoryBlock[]`), update `digestJsonSchema`. Create Drizzle migration.

Rationale: All other steps depend on committed types. Doing this first unblocks parallel work. No user-visible change yet.

Pitfalls to avoid: None at this step — purely mechanical schema and type work.

Research flag: Standard patterns, no additional research needed.

---

**Step 2: Logo in email header** (independent, ship first)

Scope: Upload logo PNG (320×80px, transparent background, optimized under 10KB) to `aisanomat.fi/assets/logo/`. Modify `DigestEmail.tsx` header section — replace text-only with `<Img>` in a `bgcolor="#FFFFFF"` table cell. Keep text fallback `alt="AI-Sanomat"`.

Rationale: Fully independent of all schema changes. Zero risk — one `<Img>` element added. Immediate visual quality improvement that can ship before content structure work begins.

Pitfalls to avoid: Pitfall 5 (dark mode), Pitfall 5b (base64), Pitfall 11 (CDN domain — host on aisanomat.fi, not shared CDN).

Research flag: Standard pattern. Verify logo asset exists at production URL before deploying template change.

---

**Step 3: OG image extraction** (depends on Step 1)

Scope: Create `api/src/services/ogService.ts` using `open-graph-scraper`. Add `npm install -w api open-graph-scraper@^6.11.0`. Modify `newsCollectorService.ts` to call `ogService.fetchOgImage()` after newsItem insert, non-blocking. Pass `ogImageUrl` in Claude's news context so Claude can set `story.imageUrl` for stories where OG image exists.

Rationale: Must run after Step 1 (`ogImageUrl` column). Collect OG data at news ingestion time — never at render time. After this step deploys, OG URLs start accumulating in the DB for newly collected articles.

Pitfalls to avoid: Pitfall 1 (timeout), Pitfall 3 (generic images — add URL heuristic check), Pitfall 8 (relative URLs — resolve with `new URL()`), Pitfall 13 (AbortController cleanup in finally block), Pitfall 14 (image-to-text ratio).

Research flag: No additional research. `open-graph-scraper` API is well-documented. Verify ESM compatibility (confirmed HIGH).

---

**Step 4: Structured article content** (depends on Step 1, parallel-safe with Step 3)

Scope: Create `api/src/emails/StoryContent.tsx` to render `contentBlocks[]`. Modify `DigestEmail.tsx` to use `StoryContent` per story (backward-compatible: fall back to `businessImpact` string if `contentBlocks` absent). Update `viikkokatsaus_generointi` prompt template in DB via admin panel (no code deploy). Add HTML byte-length logging to email send pipeline.

Rationale: All changes are coordinated — schema, type, email render, prompt. Must be done as a single cohesive unit. Backward compatibility is required: old issues in the DB render with existing `businessImpact` field; new issues render `contentBlocks`.

Pitfalls to avoid: Pitfall 1 (Gmail 102KB — add byte logging before adding any structured elements), Pitfall 2 (Outlook — table-based layout only, no CSS flexbox, use `bgcolor` for callout boxes), Pitfall 12 (use native `<h2>/<h3>` with inline styles, not `<Heading>` component with Tailwind).

Research flag: Set up Litmus or Email on Acid before writing any structured content component. Testing in browser preview is not sufficient for Outlook verification.

---

**Step 5: AI infographic fallback wiring** (depends on Steps 3 and 4)

Scope: Modify `newsletterService.generateClientDigest()` to filter `imagePrompts.sectionPrompts` to only stories where `story.imageUrl` is null, pass only those to Gemini, then merge OG URLs and Gemini results back into the stories array. Update `toImageUrl()` in `emailService.ts` to pass through `http://`-prefixed URLs unchanged. Update Gemini infographic prompts to describe visual style (chart icons, teal palette), not article subject matter.

Rationale: Integration step that wires OG data (Step 3) and story image field (Step 4) into the conditional Gemini generation logic. Cannot be fully tested until both upstream steps are stable.

Pitfalls to avoid: Pitfall 6 (Gemini billing — verify image generation quota enabled before testing), Pitfall 7 (safety filter — use visual metaphor prompts), Pattern 3 (`toImageUrl()` absolute URL pass-through).

Research flag: Verify Gemini billing is enabled for image generation before implementing. Test infographic prompt against 10–15 real article summaries from the news corpus before shipping.

---

### Summary Build Order

```
Step 1: DB schema + TypeScript types  (prerequisite)
Step 2: Logo in header                (independent, ship first)
Step 3: OG image extraction           (depends on Step 1)
Step 4: Structured article content    (depends on Step 1, parallel with Step 3)
Step 5: AI infographic fallback       (depends on Steps 3 + 4)
```

Steps 3 and 4 can be built in parallel if two developers are available, or sequentially in either order by one developer. Step 5 is the integration validation step.

---

### Research Flags Summary

| Step | Needs Research | Reason |
|------|---------------|--------|
| Step 1 | No | Standard Drizzle schema + TypeScript type changes |
| Step 2 | No | Standard email image pattern; verify logo asset exists at URL |
| Step 3 | No | `open-graph-scraper` API well-documented; patterns are clear |
| Step 4 | Partial | Litmus/Email on Acid account required as prerequisite for Outlook testing |
| Step 5 | Partial | Verify Gemini billing enabled; test prompts against real article content |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Only one new dependency (`open-graph-scraper`). All other capabilities use existing installed libraries. ESM compatibility confirmed. No new env vars, no new DB tables. |
| Features | HIGH | React Email component availability verified. Email client compatibility verified via caniemail.com (March 2026). SVG/Outlook blocking verified. OG reliability is MEDIUM — scraping fragility is known and the fallback chain handles it. |
| Architecture | HIGH | Existing codebase directly inspected (HIGH confidence source). Integration points are clearly identified, change surface is minimal, backward compatibility is explicit. |
| Pitfalls | HIGH | Gmail 102KB clipping documented via bug trackers. Outlook rendering via Email on Acid. Gemini safety filter via official Google AI forum. `open-graph-scraper` behavior via npm/GitHub. Most pitfalls have multiple independent sources. |

### Gaps to Address During Implementation

1. **Litmus or Email on Acid account** — Required before any structured content component is written. Without it, Outlook desktop testing is impossible. Budget approximately 100 EUR/month or arrange a trial account before Step 4 begins.

2. **Gemini image generation billing** — Verify the production Google Cloud project has billing enabled for image generation endpoints before Step 5 begins. Free tier is 0 IPM for image generation (confirmed by multiple sources). Add startup health check that calls Gemini image endpoint with a minimal test request and logs clearly if quota is unavailable.

3. **Logo asset creation** — The logo PNG (320×80px, transparent background, under 10KB optimized) must exist at `https://aisanomat.fi/assets/logo/ai-sanomat-logo.png` before Step 2 deploys. This is a design/asset task, not a code task — coordinate with whoever owns the aisanomat.fi site.

4. **WebP OG image email compatibility** — Modern CMS platforms increasingly use WebP for OG images. Gmail supports WebP; Outlook does not. For v1.2, accept WebP and let Outlook users see broken images rather than adding image conversion infrastructure. Note this explicitly in the implementation and revisit in v2.0 with an image proxy solution.

5. **`toImageUrl()` absolute URL pass-through** — This function currently prefixes all paths with `${baseUrl}/api`. OG image URLs (starting with `https://`) must bypass this transformation. This is a small but critical fix — if missed, every OG image URL in the rendered email will be malformed.

---

## Deferred to v2.0

Per FEATURES.md anti-features research:
- Image proxy/resizing service for consistent OG image dimensions and WebP conversion
- Dark-mode logo swap via CSS media query (Apple Mail only — Outlook ignores it; the `bgcolor` white cell hack covers the critical case)
- Per-story Gemini images when OG is available (visual inconsistency; OG + AI in same newsletter looks mixed)
- Click tracking on article links (link-wrapping infrastructure, privacy concerns)
- Rich text editor for businessImpact field (breaks automated generation pipeline)

---

## Sources (Aggregated)

### HIGH Confidence (official docs, caniemail.com, direct codebase inspection)

- [open-graph-scraper npm](https://www.npmjs.com/package/open-graph-scraper) — v6.11.0 confirmed, ESM build verified
- [React Email component docs](https://react.email/docs/components) — Heading, Text, Section, Img availability confirmed
- [Can I email: `<ul>`, `<ol>`, `<dl>`](https://www.caniemail.com/features/html-lists/) — verified March 2026
- [Can I email: list-style](https://www.caniemail.com/features/css-list-style/) — inline style fallback required for Outlook
- [SVG in email: caniemail.com](https://www.caniemail.com/features/image-svg/) — NOT supported in Outlook
- [Outlook blocks SVG in emails](https://lettermint.co/knowledge-base/deliverability/outlook-blocks-svg-images-in-emails) — Oct 2025 rollout confirmed
- [caniemail.com: Base64 image](https://www.caniemail.com/features/image-base64/) — Gmail blocks base64
- [Gmail Clipping at 102KB — email-bugs](https://github.com/hteumeuleu/email-bugs/issues/41) — documented and confirmed
- [Gmail Clipping — SpamResource](https://www.spamresource.com/2022/01/what-is-gmail-clipping-and-what-to-do.html)
- [Outlook HTML rendering — Email on Acid](https://www.emailonacid.com/blog/article/email-development/how-to-code-emails-for-outlook/)
- [Gemini IMAGE_SAFETY false positives — Google AI Developers Forum](https://discuss.ai.google.dev/t/nano-banana-pro-suddenly-blocking-non-nsfw-ecommerce-underwear-images-with-image-safety-error/113109)
- [Gemini API rate limits — official docs](https://ai.google.dev/gemini-api/docs/rate-limits)
- [React Email Dark Mode — GitHub #591](https://github.com/resend/react-email/discussions/591)
- [Claude Structured Outputs docs](https://docs.claude.com/en/docs/build-with-claude/structured-outputs)
- Codebase: `/Users/janne/coding/ai-sanomat-yrityksille/api/src/` (direct inspection)

### MEDIUM Confidence (industry guides, single-source, or unverified)

- [Email Header Design 2026 — Mailtrap](https://mailtrap.io/blog/email-header-design/) — header patterns
- [Email newsletter design best practices 2026 — Brevo](https://www.brevo.com/blog/email-design-best-practices/)
- [OG image optimal dimensions — Cloudinary](https://cloudinary.com/glossary/og-image) — 1200×630px standard
- [Gemini free tier 0 IPM — AIFreeAPI](https://www.aifreeapi.com/en/posts/gemini-api-rate-limit) — corroborated by multiple sources
- [Morning Brew newsletter structure analysis](https://www.newsletterexamples.co/p/want-to-design-a-morning-brew-style-email-here-s-a-cheat-sheet)
- [Image-to-text ratio — Email on Acid](https://www.emailonacid.com/blog/article/email-deliverability/does-text-to-image-ratio-affect-deliverability/)
- [React Email Headings with Tailwind — community discussion](https://www.tempmail.us.com/en/react/why-headings-don-t-work-with-tailwind-in-react-email)
- WebP email client compatibility — Outlook known not to support WebP (training knowledge, not verified against caniemail.com — flag for verification)

---

*Summary synthesized from: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md*
*Project: AI-Sanomat Yrityksille v1.2 — Newsletter Quality & Design*
*Synthesized: 2026-03-04*
