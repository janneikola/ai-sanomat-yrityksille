# Pitfalls Research

**Domain:** Adding OG image extraction, AI infographic fallback, structured HTML email content, and logo branding to an existing Node.js newsletter platform (AI-Sanomat Yrityksille v1.2)
**Researched:** 2026-03-04
**Confidence:** HIGH (multiple independent sources verified; official React Email, Resend, and Google AI documentation cross-referenced)

---

## Critical Pitfalls

### Pitfall 1: OG Image Fetch Blocks Newsletter Generation When Source Sites Are Slow

**What goes wrong:**
The digest generation pipeline calls out to third-party news sites to fetch OG metadata (og:image, og:title). News sites run behind CDNs, paywalls, anti-bot WAFs, and rate limiters. A single slow or unresponsive site can add 10-30 seconds to the pipeline per article. With 10-20 articles per digest, total added latency can be 3-10 minutes. Worse, if the fetch is synchronous and the site returns an HTTP 503 or hangs, the entire newsletter generation call can time out.

**Why it happens:**
Developers write `await fetch(articleUrl)` directly in the generation pipeline without a timeout guard. They test against fast, well-behaved news sites during development, then discover production sources (paywalled Finnish tech blogs, corporate PR sites) behave differently.

**Consequences:**
- Newsletter generation becomes unreliable and slow
- Failed OG fetches cause incomplete template data (undefined `ogImage`) crashing the email renderer
- Railway function timeouts kill long-running digest jobs

**Prevention:**
- Set a hard timeout per OG fetch: 3 seconds maximum. Use `AbortController` with a 3s timeout signal
- Never await OG fetches sequentially — run them in parallel with `Promise.allSettled()`, never `Promise.all()` (one failure should not abort all others)
- Treat OG image as optional enrichment, not required data: always have the AI infographic fallback ready before attempting OG extraction
- Cache OG results in the database keyed by article URL with a 24-hour TTL — the same article URL should never be fetched twice in a single day
- Log failed fetches at WARN level, not ERROR — a missing image is not a pipeline failure

**Detection (warning signs):**
- Newsletter generation consistently takes longer than 60 seconds
- Admin logs show uncaught errors referencing `undefined` on template rendering
- OG fetch code uses `Promise.all()` without try/catch

**Phase to address:** OG Image Extraction phase — timeout and parallel fetch strategy must be architectural decisions before any extraction code is written.

---

### Pitfall 2: JavaScript-Rendered OG Tags Are Invisible to Server-Side Fetch

**What goes wrong:**
Many modern news sites (Axios, The Verge, TechCrunch) use Next.js or React with client-side meta tag injection. When your backend does a plain `fetch(url)` or uses a library like `open-graph-scraper`, it receives the raw HTML shell — before JavaScript executes. The og:image tag is either missing or points to a generic fallback. You parse empty OG data, get no image URL, and your fallback logic never triggers because you believe you have a valid (but wrong) generic og:image.

**Why it happens:**
Developers test OG extraction against simple WordPress blogs where meta tags are in the static HTML. Client-rendered sites look fine when you open them in a browser (which executes JS), but the server sees different content.

