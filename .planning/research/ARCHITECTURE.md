# Architecture Patterns

**Domain:** AI newsletter platform — v1.2 Newsletter Quality & Design
**Researched:** 2026-03-04
**Focus:** Integration of OG image extraction, structured content, AI infographics, and logo branding into existing pipeline

---

## Existing Pipeline (Baseline)

Understanding the current flow is essential before identifying where new features plug in.

```
newsCollectorService.collectAllNews()
  ├── RSS / Beehiiv / Tavily / X → newsItems table
  └── embeds → deduplication flags

newsletterService.generateClientDigest(clientId)
  ├── 1. Fetch client + newsItems (last 30, desc collectedAt)
  ├── 2. fillTemplate() → generationSystemPrompt
  ├── 3. claudeClient.generateDigest()  → DigestContent { intro, stories[], closing }
  ├── 4. claudeClient.validateDigest()  → ValidationReport
  ├── 5. claudeClient.generateImagePrompts() → ImagePrompts { heroPrompt, sectionPrompts[] }
  ├── 6. imageService.generateDigestImages() → Gemini → { heroUrl, sectionUrls[] }
  └── 7. DB update: issues.generatedContent (JSON), issues.heroImageUrl

emailService.renderDigestEmail(issue, client, feedbackUrls)
  ├── JSON.parse(issue.generatedContent) → DigestEmailDigest
  ├── toImageUrl() → absolute URLs from relative /images/{uuid}.png paths
  └── render(DigestEmail(props)) → { html, text }

emailService.sendDigestToClient(issueId)
  └── per-member render → feedbackUrls → Resend batch send
```

### Key Data Shapes (Current)

```typescript
// digest.ts — what Claude currently produces
interface DigestStory {
  title: string;
  businessImpact: string;  // single text block — the problem we're solving
  sourceUrl: string;
}

// DigestEmail.tsx — what React Email renders per story
interface DigestEmailStory extends DigestStory {
  imageUrl?: string;  // relative path from Gemini, converted to absolute before render
}
```

### Image Storage (Current)

- Gemini writes to `{IMAGE_STORAGE_PATH}/images/{uuid}.png` on disk
- Fastify serves via `/api/images/{uuid}.png` static route
- Absolute URL built in emailService: `${PUBLIC_URL}/api/images/${uuid}`
- `issues.heroImageUrl` stores the relative path (`/images/{uuid}.png`)
- Per-story imageUrl stored inside `issues.generatedContent` JSON blob

---

## Feature 1: OG Image Extraction

### Where It Plugs In

OG images belong in the **news collection phase**, not the digest generation phase. Each `newsItem` has a known `url` at collection time, so OG metadata should be fetched and stored alongside the article — before generation ever runs.

**Integration point:** `newsCollectorService.ts` — after inserting a newsItem, enrich it with OG data.

### Recommended Approach

**Library:** `open-graph-scraper` (npm: `open-graph-scraper`) — actively maintained, returns `ogImage` array with `url`, `width`, `height`, `type`. Falls back to Twitter card images automatically. No external API required.

**Storage:** Add `ogImageUrl TEXT` column to `newsItems` table. This keeps OG data co-located with the article and avoids a separate lookup table.

**Caching:** No separate cache table needed. The `newsItems.url` unique constraint prevents re-inserting the same article, so OG fetch happens exactly once per URL. The `searchCache` table pattern exists for Tavily — OG does not need that because it is per-article, not per-query.

**Fetch timing:** Opportunistic — fetch OG image at collection time, non-blocking. If fetch fails, `ogImageUrl` stays null. Do not block news insertion on OG fetch failure.

### Data Flow (New)

```
newsCollectorService.collectAllNews()
  └── for each newly inserted newsItem:
        ├── ogService.fetchOgImage(item.url) → string | null
        └── db.update(newsItems).set({ ogImageUrl }) [non-blocking, error caught]
```

### Schema Change Required

```typescript
// newsItems table — add one column
ogImageUrl: text('og_image_url'),  // nullable, fetched at collection time
```

### How OG Image Flows to Email

In `newsletterService.generateClientDigest()`, when building `formattedNews` for Claude's prompt, include `ogImageUrl` so Claude knows a high-quality image is available. Claude then populates `story.imageUrl` with the OG URL for that story, displacing the Gemini-generated section image. See Feature 3 for the conditional fallback logic.

