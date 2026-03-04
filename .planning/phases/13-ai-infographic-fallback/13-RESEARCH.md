# Phase 13: AI Infographic Fallback - Research

**Researched:** 2026-03-04
**Domain:** Conditional image sourcing (OG vs Gemini), URL routing in email rendering, Gemini safety filters
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| IMAGE-03 | Jos OG-kuvaa ei loydy, generoidaan AI-infograafi joka selittaa uutisen sisaltoa | `newsletterService.ts` must look up `newsItems.ogImageUrl` via `story.sourceUrl === newsItem.url`; only stories with null `ogImageUrl` get Gemini-generated infographic via existing `generateImage()` in `geminiClient.ts` |
| IMAGE-04 | Jos AI-infograafikaan ei onnistu, uutinen naytetaan ilman kuvaa | Story `imageUrl` must be `undefined` (not a placeholder path) when both OG and Gemini fail; `DigestEmail.tsx` already conditionally renders images with `{story.imageUrl && ...}` so no broken tags appear |
</phase_requirements>

---

## Summary

Phase 13 changes the image sourcing strategy from "always generate all images with Gemini" to a conditional three-tier fallback: (1) use the OG image from the source article if available, (2) generate a Gemini infographic as fallback for stories without OG images, (3) render cleanly without any image if both fail.

The primary change is in `newsletterService.ts` where the digest generation pipeline currently generates Gemini images for ALL stories unconditionally. After this phase, the pipeline must first look up each story's `ogImageUrl` from the `newsItems` table (matched via `story.sourceUrl === newsItem.url`), and only request Gemini image generation for stories where `ogImageUrl` is null. A critical secondary change is in `emailService.ts` where `toImageUrl()` currently prefixes ALL image paths with `${baseUrl}/api` -- this breaks remote OG image URLs (e.g., `https://cdn.example.com/photo.jpg` would become `http://localhost:3000/api/https://cdn.example.com/photo.jpg`). The function must detect absolute URLs and pass them through unchanged.

The `DigestEmail.tsx` template already handles the "no image" case correctly: `{story.imageUrl && (<Img .../>)}` renders nothing when `imageUrl` is undefined. The current placeholder pattern (`PLACEHOLDER_IMAGE_URL = '/images/placeholder.png'`) should be eliminated in favor of `undefined` for IMAGE-04 compliance (no broken image tags when no actual placeholder file exists).

**Primary recommendation:** Modify `newsletterService.ts` to build an `ogImageUrl` lookup map from `newsItems` by URL, skip Gemini generation for stories with OG images, fix `toImageUrl()` to detect and pass through absolute URLs, and replace placeholder fallback with `undefined` for clean no-image rendering.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/genai` | ^1.43.0 | Gemini image generation for infographic fallback | Already installed and used in `geminiClient.ts`; `generateImage()` function exists |
| `drizzle-orm` | ^0.45.0 | Query `newsItems.ogImageUrl` by URL for OG image lookup | Already installed; standard DB access layer |

### Supporting

No new libraries needed. All required infrastructure exists:
- `geminiClient.ts` -- `generateImage(prompt, width, height)` returns `/images/{uuid}.png` or `null`
- `imageService.ts` -- `generateDigestImages(imagePrompts)` orchestrates sequential generation
- `ogService.ts` -- `isGenericImageUrl()` for URL validation (already active from Phase 11)
- `emailService.ts` -- `toImageUrl()` for URL construction (needs modification)

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Gemini `gemini-2.5-flash-image` for infographics | DALL-E 3 via `openai` (already installed) | Would add a second image generation provider; Gemini is already wired up and paid for |
| Query `newsItems` by URL in newsletterService | Pass `ogImageUrl` through Claude's digest JSON | Would require prompt changes and schema changes; URL lookup is simpler and decoupled |
| `URL` constructor for absolute URL detection | Simple `startsWith('http')` check | `URL` constructor is heavier and unnecessary; `http://` and `https://` prefix check covers all real-world cases |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

---

## Architecture Patterns

### Recommended File Changes

