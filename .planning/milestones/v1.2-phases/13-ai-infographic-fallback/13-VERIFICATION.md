---
phase: 13-ai-infographic-fallback
verified: 2026-03-04T14:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 13: AI Infographic Fallback Verification Report

**Phase Goal:** Every newsletter story has an image -- either an OG photo from the source article or an AI-generated infographic -- and stories where both fail show cleanly without an image.
**Verified:** 2026-03-04T14:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Stories with OG images in the database show the source article's remote image URL, not a Gemini-generated one | VERIFIED | `newsletterService.ts:253` -- `ogImageMap.get(story.sourceUrl)` is first in the nullish coalescing chain; `ogImageMap` built from `newsItems.ogImageUrl` via Drizzle `inArray` query (lines 184-194) |
| 2 | Stories without an OG image get a Gemini-generated infographic as fallback | VERIFIED | `newsletterService.ts:197-199` -- `storiesNeedingImages` filters stories without OG images; `geminiImageMap` (lines 202-226) maps generated Gemini images to original story indices; line 254 `?? geminiImageMap.get(i)` provides second-tier fallback |
| 3 | Stories where both OG fetch and Gemini generation fail render cleanly with no image element (imageUrl is undefined, not a placeholder path) | VERIFIED | `newsletterService.ts:255` -- final `?? undefined` in chain; `imageService.ts:11` returns `string | undefined` (not placeholder); `DigestEmail.tsx:154` -- `{story.imageUrl && (<Img .../>)}` renders nothing when undefined; `DigestEmail.tsx:132` -- `{heroImageUrl && ...}` same pattern for hero |
| 4 | OG image URLs (absolute http/https) pass through toImageUrl() unchanged -- they are NOT prefixed with the API base URL | VERIFIED | `emailService.ts:16-24` -- exported `toImageUrl()` checks `imgPath.startsWith('http://')` and `imgPath.startsWith('https://')`, returns unchanged; `emailService.test.ts` has 5 unit tests covering both protocols plus relative paths |
| 5 | The hero image uses undefined (not PLACEHOLDER_IMAGE_URL) when Gemini generation fails | VERIFIED | `imageService.ts:15-18` -- hero failure returns `undefined`; `newsletterService.ts:262` -- `heroUrl ?? null` converts to null for DB storage; `PLACEHOLDER_IMAGE_URL` grep confirms zero occurrences in all source files under `api/` |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/src/services/emailService.ts` | toImageUrl() with absolute URL passthrough | VERIFIED | Lines 16-24: exported module-level function with `startsWith('http')` check; 3 call sites in `renderDigestEmail` (lines 45, 48, 53) all pass `baseUrl` parameter |
| `api/src/services/imageService.ts` | generateDigestImages returns undefined instead of placeholder on failure | VERIFIED | 34 lines; return type `{ heroUrl: string | undefined; sectionUrls: (string | undefined)[] }`; no import of PLACEHOLDER_IMAGE_URL; uses `?? undefined` and try/catch with undefined fallback |
| `api/src/integrations/geminiClient.ts` | PLACEHOLDER_IMAGE_URL export removed | VERIFIED | 42 lines; only exports `generateImage`; no PLACEHOLDER_IMAGE_URL constant present; grep of entire `api/` directory confirms zero references |
| `api/src/services/newsletterService.ts` | OG image lookup map, conditional Gemini generation, three-tier fallback merge | VERIFIED | Lines 183-257: `inArray` query builds `ogImageMap`, `storiesNeedingImages` filter, `geminiImageMap` for sparse assignment, three-tier merge `ogImageMap.get() ?? geminiImageMap.get() ?? undefined` |
| `api/src/services/emailService.test.ts` | Unit tests for toImageUrl | VERIFIED | 38 lines; 5 tests covering: https passthrough, http passthrough, relative with leading slash, relative without leading slash, localhost base URL |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `newsletterService.ts` | `db/schema.ts` | Drizzle `inArray` query on `newsItems.url` | WIRED | Line 1: `import { inArray } from 'drizzle-orm'`; Lines 185-188: `db.select().from(newsItems).where(inArray(newsItems.url, storyUrls))`; `newsItems.ogImageUrl` accessed at line 186 |
| `newsletterService.ts` | `imageService.ts` | `generateDigestImages` called only for stories needing Gemini images | WIRED | Line 5: `import { generateDigestImages } from './imageService.js'`; Lines 218, 241: called in both branches (stories needing images vs all-OG); results merged via `geminiImageMap` |
| `emailService.ts` | `DigestEmail.tsx` | `toImageUrl` processes both absolute OG URLs and relative Gemini paths; DigestEmail renders conditionally | WIRED | `emailService.ts:50-55`: `storiesWithAbsoluteUrls` maps through `toImageUrl`; `DigestEmail.tsx:154`: `{story.imageUrl && (<Img .../>)}` conditionally renders; `DigestEmail.tsx:132`: `{heroImageUrl && ...}` same pattern |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| IMAGE-03 | 13-01-PLAN | Jos OG-kuvaa ei loydy, generoidaan AI-infograafi joka selittaa uutisen sisaltoa | SATISFIED | `newsletterService.ts:197-226` -- stories without OG images are identified and passed to `generateDigestImages`; Gemini-generated paths stored in `geminiImageMap` and merged at line 254 |
| IMAGE-04 | 13-01-PLAN | Jos AI-infograafikaan ei onnistu, uutinen naytetaan ilman kuvaa | SATISFIED | `imageService.ts:15-18,25-29` -- failure returns `undefined`; `newsletterService.ts:255` -- final fallback is `undefined`; `DigestEmail.tsx:154` -- `{story.imageUrl && ...}` renders nothing when undefined |

**Orphaned requirements check:** REQUIREMENTS.md maps IMAGE-03 and IMAGE-04 to Phase 13. Plan 13-01 claims both. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `api/src/services/emailService.ts` | 68 | Comment mentions "Placeholder" for unsubscribeUrl | Info | Pre-existing comment, unrelated to image placeholders; the unsubscribeUrl is correctly replaced per-member at send time (line 146-149) |

No blocker or warning-level anti-patterns found. All modified files are clean of TODO/FIXME/HACK markers.

### Human Verification Required

### 1. OG Image Rendering in Email Client

**Test:** Generate a digest for a client where some source articles have OG images and some do not. Send the email and view it in Gmail/Outlook.
**Expected:** Stories with OG images show the source article's photo (loaded from remote CDN). Stories without OG images show a Gemini-generated infographic (loaded from the API server). Stories where both failed show no image at all (no broken image icon).
**Why human:** Email client rendering behavior (image loading, fallback display) cannot be verified programmatically.

### 2. Gemini Safety Filter Behavior

**Test:** Generate a digest containing AI/tech-heavy stories and check that Gemini image generation succeeds or gracefully degrades.
**Expected:** Gemini either generates an infographic or returns null (which results in no image). No error propagation that breaks the digest pipeline.
**Why human:** Gemini safety filter behavior depends on prompt content and model version; cannot be unit tested.

### 3. sourceUrl Matching Accuracy

**Test:** After generating a real digest, compare the `sourceUrl` values in the generated digest JSON with the `url` values in the `newsItems` table.
**Expected:** URLs match exactly, enabling the `inArray` query to find OG images.
**Why human:** Depends on Claude's URL generation behavior in the digest prompt; edge cases (trailing slashes, scheme differences) need real-world validation.

### Gaps Summary

No gaps found. All five observable truths are verified against the actual codebase. All artifacts exist, are substantive (not stubs), and are properly wired together. Both requirements (IMAGE-03, IMAGE-04) are satisfied. The three-tier image fallback chain (OG > Gemini > undefined) is fully implemented and connected end-to-end.

---

_Verified: 2026-03-04T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