---

## Feature 2: Structured Content

### Where It Plugs In

This is a **Claude prompt + JSON schema change** in the digest generation step. The current `DigestStory.businessImpact` is a single string. The goal is subheadings, lists, bold highlights — richer structure within each story.

**Integration points:**
1. `api/src/types/digest.ts` — TypeScript types + JSON schema
2. `viikkokatsaus_generointi` prompt template in the DB (admin panel, no code deploy)
3. `api/src/emails/DigestEmail.tsx` — render new structure
4. New file: `api/src/emails/StoryContent.tsx`

### Recommended Approach

**Do not use Markdown strings.** React Email renders HTML, not Markdown. Embedding Markdown in JSON and parsing it at render time adds a conversion dependency. Instead, use a structured sub-schema so Claude outputs semantic fields that React Email components render directly.

**New `DigestStory` shape:**

```typescript
interface DigestStoryBlock {
  type: 'paragraph' | 'list' | 'highlight';
  text?: string;           // for paragraph and highlight
  items?: string[];        // for list
}

interface DigestStory {
  title: string;
  lead: string;             // one-sentence hook (replaces first sentence of businessImpact)
  contentBlocks: DigestStoryBlock[];  // 2-4 blocks: mix of paragraphs, lists, highlights
  sourceUrl: string;
  imageUrl?: string;        // set by Claude from OG context, or null for Gemini fallback
}
```

**JSON Schema change:** Update `digestJsonSchema` in `digest.ts` to reflect this structure. Claude's structured output enforces the schema at token-generation time — output is guaranteed to match.

**Prompt template change:** Update `viikkokatsaus_generointi` in DB to instruct Claude to populate `contentBlocks` with varied types. Prompt updated via admin panel, no code deploy required.

**Backward compatibility:** `generatedContent` is a JSON blob — old issues with old schema remain valid. Only new digests use the new shape. `renderDigestEmail` parses from `generatedContent` at render time and can conditionally handle both shapes during transition if needed.

### React Email Component Change

`DigestEmail.tsx` currently renders `{story.businessImpact}` as a single `<Text>` block. Replace with a `StoryContent` sub-component that maps over `story.contentBlocks`:

```typescript
// New file: api/src/emails/StoryContent.tsx
// Renders each block type as appropriate React Email elements:
// - paragraph  → <Text>
// - list       → inline <ul>/<li> with email-safe inline styles
// - highlight  → <Text> with bold/teal accent styling
```

This is a **new file**, not a modification of DigestEmail.tsx beyond the import swap.

---

## Feature 3: AI Infographic Fallback

### Where It Plugs In

This is a **modification to `newsletterService.ts`** — the orchestration logic between OG image data and Gemini image generation. `imageService.ts` itself does not change.

**Integration point:** `newsletterService.generateClientDigest()` — step 6 (image generation) becomes conditional per story.

### Recommended Approach

Keep `imageService.ts` and `geminiClient.ts` unchanged. The conditional logic belongs in the orchestrator:

```typescript
// In newsletterService.generateClientDigest(), after Claude generates stories:

// Identify which stories need a Gemini image (no OG image set by Claude)
const storiesNeedingImage = digest.stories
  .map((story, i) => ({ story, i, needsImage: !story.imageUrl }));

// Only generate image prompts and Gemini images for stories without OG images
const promptsForGeneration = imagePrompts.sectionPrompts
  .filter((_, i) => storiesNeedingImage[i]?.needsImage);

// Call Gemini only for stories that need it
// Merge results back: OG stories keep their URL, others get Gemini UUID paths
```

**Hero image:** Always Gemini-generated. The hero is a digest-level editorial infographic, not tied to any single article's OG image.

**Gemini call count reduction:** If 3 of 4 stories have OG images, only 1 Gemini image is generated instead of 4. This reduces generation time significantly.

### Decision Tree

```
generateClientDigest pipeline — image resolution:

  For hero image:
    → Always generate via Gemini (imagePrompts.heroPrompt)

  For each story[i]:
    ├── story.imageUrl set? (Claude picked up OG image from prompt context)
    │     └── YES → use story.imageUrl as-is (absolute remote OG URL)
    └── NO → generate Gemini infographic using imagePrompts.sectionPrompts[i]
              └── store result as relative /images/{uuid}.png path
```