```
api/src/services/
  newsletterService.ts   # MODIFIED -- OG lookup + conditional Gemini generation
  imageService.ts        # MODIFIED -- accept partial story indices, skip stories with OG images
  emailService.ts        # MODIFIED -- fix toImageUrl() for absolute URLs
api/src/integrations/
  geminiClient.ts        # MODIFIED -- remove PLACEHOLDER_IMAGE_URL usage, return null on failure
```

### Pattern 1: OG Image Lookup Map

**What:** Before generating images, build a Map from `story.sourceUrl` to `ogImageUrl` by querying `newsItems` with the digest's source URLs.

**When to use:** During digest generation, after Claude produces the digest content but before image generation.

**Example:**
```typescript
// newsletterService.ts -- after digest generation (step 5), before image generation (step 9)
import { inArray } from 'drizzle-orm';

// Build OG image lookup from newsItems
const storyUrls = digest.stories.map((s) => s.sourceUrl);
const ogRows = await db
  .select({ url: newsItems.url, ogImageUrl: newsItems.ogImageUrl })
  .from(newsItems)
  .where(inArray(newsItems.url, storyUrls));

const ogImageMap = new Map(
  ogRows
    .filter((r) => r.ogImageUrl !== null)
    .map((r) => [r.url, r.ogImageUrl!])
);
```

**Confidence:** HIGH -- `inArray` is standard Drizzle; `newsItems.url` is indexed (unique constraint).

### Pattern 2: Conditional Gemini Generation

**What:** Only generate Gemini images for stories that lack an OG image. Stories with OG images use the remote URL directly.

**When to use:** Replace the current unconditional `generateDigestImages(imagePrompts)` call.

**Example:**
```typescript
// Identify which stories need Gemini generation
const storiesNeedingImages = digest.stories
  .map((story, i) => ({ story, index: i }))
  .filter(({ story }) => !ogImageMap.has(story.sourceUrl));

// Only generate prompts and images for stories without OG images
let geminiImageMap = new Map<number, string>(); // index -> local path
if (storiesNeedingImages.length > 0) {
  // Generate image prompts only for stories needing them
  const promptsForMissing = /* generate prompts for storiesNeedingImages */;
  // Generate Gemini images sequentially
  for (let j = 0; j < storiesNeedingImages.length; j++) {
    const result = await generateImage(promptsForMissing[j], 800, 450);
    if (result) {
      geminiImageMap.set(storiesNeedingImages[j].index, result);
    }
  }
}

// Merge: OG image > Gemini image > undefined (no image)
const updatedStories = digest.stories.map((story, i) => ({
  ...story,
  imageUrl: ogImageMap.get(story.sourceUrl)     // 1st: OG image (remote URL)
    ?? geminiImageMap.get(i)                      // 2nd: Gemini image (local path)
    ?? undefined,                                 // 3rd: no image
}));
```

**Confidence:** HIGH -- follows existing sequential generation pattern from `imageService.ts`.

### Pattern 3: Fix toImageUrl() for Absolute URLs

**What:** Detect absolute URLs (starting with `http://` or `https://`) and return them unchanged. Only prefix relative paths with the API base URL.

**When to use:** In `emailService.ts` when constructing story image URLs.

**Example:**
```typescript
// emailService.ts
const toImageUrl = (imgPath: string) => {
  // OG image URLs are absolute -- pass through unchanged
  if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
    return imgPath;
  }
  // Local Gemini-generated images need API base URL prefix
  const path = imgPath.startsWith('/') ? imgPath : `/${imgPath}`;
  return `${baseUrl}/api${path}`;
};
```

**Confidence:** HIGH -- this is the exact fix described in the Phase 13 success criteria ("OG image URLs pass through toImageUrl() unchanged -- remote http:// URLs are not prefixed with the API base URL").

### Anti-Patterns to Avoid