**Consequences:**
- Newsletters show wrong generic images (the site's default sharing image) instead of article-specific images
- Fallback AI infographic logic never fires because a non-null og:image URL was returned
- Hard to debug: the generic image URL is valid and loads, but it is content-irrelevant

**Prevention:**
- After extracting og:image, validate that the image URL contains path segments or filenames that suggest it is article-specific (not a generic `logo.png`, `default-og.jpg`, or `share.jpg`)
- If og:image URL contains `default`, `logo`, `fallback`, `placeholder`, or `og-generic` in the path, treat it as missing and use the AI infographic fallback
- Test OG extraction against the actual source URLs in the system (RSS, Tavily, Beehiiv), not hypothetical well-behaved sites
- Use `open-graph-scraper` npm package as the base — it handles the most common edge cases including relative URL resolution to absolute URLs

**Detection (warning signs):**
- All articles from a particular source show the same og:image URL regardless of article content
- og:image URL contains `default`, `logo`, or `share` in the path
- Browser dev tools show og:image correctly but your extraction returns a different URL

**Phase to address:** OG Image Extraction phase — add URL quality heuristics to the extraction logic from the start.

---

### Pitfall 3: Gmail Clips Email at 102KB — Structured HTML Triggers the Limit

**What goes wrong:**
The current v1.1 email template is a single text block per article. v1.2 adds subheadings, bullet lists, bold text, and highlighted sections per article. Each article's structured content adds HTML tags, inline styles, and wrapper elements. A newsletter with 10 articles x structured content can easily exceed 102KB of raw HTML. Gmail silently clips the email at 102KB, displaying "[Message clipped]" with a "View entire message" link. Recipients never see the bottom of the newsletter, including the footer, unsubscribe link, and feedback buttons — creating legal and UX problems.

**Why it happens:**
React Email compiles JSX to inline-styled HTML, which is verbose. A simple `<ul>` with 5 items in React Email compiles to a table structure with multiple rows, each with full inline styles repeated per element. Content that looks lightweight in JSX can compile to 3-5x the raw byte count.

**Consequences:**
- Recipients miss footer content including the unsubscribe link (CAN-SPAM / EU email law violation risk)
- Feedback buttons are clipped — satisfaction tracking breaks
- Trust damage: clipped emails look broken and unprofessional

**Prevention:**
- Instrument the compiled email HTML size after rendering, before sending: log `Buffer.byteLength(html, 'utf8')` and alert if it exceeds 80KB (leaving a 22KB buffer)
- If HTML exceeds 80KB, truncate the article list to fit: render fewer articles with full structured content rather than all articles with truncated structure
- Never repeat full inline style objects per element — extract repeated style patterns into template-level constants and reference them, rather than duplicating the same `font-family: Arial; font-size: 14px; line-height: 1.6;` string on every paragraph
- Images in emails are hosted externally — their byte count does not add to the HTML size limit. Only inline base64 images count against the 102KB limit
- Test compiled HTML size as part of the build process: the render-and-measure step should be automated, not manual

**Detection (warning signs):**
- Rendered HTML file is larger than 80KB
- Gmail shows "[Message clipped]" in test sends
- Recipients report not seeing the unsubscribe link
- No HTML size logging exists in the send pipeline

**Phase to address:** Structured HTML Content phase — add HTML size measurement to the email send function before adding any new structured content elements.

---

### Pitfall 4: Outlook Ignores CSS on Structural Elements, Breaking Structured Content Layout

**What goes wrong:**
v1.2 adds structured HTML: subheadings, bullet lists, dividers, highlighted boxes. In Gmail and Apple Mail these look polished. In Outlook desktop (which uses the Word 2007 rendering engine) — the primary client for enterprise users, the target audience — the layout collapses. Flexbox is ignored. CSS `max-width` on div elements is ignored. List styles (`ul`, `li`) render with different default padding. Bordered "highlight" boxes disappear. The structured content that makes the newsletter more readable becomes a wall of unstyled text with broken indentation.

**Why it happens:**
React Email's JSX preview and browser-based preview use a real browser engine. Outlook uses Word's rendering engine. The gap between them is enormous and invisible during development.

**Consequences:**
- Enterprise clients (Finnish B2B sector, heavily Outlook-dependent) see a broken newsletter
- Content hierarchy is lost — subheadings look like body text, lists look like plain paragraphs
- First impression of v1.2 improvement is negative, not positive

**Prevention:**
- For ALL structural layout: use React Email's `<Section>`, `<Row>`, `<Column>` components which compile to `<table>`, `<tr>`, `<td>` — Outlook supports table layout reliably
- For lists: do NOT use `<ul>` / `<li>` directly. Build pseudo-lists from table rows with a bullet character (•) in the first column. This is verbose but renders consistently
- For highlighted boxes: use table cells with `bgcolor` attribute (not CSS `background-color`) for Outlook compatibility
- For subheadings: use `<h2>` / `<h3>` tags with explicit inline `font-size`, `font-weight`, `color`, `margin` — do not rely on browser heading defaults
- After implementing any new structured element, test it in Litmus or Email on Acid specifically against Outlook 2016, 2019, and 365 desktop — not Outlook.com webmail
- Keep a "Outlook-safe CSS properties" reference: `color`, `font-family`, `font-size`, `font-weight`, `text-align`, `padding`, `border`, `width` on table cells — these work. `flexbox`, `grid`, `position`, `transform`, `max-width` on divs — these do not

**Detection (warning signs):**
- Structured content tested only in the browser or React Email preview, never in an actual email client
- Email template uses `display: flex` anywhere
- No Litmus/Email on Acid account exists for the project
- `<ul>` or `<li>` tags appear in the compiled HTML output

**Phase to address:** Structured HTML Content phase — Litmus or Email on Acid account must be set up before writing a single new structured content component.

---

### Pitfall 5: Base64-Encoded Logo in Email Header Contributes to Gmail Clipping

**What goes wrong:**
The natural instinct for adding a logo to the email header is to inline it as a base64-encoded data URI: `<img src="data:image/png;base64,..." />`. This embeds the image directly in the HTML without needing an external host. However, base64 encoding inflates file size by approximately 33%. A 15KB PNG logo becomes 20KB of base64 text in the HTML. Combined with the structured article content, this pushes the email past Gmail's 102KB clipping threshold faster.

**Why it happens:**
Developers reach for base64 encoding to avoid the complexity of setting up image hosting. It feels simpler, self-contained, and avoids 404 risks. The size penalty is not obvious until the email clips.

**Consequences:**
- Gmail clips the newsletter, hiding the footer and feedback buttons
- The base64 blob also increases email parse time and can trigger spam heuristics on some filters
- Base64 images are blocked by many enterprise email security gateways that scan image content inline

**Prevention:**
- Host the AI-Sanomat logo on the aisanomat.fi domain itself (e.g., `https://aisanomat.fi/images/email-logo.png`) — this is a domain Resend already sends from, with established reputation
- Use the existing domain for image hosting — no separate CDN infrastructure needed for a single logo file
- Logo should be a small, optimized PNG or WebP: target under 10KB file size, 200px wide at 2x resolution for retina
- Use `width` and `height` attributes on the `<img>` tag (not just CSS) to prevent layout shift when images are blocked
- Provide a text fallback in the `alt` attribute: `alt="AI-Sanomat"` so the header is readable even with images off
- Never use base64 for email images — use hosted URLs exclusively

**Detection (warning signs):**
- `src="data:image/..."` appears anywhere in the email template
- Email HTML size exceeds 80KB before structured article content is added
- Logo image file has not been optimized (check with `ls -lh`)

**Phase to address:** Logo Branding phase — set up image hosting on aisanomat.fi before writing any logo component.

---

### Pitfall 6: Gemini Image Generation Has Zero Free-Tier Quota for Billing-Disabled Accounts

**What goes wrong:**
As of late 2025, the Gemini API free tier provides 0 IPM (Images Per Minute) for image generation. Billing must be enabled to generate any images. This is not clearly communicated in the main Gemini documentation landing page — developers discover it only when they hit a quota error during implementation. If the existing Gemini integration in v1.1 was set up without billing enabled (possible if only text generation was used previously), the AI infographic fallback will silently return empty results or throw 429 errors.

**Why it happens:**
The Gemini API documentation groups image generation under the same API credentials as text generation. Developers assume that if their API key works for text (Gemini Nano Banana 2 for image generation in v1.1), it will also work at the same tier level for generating infographics via the image generation endpoints. The quota error only appears at runtime, not during setup.

**Consequences:**
- AI infographic fallback generates no images — newsletter articles have no images at all
- Error surfaces as a runtime 429 or quota error in the generation pipeline, not a clear configuration error
- If not caught gracefully, the error crashes the digest generation job

**Prevention:**
- Verify billing is enabled on the Google Cloud project linked to the Gemini API key used in production before starting v1.2 implementation
- Add an explicit startup health check: call the Gemini image generation endpoint with a minimal 1-pixel test request on server start, and log a clear error if it fails: "GEMINI_IMAGE: Billing not enabled or quota exceeded — AI infographic fallback will not work"
- Implement the fallback chain: OG image → AI infographic → no image (graceful degradation). Even if AI infographic fails, the newsletter must still send without images rather than failing entirely
- Add retry logic with exponential backoff for transient 429 errors (rate limits): wait 2s, 4s, 8s before giving up
- Use a separate Gemini API key for image generation vs. text generation if the existing key's quota is shared

**Detection (warning signs):**
- Existing Gemini integration in v1.1 was used with billing disabled
- No startup health check for image generation quota exists
- Pipeline has no graceful fallback when AI image generation returns empty

**Phase to address:** AI Infographic Fallback phase — billing verification and graceful fallback chain must be built before the AI infographic feature is considered "done".

---

### Pitfall 7: AI-Generated Infographic Triggers Gemini Safety Filter for Business/Tech Content

**What goes wrong:**
Gemini's image safety classifier is overly conservative and context-blind for enterprise use cases. Community reports (Google AI Developers Forum, 2025) document production cases where entirely legitimate ecommerce, editorial, and business images receive `IMAGE_SAFETY` errors. For AI-industry infographic generation, prompts mentioning specific AI companies, competitive analysis, or topics like "data scraping" or "model jailbreaking" can trigger false positives from the safety classifier — even though the output would be a benign business infographic.

**Why it happens:**
Gemini's safety filters use keyword and pattern matching in prompts, not just output image analysis. Certain industry terminology common in AI news (adversarial attacks, model exploitation, deepfakes) triggers the classifier regardless of the benign visual intent.

**Consequences:**
- Infographic generation silently fails for certain article categories
- The fallback to no-image mode activates, but the failure reason is opaque — looks like a quota error
- If the safety filter is hit repeatedly, the API key can be temporarily rate-limited

**Prevention:**
- Design the infographic prompt to describe the visual output (charts, icons, abstract representations) rather than the article's subject matter: "Create a clean business infographic with icons representing artificial intelligence technology trends" rather than "Create an infographic about AI model vulnerabilities"
- Use a whitelist of visual metaphors in the prompt that are clearly safe: bar charts, network diagrams, globe icons, computer screens, gear icons, upward-trending arrows
- Log the specific safety filter response categories when they occur (Gemini returns structured safety ratings) so patterns can be identified
- Test the infographic prompt against a sample of 20-30 article summaries from the existing news corpus before shipping — catch problematic prompt patterns early
- Have a ready alternate prompt template that is more abstract if the primary prompt fails: fall back from article-specific prompts to generic "AI industry trends" visuals

**Detection (warning signs):**
- Infographic prompt includes article body text or specific AI system names directly
- No logging of safety filter response categories
- No alternate prompt fallback when primary prompt is rejected

**Phase to address:** AI Infographic Fallback phase — prompt design and safety filter handling must be tested against real article content before the feature ships.

---

## Moderate Pitfalls

### Pitfall 8: OG Image URL Is Relative, Not Absolute

**What goes wrong:**
Some older RSS sources and blog platforms set og:image to a relative URL (`/images/article-thumb.jpg` instead of `https://example.com/images/article-thumb.jpg`). When this relative URL is used directly as an `<img src>` in an email, it points to nothing — email clients have no base URL to resolve relative paths against.

**Prevention:**
- After extracting the og:image value, always resolve it against the article's origin URL using the `URL` constructor: `new URL(ogImage, articleUrl).toString()`
- Validate that the resolved URL starts with `https://` — reject `http://` URLs as many email clients block mixed-content images
- Validate URL format before storing: catch malformed URLs with a try/catch around the `URL` constructor

**Phase to address:** OG Image Extraction phase.

---

### Pitfall 9: Dark Mode Inverts the Logo and Makes It Invisible

**What goes wrong:**
The AI-Sanomat logo is designed for light backgrounds: dark text, dark icon on white or light grey. When enterprise email clients (Apple Mail, Outlook on macOS, iOS Mail) switch to dark mode, the email background becomes dark and the dark logo becomes invisible or near-invisible — effectively removing the brand header from the email.

**Prevention:**
- Prepare two versions of the logo: one for light mode (dark icon, normal colors) and one for dark mode (white/light version of the icon)
- Use CSS media query `prefers-color-scheme: dark` with `<style>` to swap logo src — Apple Mail respects this
- For Outlook (which does not respect this media query), ensure the logo has a visible background color set on its container table cell: `bgcolor="#FFFFFF"` forces a white background even in Outlook dark mode
- Wrap the logo `<img>` in a table cell with explicit `bgcolor` to create a light background island — the logo will always render on a white background regardless of the surrounding email background
- Use transparent PNG with sufficient padding so the white background cell looks designed, not like a forced hack

**Phase to address:** Logo Branding phase.

---

### Pitfall 10: Structured HTML Looks Broken When Images Are Blocked

**What goes wrong:**
Corporate email environments (Finnish enterprise, government, financial sector) often block remote images by default. When images are blocked, the article layout depends entirely on the image placeholder space and alt text. If the `<img>` tag has no `width` and `height` attributes and no `alt` text, the image slot collapses to zero height, which shifts the entire article layout and can make it look like the article has no separator from the next article.

**Prevention:**
- Always set `width` and `height` attributes (not CSS properties) on all `<img>` tags
- Write meaningful `alt` text for OG images: use the article headline as the alt text (e.g., `alt="OpenAI julkistaa uuden mallin"`)
- Style the alt text with inline CSS so it looks intentional when displayed as text: `style="font-size:12px; color:#666666; font-style:italic;"`
- Never rely on an image to provide visual separation between articles — always use a structural divider (border-bottom on a table row) that renders even without images

**Phase to address:** Structured HTML Content phase, with review during OG Image Extraction phase.

---

### Pitfall 11: CDN Domain for Hosted Images Differs From Sending Domain, Triggering Spam Filters

**What goes wrong:**
If the AI-Sanomat logo and article images are hosted on a different domain than the sending domain (e.g., images on `cdn.someimagehost.com` while email is sent from `@aisanomat.fi`), some spam filters flag the domain mismatch as a phishing signal. Shared CDN domains may also have poor reputation if other tenants have used them for spam.

**Prevention:**
- Host all email images (logo, any static assets) on `aisanomat.fi` itself — a subdirectory (`/static/email/`) or subdomain (`images.aisanomat.fi`) that shares the root domain's reputation
- Do NOT use free image hosting services (Imgur, Cloudinary free tier, generic S3 buckets) for email images — shared reputation risk
- OG images from source articles use the source site's CDN, which is unavoidable — this is acceptable because the article URL domain is typically a legitimate news source
- Verify image hosting domain is not on any blocklist before first send using MXToolbox or similar

**Phase to address:** Logo Branding phase — image hosting infrastructure must be decided before any images are referenced in email templates.

---

### Pitfall 12: Tailwind Headings in React Email Require Native HTML Tags, Not `<Heading>` Component

**What goes wrong:**
React Email's `<Heading>` component does not work correctly with Tailwind CSS classes in certain configurations. The Tailwind styles either do not apply or compile to values that are overridden by email client default stylesheet. Developers spend significant time debugging why their `className="text-xl font-bold"` on a `<Heading>` produces no visible effect.

**Why it happens:**
React Email's `<Heading>` component adds its own default styles that conflict with Tailwind's utility class output. The issue is documented in open GitHub issues and community discussions.

**Prevention:**
- Use native HTML tags (`<h2>`, `<h3>`) with explicit inline styles, not the React Email `<Heading>` component
- Do not rely on Tailwind for structural typography in email — inline `style` props on `<h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1a1a1a' }}>` are more predictable
- Tailwind is acceptable for spacing utilities (`px-4`, `py-2`) but should not be the primary mechanism for typographic styling in email context
- The existing system already uses `pixelBasedPreset` (correct for email) — ensure all new components follow this same pattern and do not introduce rem-based Tailwind classes

**Phase to address:** Structured HTML Content phase.

---

## Minor Pitfalls

### Pitfall 13: OG Image Fetch Leaks Memory if AbortController Is Not Cleaned Up

**What goes wrong:**
Each OG fetch creates an `AbortController` and sets a `setTimeout` to trigger it. If the fetch resolves before the timeout, the `setTimeout` is never cleared, leaving a pending timer in the Node.js event loop. In batch processing (10-20 articles per digest), this creates 10-20 orphaned timers per generation run. Under Railway's long-running server model, these timers accumulate.

**Prevention:**
- Always call `clearTimeout(timeoutId)` in the `finally` block of the fetch wrapper
- Use a battle-tested timeout wrapper utility rather than implementing manually:

```typescript
async function fetchWithTimeout(url: string, timeoutMs = 3000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}
```

**Phase to address:** OG Image Extraction phase.

---

### Pitfall 14: Image-to-Text Ratio Triggers Spam Filters If Too Many Images Are Added

**What goes wrong:**
Adding an image per article (OG or AI infographic) to a 10-article newsletter dramatically increases the image count. If each article also becomes shorter (more structured but less prose), the image-to-text ratio can tip past the 30-40% threshold where spam filters apply penalties.

**Prevention:**
- Target 60-70% text to 30-40% image ratio — structured HTML content naturally increases the text area, which helps
- Ensure each article section has a minimum of 100 words of visible text to provide sufficient text weight relative to the image
- All images must have descriptive `alt` text — this text is counted as email content by some filters, helping the ratio
- If more than 8 articles are included in a single issue, consider not showing images for lower-priority articles to keep the image count reasonable

**Phase to address:** OG Image Extraction phase — measure ratio before shipping.

---

## "Looks Done But Isn't" Checklist

- [ ] **OG Extraction:** Meta tags are being parsed — but the fetch has no timeout, so slow sites can hang the digest generation job for minutes
- [ ] **OG Extraction:** og:image URL is returned — but it is a generic site-wide sharing image, not article-specific; the fallback AI infographic never fires because the URL is non-null
- [ ] **OG Extraction:** Images appear in preview — but the URL is relative (`/images/thumb.jpg`) which resolves to nothing in an email client that has no base URL
- [ ] **AI Infographic:** Gemini API key works for text generation — but billing was never verified for image generation, so the infographic fallback silently returns empty at runtime
- [ ] **AI Infographic:** Infographic generates correctly for most articles — but certain AI industry terms in the prompt hit Gemini's safety classifier; no alternate prompt fallback exists
- [ ] **Structured HTML:** Content looks correct in browser and React Email preview — but Outlook renders it as an unstyled text wall because CSS was used for layout instead of table structure
- [ ] **Structured HTML:** Email looks great with 5 articles — but adding structured content per article pushed the compiled HTML past 102KB; Gmail clips it and the unsubscribe link is hidden
- [ ] **Logo Branding:** Logo renders correctly in Gmail and Apple Mail — but dark mode on Apple Mail or iOS makes the dark logo invisible against the dark background
- [ ] **Logo Branding:** Logo is embedded in the email — but it is base64-encoded, adding 20KB to the HTML size and potentially being blocked by enterprise email security gateways
- [ ] **Image Hosting:** Logo URL is in the template — but it is hosted on a generic shared CDN domain unrelated to aisanomat.fi, triggering deliverability flags

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| OG Image Extraction | Fetch hangs on slow/blocked sites | AbortController with 3s timeout, `Promise.allSettled()` for parallel fetches |
| OG Image Extraction | Generic site og:image treated as valid article image | URL heuristic check for `default`, `logo`, `placeholder` in path |
| OG Image Extraction | Relative og:image URL sent as email img src | Resolve against article origin with `new URL()` |
| AI Infographic Fallback | Gemini billing not enabled for image generation | Startup health check; verify billing before implementation |
| AI Infographic Fallback | Safety filter rejects AI-topic prompts | Visual metaphor prompts, not topic prompts; alternate prompt fallback |
| Structured HTML Content | Email HTML exceeds 102KB, Gmail clips it | Measure compiled HTML size in pipeline; alert at 80KB; truncate articles to fit |
| Structured HTML Content | CSS layout ignored by Outlook | Table-only layout via React Email primitives; test in Litmus pre-ship |
| Structured HTML Content | Tailwind `<Heading>` component styles don't apply | Use native `<h2>`, `<h3>` with explicit inline styles |
| Logo Branding | Logo invisible in dark mode | Provide dark-mode logo variant; wrap in white `bgcolor` table cell |
| Logo Branding | Base64 logo inflates HTML size | Host logo on aisanomat.fi; use hosted URL, never base64 |
| Logo Branding | Image CDN domain differs from sending domain | Host all static assets on aisanomat.fi domain |

---

## Integration Gotchas (v1.2 Specific)

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OG Scraping | `Promise.all()` for parallel fetches — one failure aborts all | Use `Promise.allSettled()` — treat each OG fetch as independent |
| OG Scraping | Trusting og:image without validating it is article-specific | Check URL path for generic image indicators; validate image is reachable |
| OG Scraping | Fetching OG on every digest generation | Cache by article URL with 24h TTL in the database |
| React Email | Using `<Heading>` component with Tailwind classes | Use native `<h2>` / `<h3>` with inline `style` prop |
| React Email | Not measuring compiled HTML size | Add `Buffer.byteLength(renderedHtml, 'utf8')` logging before every send |
| React Email | Using CSS `background-color` for highlight boxes | Use `bgcolor` attribute on table cells for Outlook compatibility |
| Gemini Image API | Assuming text generation key works for image generation | Verify billing enabled; add startup health check for image quota |
| Gemini Image API | No retry logic for transient 429 errors | Exponential backoff: 2s, 4s, 8s; give up after 3 attempts |
| Gemini Image API | Prompt contains article subject matter directly | Use visual metaphor prompts describing chart/icon style, not article topic |
| Email Images | Hosting logo on shared CDN or free image host | Host on `aisanomat.fi` subdirectory or subdomain |
| Email Images | Using base64 for logo | Always use hosted HTTPS URL |
| Email Images | No `width`/`height` attributes on `<img>` | Set both HTML attributes (not CSS) on all images |

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| OG fetch hangs and times out in production | LOW | Timeouts self-resolve; add AbortController with 3s limit and redeploy |
| Gmail clips newsletter (>102KB HTML) | MEDIUM | Revert to fewer articles or less structured content per article; measure and tune |
| Outlook layout broken for enterprise client | HIGH | Emergency rollback to previous template; test with Litmus; fix table structure; trust damage is the real cost |
| Gemini image API returns empty (billing issue) | LOW | Enable billing; articles render without images until next issue; no data loss |
| Logo invisible in dark mode (client complaint) | MEDIUM | Prepare light-version logo PNG; deploy new template; send re-issue or include in next newsletter |
| Safety filter blocking infographic prompts | LOW | Adjust prompt to visual metaphors only; redeploy; no existing data affected |

---

## Sources

- [React Email Headings with Tailwind — community discussion](https://www.tempmail.us.com/en/react/why-headings-don-t-work-with-tailwind-in-react-email) — MEDIUM confidence
- [React Email Dark Mode — GitHub Discussion #591](https://github.com/resend/react-email/discussions/591) — HIGH confidence (official repo)
- [React Email Dark Mode Tailwind Issue — GitHub #999](https://github.com/resend/react-email/issues/999) — HIGH confidence (official repo)
- [Gmail Clipping at 102KB — Email Bug Tracker](https://github.com/hteumeuleu/email-bugs/issues/41) — HIGH confidence
- [Gmail Clipping Explained — SpamResource](https://www.spamresource.com/2022/01/what-is-gmail-clipping-and-what-to-do.html) — HIGH confidence
- [Email Client Rendering Differences 2026 — DEV Community](https://dev.to/aoifecarrigan/the-complete-guide-to-email-client-rendering-differences-in-2026-243f) — MEDIUM confidence
- [Outlook HTML Email Rendering Issues — Email on Acid](https://www.emailonacid.com/blog/article/email-development/how-to-code-emails-for-outlook/) — HIGH confidence
- [Email HTML Best Practices — WooCommerce Developer Docs](https://developer.woocommerce.com/docs/features/email/email-html-best-practices/) — MEDIUM confidence
- [Image to Text Ratio 2025 — EmailConsul](https://emailconsul.com/blog/%F0%9F%93%AC-text-to-image-ratio-in-email-deliverability-why-it-still-matters-in-2025/) — MEDIUM confidence
- [Image to Text Ratio — Email on Acid](https://www.emailonacid.com/blog/article/email-deliverability/does-text-to-image-ratio-affect-deliverability/) — HIGH confidence
- [Base64 Images in Email — SendCheckIt](https://sendcheckit.com/blog/base64-encoding-images-emails) — MEDIUM confidence
- [CDN Domain Reputation for Email — Suped](https://www.suped.com/knowledge/email-deliverability/sender-reputation/does-using-a-different-domain-for-cdn-hosted-images-in-emails-affect-deliverability) — MEDIUM confidence
- [OG Meta Tags Common Issues — DEV Community](https://dev.to/riyanegi/solving-issues-with-og-meta-tags-a-comprehensive-guide-22c2) — MEDIUM confidence
- [Open Graph Meta Tags — og-image.org](https://og-image.org/learn) — MEDIUM confidence
- [OG Scraping JS SPAs Challenge — Prerender.io](https://prerender.io/blog/benefits-of-using-open-graph/) — MEDIUM confidence
- [open-graph-scraper npm package](https://www.npmjs.com/package/open-graph-scraper) — HIGH confidence (official)
- [Gemini API Rate Limits — Official Documentation](https://ai.google.dev/gemini-api/docs/rate-limits) — HIGH confidence (official)
- [Gemini Free Tier 0 IPM for Image Generation — AI Free API](https://www.aifreeapi.com/en/posts/gemini-api-rate-limit) — MEDIUM confidence (corroborated by multiple sources)
- [Gemini IMAGE_SAFETY false positives — Google AI Developers Forum](https://discuss.ai.google.dev/t/nano-banana-pro-suddenly-blocking-non-nsfw-ecommerce-underwear-images-with-image-safety-error/113109) — HIGH confidence (official forum)
- [Gmail Gemini AI Impact on Deliverability 2026 — Folderly](https://folderly.com/blog/gmail-gemini-ai-email-deliverability-2026) — MEDIUM confidence
- [Email Image Deliverability — GetVero](https://www.getvero.com/resources/email-image/) — MEDIUM confidence

---
*Pitfalls research for: AI-Sanomat Yrityksille v1.2 — Newsletter Quality and Design*
*Researched: 2026-03-04*