### OG URL Reliability

OG image URLs are remote third-party URLs that may become unavailable after collection. Mitigation: at collection time in `ogService.ts`, do a HEAD request to verify the URL returns 2xx before storing it. If verification fails, store null. This is a one-time check at collection, not at render time.

---

## Feature 4: Logo in Header

### Where It Plugs In

This is a **single-file modification to `DigestEmail.tsx`**, specifically the `BRAND HEADER` section (lines 90-98). Currently renders "AI-Sanomat" as a plain `<Text>` element.

**Integration point:** `api/src/emails/DigestEmail.tsx` — replace text-only header with `<Img>` + text.

### Recommended Approach

**Use a remote URL, not base64.** Gmail blocks base64 images entirely. Outlook has partial support. Remote URLs work across all major email clients (Gmail, Outlook, Apple Mail, Yahoo). [Confidence: HIGH — verified via caniemail.com]

**Host the logo at:** `https://aisanomat.fi/logo.png` — the marketing site, not the Railway API server. This is the most stable URL, not dependent on Railway deployment state, and decouples email delivery from API server health.

**Component change (minimal):**

```tsx
{/* BRAND HEADER — modify existing Section */}
<Section className="pt-[32px] pb-[16px] px-[24px] text-center">
  <Img
    src="https://aisanomat.fi/logo.png"
    alt="AI-Sanomat"
    width="48"
    height="48"
    style={{ display: 'block', margin: '0 auto 8px' }}
  />
  <Text className="text-[30px] font-bold text-[#111111] m-0 email-heading">
    AI-Sanomat
  </Text>
  <Text className="text-[14px] text-[#666666] m-0 mt-[4px] email-muted">
    {clientName} | {clientIndustry}
  </Text>
</Section>
```

**No new service, no schema change.** One small edit to one file. The logo URL can be a prop or hardcoded constant — hardcoded is fine since there is no per-client logo variation in scope for v1.2.

**Deployment precondition:** Logo PNG must exist at the URL before the first newsletter using the new template is sent. This is an asset upload task, not a code dependency.

---

## Component Boundaries — New vs Modified

| Component | New or Modified | What Changes |
|-----------|----------------|--------------|
| `api/src/services/ogService.ts` | **NEW** | OG image fetching with `open-graph-scraper`, exported as `fetchOgImage(url): Promise<string \| null>` |
| `api/src/services/newsCollectorService.ts` | **MODIFIED** | Call `ogService.fetchOgImage()` after newsItem insert, update `ogImageUrl` column |
| `api/src/db/schema.ts` | **MODIFIED** | Add `ogImageUrl` column to `newsItems` |
| `api/src/db/migrations/` | **NEW** | Drizzle migration for `og_image_url` column |
| `api/src/types/digest.ts` | **MODIFIED** | Extend `DigestStory` with `lead`, `contentBlocks[]`; update `digestJsonSchema` |
| `api/src/services/newsletterService.ts` | **MODIFIED** | Pass OG context to Claude prompt; conditional Gemini generation per story |
| `api/src/services/imageService.ts` | **NOT CHANGED** | Gemini logic unchanged |
| `api/src/emails/DigestEmail.tsx` | **MODIFIED** | Add logo `<Img>` to header; swap `businessImpact` for `<StoryContent>` component |
| `api/src/emails/StoryContent.tsx` | **NEW** | Renders `contentBlocks[]` array as email-safe HTML elements |
| `api/src/integrations/claudeClient.ts` | **NOT CHANGED** | `generateDigest()` accepts any valid JSON schema — schema change is in types only |
| `api/src/integrations/geminiClient.ts` | **NOT CHANGED** | Image generation logic unchanged |
| DB prompt `viikkokatsaus_generointi` | **MODIFIED (DB)** | Updated via admin panel to use new structured output fields; no code deploy |

---

## Data Flow — Full Picture After v1.2