- **Downloading OG images locally:** Do NOT fetch and store OG images on the server. Use remote URLs directly in email `<img src>` -- email clients fetch images at render time.
- **Placeholder image fallback:** Do NOT use `PLACEHOLDER_IMAGE_URL` as a fallback. When both OG and Gemini fail, set `imageUrl` to `undefined` so no `<Img>` tag is rendered (IMAGE-04).
- **Generating image prompts for all stories:** Do NOT call `generateImagePrompts()` for stories that already have OG images. This wastes Claude API calls and Gemini API calls.
- **Modifying DigestStory type for ogImageUrl:** Do NOT add `ogImageUrl` to the `DigestStory` type. The OG image lookup is a pipeline concern in `newsletterService.ts`, not a digest content concern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL matching between stories and newsItems | Custom string normalization + fuzzy matching | Exact `WHERE url IN (...)` via Drizzle `inArray` | Claude generates `sourceUrl` from the same `newsItems.url` values; they match exactly |
| Absolute URL detection | `URL` constructor + try/catch | `string.startsWith('http://')` or `startsWith('https://')` | Simpler, faster, covers all real-world cases for OG image URLs |
| Sequential Gemini generation with error handling | Custom retry/queue logic | Existing `generateImage()` in `geminiClient.ts` + try/catch returning `null` | Already handles all edge cases; just need to wrap per-story instead of bulk |

**Key insight:** The infrastructure for both OG images (Phase 11) and Gemini generation (original pipeline) already exists. This phase is pure orchestration -- connecting existing pieces with conditional logic.

---

## Common Pitfalls

### Pitfall 1: toImageUrl() Corrupting Remote OG URLs

**What goes wrong:** An OG image URL like `https://cdn.reuters.com/photo.jpg` gets turned into `http://localhost:3000/api/https://cdn.reuters.com/photo.jpg` -- a broken URL that shows a missing image in the email.

**Why it happens:** The current `toImageUrl()` unconditionally prepends `${baseUrl}/api` to every image path. It was designed when all images were local Gemini-generated files.

**How to avoid:** Add an absolute URL check at the top of `toImageUrl()`: if the path starts with `http://` or `https://`, return it unchanged.

**Warning signs:** Story images show broken/missing in emails despite `ogImageUrl` being populated in the database.

### Pitfall 2: Placeholder Image Creating Broken Tags

**What goes wrong:** When Gemini fails, the current code falls back to `PLACEHOLDER_IMAGE_URL` (`/images/placeholder.png`). This file doesn't actually exist on the server (the uploads/images directory only has `.gitkeep`). The email renders a broken image tag.

**Why it happens:** `PLACEHOLDER_IMAGE_URL` was defined as a constant but no actual placeholder file was ever created.

**How to avoid:** When both OG and Gemini fail, set `imageUrl` to `undefined` instead of the placeholder path. `DigestEmail.tsx` already handles `undefined` correctly with `{story.imageUrl && (<Img .../>)}`.

**Warning signs:** `<img src="http://...api/images/placeholder.png">` tags in sent emails that show broken image icons.

### Pitfall 3: sourceUrl Not Matching newsItem.url

**What goes wrong:** The OG image lookup query returns zero matches because `story.sourceUrl` in the Claude-generated digest doesn't exactly match `newsItems.url` in the database.

**Why it happens:** Claude might normalize URLs (strip trailing slashes, change scheme, etc.) when generating the digest. The seed prompt template instructs Claude to "use the original URL from the news list" but doesn't enforce it.

**How to avoid:** This is LOW risk because the prompt explicitly includes `(${item.url})` in the formatted news and instructs Claude to use it as `sourceUrl`. Verify by checking a few real digests. If mismatches occur, consider URL normalization (strip trailing slash, lowercase hostname).

**Warning signs:** Stories that should have OG images always get Gemini fallback instead. Check `ogImageMap.size` vs expected count in logs.

### Pitfall 4: Gemini Safety Filter Blocking AI-Topic Prompts

**What goes wrong:** The image prompt for a story about "GPT-5 release" or "AI regulation" gets rejected by Gemini's safety filter, returning no image.

**Why it happens:** STATE.md documents this: "Gemini safety filter rejects AI-topic prompts -- use visual metaphor prompts, not article subject matter." The current `kuvapromptit` prompt template may generate prompts that directly reference AI technology.

**How to avoid:** Ensure image prompts use visual metaphors (e.g., "flowing data streams in a modern office" instead of "GPT-5 language model"). The prompt template for image generation should emphasize abstract/metaphorical visuals. When Gemini returns `null`, the story simply renders without an image (IMAGE-04).

**Warning signs:** `generateImage()` returns `null` frequently; check Gemini response for `finishReason: 'SAFETY'`.

### Pitfall 5: Hero Image Still Using Placeholder