```
COLLECTION PHASE
newsCollectorService.collectAllNews()
  ├── insert newsItem (title, url, summary, content, publishedAt)
  └── ogService.fetchOgImage(url) → ogImageUrl [non-blocking, best-effort]
        └── HEAD verify → if 2xx → db.update(newsItems).set({ ogImageUrl })

GENERATION PHASE
newsletterService.generateClientDigest(clientId)
  ├── Fetch newsItems (now includes ogImageUrl)
  ├── Format news for Claude prompt:
  │     "- {title}: {summary} | ogImage: {ogImageUrl ?? 'none'} ({url})"
  ├── claudeClient.generateDigest()
  │     → DigestContent {
  │         intro,
  │         stories[{ title, lead, contentBlocks[], sourceUrl, imageUrl? }],
  │         closing
  │       }
  │       Claude sets story.imageUrl = ogImageUrl when high-quality OG image found
  ├── claudeClient.validateDigest()
  ├── claudeClient.generateImagePrompts() [hero + only stories without imageUrl]
  ├── imageService.generateDigestImages() [Gemini — only for stories needing infographic]
  │     → { heroUrl, sectionUrls[] } (sectionUrls may be shorter than stories.length)
  └── Merge: stories with OG keep their URL; remaining get Gemini sectionUrls[j]
      └── db.update(issues): heroImageUrl, generatedContent (JSON with merged imageUrls)

RENDER PHASE
emailService.renderDigestEmail(issue, client, feedbackUrls)
  ├── JSON.parse(generatedContent) → DigestEmailDigest
  ├── toImageUrl(imgPath):
  │     if imgPath.startsWith('http') → return as-is (OG URLs)
  │     else → prepend ${baseUrl}/api (Gemini /images/{uuid}.png paths)
  └── render(DigestEmail(props))
        ├── Header: <Img src="https://aisanomat.fi/logo.png"> + "AI-Sanomat" text
        └── Per story:
              ├── <Img> (OG remote URL or Gemini absolute URL)
              ├── <Text>{story.title}</Text>
              ├── <Text>{story.lead}</Text>
              ├── <StoryContent blocks={story.contentBlocks} />
              └── <Link>{Lue lisaa}</Link>
```

---

## Patterns to Follow

### Pattern 1: Non-blocking Enrichment at Collection Time
**What:** OG fetch happens after newsItem is inserted, not as a prerequisite. Errors are caught and ignored.
**When:** Any enrichment that may fail or be slow and does not block core data collection.
**Precedent:** Existing source health logging in `newsCollectorService.ts` — `logFetchAttempt()` is called after collection, errors don't block processing.

```typescript
// After db.insert(newsItems) succeeds:
try {
  const ogImageUrl = await ogService.fetchOgImage(item.url);
  if (ogImageUrl) {
    await db.update(newsItems)
      .set({ ogImageUrl })
      .where(eq(newsItems.url, item.url));
  }
} catch {
  // OG fetch failure is non-fatal
}
```

### Pattern 2: Schema-First Structured Output
**What:** Define TypeScript interface + JSON schema in `digest.ts` first, then update Claude prompt template via admin panel.
**When:** Any Claude output shape change.
**Precedent:** `digestJsonSchema`, `validationJsonSchema`, `imagePromptsJsonSchema` in `digest.ts` — Claude enforces the schema at inference time, no runtime parsing guards needed.

### Pattern 3: Absolute vs Relative URL Split in toImageUrl
**What:** Gemini images are stored as relative paths and converted to absolute at render time. OG images and logos are already-absolute remote URLs and must pass through unchanged.
**When:** Any time mixed image origins exist.
**Implementation:** The `toImageUrl()` function in `emailService.ts` needs a leading `http` check to pass through absolute URLs. Without this, OG URLs get incorrectly prefixed with `${baseUrl}/api`.

```typescript
const toImageUrl = (imgPath: string) => {
  if (imgPath.startsWith('http')) return imgPath;  // OG and external URLs pass through
  const path = imgPath.startsWith('/') ? imgPath : `/${imgPath}`;
  return `${baseUrl}/api${path}`;
};
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Fetching OG at Render Time
**What:** Calling OG scraper inside `renderDigestEmail()` or during email send.
**Why bad:** Adds 1-5 seconds per story during render. Email rendering is called once per member. At 10 members with 4 stories each, that's 40 blocking HTTP calls at send time.
**Instead:** Fetch at collection time, store in DB, reference by URL at render.

### Anti-Pattern 2: Markdown in JSON Blobs
**What:** Claude outputs `businessImpact` as a Markdown string ("**Key point:** ..."), then parse/convert at render time.
**Why bad:** Adds a Markdown parser dependency; email-safe HTML is not browser HTML; React Email components are already semantic rendering primitives.
**Instead:** Structured `contentBlocks` with explicit `type` discriminators — each type maps to a specific React Email element.

### Anti-Pattern 3: Base64 Logo
**What:** Inlining the logo as `data:image/png;base64,...` in the `<Img>` src.
**Why bad:** Gmail blocks base64 images entirely. Increases email size by ~30%. Provides zero advantage over a stable remote URL.
**Instead:** Remote URL on `aisanomat.fi`.

### Anti-Pattern 4: Downloading OG Images Locally
**What:** Fetching OG images from third-party URLs and saving them to `{IMAGE_STORAGE_PATH}/images/` like Gemini images.
**Why bad:** Doubles storage usage. Third-party images change anyway. Railway ephemeral storage may lose files on redeploy. Original publisher URL is the right attribution source.
**Instead:** Store the OG image URL string directly in `newsItems.ogImageUrl` and use it as-is.

### Anti-Pattern 5: One Giant PR for All Four Features
**What:** Implementing OG extraction, structured content, infographic fallback, and logo all in a single change.
**Why bad:** Schema changes touch every layer. A bug in structured content (Claude schema) breaks image fallback testing. Logo is independent and safe to ship first.
**Instead:** Follow the dependency-aware build order below.

---

## Build Order (Dependency-Aware)

The four features have clear dependencies that dictate the optimal sequence:

```
Step 1: DB schema + migration (newsItems.ogImageUrl + DigestStory shape)
  ├── All other features depend on these types being committed
  └── Drizzle migration runs against Railway DB

Step 2: Logo in header (DigestEmail.tsx + logo asset uploaded to aisanomat.fi)
  ├── Independent of all other features
  ├── Zero risk — one Img element added
  └── Can ship immediately after Step 1

Step 3: OG image extraction (ogService.ts + newsCollectorService.ts)
  ├── Depends on: newsItems.ogImageUrl column (Step 1)
  ├── New service file + small modification to collector
  └── After this, ogImageUrl data starts populating for new articles

Step 4: Structured content (digest.ts types/schema + StoryContent.tsx + DigestEmail.tsx swap)
  ├── Depends on: DigestStory type update in Step 1
  ├── Can be developed in parallel with Step 3
  └── Prompt template update in admin panel — no code deploy

Step 5: AI infographic fallback (newsletterService.ts conditional logic)
  ├── Depends on: Step 3 (OG data available in newsItems)
  ├── Depends on: Step 4 (story.imageUrl field exists in new schema)
  └── Wires everything together — integration test step
```

**Recommended order:** 1 → 2 → (3 and 4 in parallel) → 5

Steps 3 and 4 are independent of each other and can be built in parallel by one developer or in either order. Step 5 is the integration step that cannot be tested meaningfully until both Steps 3 and 4 are done.

---

## Scalability Considerations

| Concern | Current (few clients) | At 20+ clients |
|---------|----------------------|----------------|
| OG fetching | Sequential per article, non-blocking | Add `p-limit` concurrency limiter to avoid overwhelming news source servers |
| Gemini image generation | Sequential per story, ~5s each | OG fallback reduces Gemini calls, improving throughput; existing sequential pattern is intentional |
| Email rendering | Per-member render via Promise.all | React Email render is CPU-bound sync; `StoryContent` adds negligible cost |
| Logo URL availability | Single remote URL | Cache-control header on aisanomat.fi; email clients cache images by URL |

---

## Sources

- Codebase: `/Users/janne/coding/ai-sanomat-yrityksille/api/src/` (direct inspection — HIGH confidence)
- [open-graph-scraper npm](https://www.npmjs.com/package/open-graph-scraper) — actively maintained OG extraction library (MEDIUM confidence, not verified via Context7)
- [React Email Img component](https://react.email/docs/components/image) — official docs on image handling
- [caniemail.com — Base64 image format](https://www.caniemail.com/features/image-base64/) — Gmail blocks base64 (HIGH confidence)
- [Resend — Embed images using CID](https://resend.com/changelog/embed-images-using-cid) — remote URL recommendation
- [Claude Structured Outputs docs](https://docs.claude.com/en/docs/build-with-claude/structured-outputs) — JSON schema guaranteed compliance
- [React Email embedded images discussion](https://github.com/resend/react-email/discussions/1281) — community guidance on image embedding