**What goes wrong:** The hero image generation fails and falls back to `PLACEHOLDER_IMAGE_URL`, but since no placeholder file exists, the hero section shows a broken image.

**Why it happens:** `imageService.ts` currently uses `PLACEHOLDER_IMAGE_URL` as fallback for hero image failures.

**How to avoid:** Apply the same `undefined` fallback to the hero image. `DigestEmail.tsx` already handles `{heroImageUrl && (<Img .../>)}`.

**Warning signs:** Broken hero image in emails when Gemini generation fails.

---

## Code Examples

Verified patterns from codebase inspection and official sources:

### Drizzle inArray Query for OG Lookup

```typescript
// Source: drizzle-orm docs + existing codebase patterns
import { inArray } from 'drizzle-orm';

const storyUrls = digest.stories.map((s) => s.sourceUrl);
const ogRows = await db
  .select({ url: newsItems.url, ogImageUrl: newsItems.ogImageUrl })
  .from(newsItems)
  .where(inArray(newsItems.url, storyUrls));
```

### Fixed toImageUrl() with Absolute URL Detection

```typescript
// Source: emailService.ts (modified)
const toImageUrl = (imgPath: string) => {
  // Remote OG images: pass through absolute URLs unchanged
  if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
    return imgPath;
  }
  // Local Gemini images: prefix with API base URL
  const path = imgPath.startsWith('/') ? imgPath : `/${imgPath}`;
  return `${baseUrl}/api${path}`;
};
```

### Conditional Story Image Assignment

```typescript
// Source: newsletterService.ts (modified step 11)
const updatedStories = digest.stories.map((story, i) => ({
  ...story,
  imageUrl: ogImageMap.get(story.sourceUrl)   // OG image (absolute URL)
    ?? geminiUrls[i]                            // Gemini image (local path) or undefined
    ?? undefined,                               // No image -- clean render
}));
```

### Gemini generateImage with null Return (no placeholder)

```typescript
// Source: geminiClient.ts (existing -- already returns null on failure)
export async function generateImage(
  prompt: string,
  _width: number,
  _height: number
): Promise<string | null> {
  // ... generates image, returns /images/{uuid}.png or null
}
```

### DigestEmail Conditional Image Rendering (already correct)

```tsx
// Source: DigestEmail.tsx line 154-167 (existing -- no change needed)
{story.imageUrl && (
  <Img
    src={story.imageUrl}
    alt={story.title}
    width="552"
    style={{
      width: '100%',
      maxWidth: '552px',
      height: 'auto',
      borderRadius: '8px',
      display: 'block',
      marginBottom: '12px',
    }}
  />
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All stories get Gemini images unconditionally | OG image preferred, Gemini only for missing | Phase 13 (this phase) | Reduces Gemini API costs; shows more relevant source photos |
| `PLACEHOLDER_IMAGE_URL` fallback on failure | `undefined` -- no image element rendered | Phase 13 (this phase) | Eliminates broken image tags; clean email rendering |
| `toImageUrl()` prefixes all paths | Absolute URLs pass through unchanged | Phase 13 (this phase) | OG images render correctly from remote CDNs |
| Gemini safety: default settings | Should consider `safetySettings` for visual metaphors | Phase 13 (this phase) | Gemini 2.5+ defaults to `Off` for safety thresholds; explicit visual metaphor prompts are the better mitigation |

**Gemini Safety Settings Note:** According to official Gemini API documentation (verified via Context7), default safety thresholds for Gemini 2.5+ models are `Off` (no blocking). The safety filter issue documented in STATE.md ("Gemini safety filter rejects AI-topic prompts") likely occurs because the image generation prompt directly references AI/tech subjects. The fix is prompt engineering (visual metaphors) rather than safety setting changes. However, if needed, explicit `safetySettings` can be added to `generateContent()` config:

```typescript
config: {
  responseModalities: ['IMAGE'],
  safetySettings: [
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
  ],
}
```

---

## Open Questions

1. **Image prompt generation for partial stories**
   - What we know: Currently `generateImagePrompts()` asks Claude to generate prompts for ALL stories in the digest. Phase 13 only needs prompts for stories WITHOUT OG images.
   - What's unclear: Should we modify the `kuvapromptit` prompt template to accept a subset of stories, or filter the Claude-generated prompts after the fact?
   - Recommendation: Pass only the stories needing images to Claude. This saves tokens and avoids generating unused prompts. Modify the `imageSystemPrompt` to include only stories without OG images. Then `sectionPrompts` array will match 1:1 with the stories needing Gemini generation.
   - Confidence: MEDIUM -- needs validation that the prompt template works with fewer stories.

2. **Hero image strategy**
   - What we know: The current pipeline generates a hero image via Gemini. Phase 13 focuses on per-story images. The hero image has no corresponding OG image source.
   - What's unclear: Should the hero image still be Gemini-generated? Or should it be removed/simplified?
   - Recommendation: Keep hero image generation unchanged for now. If Gemini fails, set `heroImageUrl` to `null` instead of placeholder. The email template already handles `null` hero images.
   - Confidence: HIGH -- hero image is orthogonal to the per-story OG/Gemini fallback logic.

3. **Gemini billing verification**
   - What we know: STATE.md lists a pending todo: "Verify Gemini billing enabled for image generation before Phase 13 (free tier is 0 IPM)"
   - What's unclear: Whether the production environment has billing enabled for `gemini-2.5-flash-image` model.
   - Recommendation: This is a deployment concern, not a code concern. The code should handle `null` returns from `generateImage()` gracefully (which it already does). The user should verify billing is active before deploying.
   - Confidence: HIGH for code; deployment concern is out of scope for the plan.

---

## Sources

### Primary (HIGH confidence)

- `/Users/janne/coding/ai-sanomat-yrityksille/api/src/services/newsletterService.ts` -- Current digest generation pipeline showing all-Gemini image flow (lines 183-204)
- `/Users/janne/coding/ai-sanomat-yrityksille/api/src/services/emailService.ts` -- `toImageUrl()` function at lines 32-35 showing the current prefix-all behavior
- `/Users/janne/coding/ai-sanomat-yrityksille/api/src/emails/DigestEmail.tsx` -- Conditional image rendering at line 154 (`story.imageUrl && ...`)
- `/Users/janne/coding/ai-sanomat-yrityksille/api/src/integrations/geminiClient.ts` -- `generateImage()` returns `string | null`; `PLACEHOLDER_IMAGE_URL` constant
- `/Users/janne/coding/ai-sanomat-yrityksille/api/src/services/imageService.ts` -- `generateDigestImages()` showing placeholder fallback pattern
- `/Users/janne/coding/ai-sanomat-yrityksille/api/src/db/schema.ts` -- `newsItems.ogImageUrl` column (line 104)
- `/Users/janne/coding/ai-sanomat-yrityksille/api/src/types/digest.ts` -- `DigestStory.sourceUrl` field used for OG lookup matching
- Context7: `@google/genai` JS SDK (`/googleapis/js-genai`) -- `generateContent` with `responseModalities: ['IMAGE']`, safety settings API
- Context7: Gemini API docs (`/websites/ai_google_dev_gemini-api`) -- Safety filter categories, threshold levels, default Off for Gemini 2.5+

### Secondary (MEDIUM confidence)

- `/Users/janne/coding/ai-sanomat-yrityksille/.planning/STATE.md` -- Blocker note about Gemini safety filter rejecting AI-topic prompts; pending todo about Gemini billing
- `/Users/janne/coding/ai-sanomat-yrityksille/.planning/phases/11-og-image-extraction/11-01-SUMMARY.md` -- Confirms OG image pipeline is operational

### Tertiary (LOW confidence)

- Visual metaphor prompt strategy for avoiding Gemini safety rejections -- derived from STATE.md blocker note; no authoritative source on optimal prompt patterns for Gemini image model safety filter bypass

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies; all libraries already installed and used in codebase
- Architecture: HIGH -- all three changes (OG lookup, conditional generation, toImageUrl fix) are well-understood transformations of existing code with clear success criteria
- Pitfalls: HIGH -- toImageUrl corruption and placeholder issues are verified against actual code; sourceUrl matching risk is LOW based on prompt analysis
- Gemini safety: MEDIUM -- prompt engineering approach is sound but specific prompt patterns need testing

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (no fast-moving dependencies; changes are to application logic, not library APIs)
