---
phase: 12-structured-article-content
verified: 2026-03-04T13:15:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 12: Structured Article Content Verification Report

**Phase Goal:** Newsletter stories display with a lead sentence, bullet points, and rich formatting — not single text blocks — and old digests still render correctly.
**Verified:** 2026-03-04T13:15:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | New digest stories open with a bold lead sentence summarizing the core message | VERIFIED | `DigestEmail.tsx` lines 182-194: `{story.lead ? (...)` renders `<Text style={{ fontWeight: 600 }}>{story.lead}</Text>` when `story.lead` is present |
| 2 | New digest stories contain 2-4 bullet points highlighting key takeaways | VERIFIED | `DigestEmail.tsx` lines 197-221: `story.contentBlocks?.map((block, j) => { if (block.type === 'bullets') { return (<ul>...</ul>) } })` renders bullet lists from `contentBlocks` |
| 3 | Story content uses visual hierarchy — lead, bullets, link — instead of a single text block | VERIFIED | `DigestEmail.tsx` lines 171-179: `<Heading as="h3">` for title; bold lead text (fontWeight 600) at 16px; bullet `<ul>/<li>` with inline styles; `<Link>` for source; explicit `Heading` imported at line 14 |
| 4 | Old digests without lead/contentBlocks render with businessImpact fallback (no errors) | VERIFIED | `DigestEmail.tsx` lines 223-228: `) : ( <Text className="...">{story.businessImpact}</Text> )}` — fallback is the else branch of `story.lead ? ... : ...`; `digestStorySchema` in shared schema has `lead` and `contentBlocks` as `.optional()` |
| 5 | Email HTML byte length is logged before every send with a warning at 80KB | VERIFIED | `emailService.ts` lines 68-74: `Buffer.byteLength(html, 'utf-8')` computed, logged via `console.log`, and `console.warn` fires when `htmlBytes > 80 * 1024` |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/src/db/seed.ts` | Updated `viikkokatsaus_generointi` prompt template with structured content instructions | VERIFIED | Contains explicit `lead` and `contentBlocks` instructions with Finnish example JSON (lines 92-114); onConflictDoNothing comment present at line 70 |
| `packages/shared/src/schemas/digest.ts` | Zod schema with optional lead and contentBlocks fields | VERIFIED | `contentBlockSchema` discriminated union (lines 10-13); `digestStorySchema` extended with `lead: z.string().optional()` and `contentBlocks: z.array(contentBlockSchema).optional()` (lines 20-21) |
| `api/src/emails/DigestEmail.tsx` | Conditional rendering of structured content with businessImpact fallback | VERIFIED | `Heading` imported and used (lines 14, 171); `story.lead` as discriminator (line 182); structured path renders lead + bullets; fallback renders `story.businessImpact` (line 226) |
| `api/src/services/emailService.ts` | Buffer.byteLength logging and 80KB warning | VERIFIED | `Buffer.byteLength(html, 'utf-8')` at line 68; `console.log` size at line 69; `console.warn` threshold at lines 70-74 |

All four artifacts: EXISTS (level 1), SUBSTANTIVE (level 2), WIRED (level 3).

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `api/src/db/seed.ts` | Claude structured output | Prompt template instructs Claude to populate `lead` + `contentBlocks` fields | WIRED | Template at lines 92-114 uses "contentBlocks" keyword with bullets sub-type; JSON example present |
| `api/src/emails/DigestEmail.tsx` | `api/src/types/digest.ts` | `DigestStory` type with optional `lead`/`contentBlocks` consumed by email template | WIRED | `import type { DigestStory } from '../types/digest.js'` at line 17; `DigestEmailStory extends DigestStory` at line 20; `story.lead` and `story.contentBlocks` used at lines 182-221 |
| `api/src/services/emailService.ts` | `api/src/emails/DigestEmail.tsx` | `render()` call produces HTML string measured by `Buffer.byteLength` | WIRED | `render(DigestEmail(emailProps))` at line 64; `Buffer.byteLength(html, 'utf-8')` at line 68; both in same `renderDigestEmail` function before `return { html, text }` at line 76 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CONTENT-01 | 12-01-PLAN.md | Uutisartikkeli sisältää lead-lauseen joka tiivistää uutisen ydinviestin | SATISFIED | `DigestEmail.tsx` line 193 renders `{story.lead}` in a bold `<Text>` when present; prompt template instructs Claude to populate `lead` field |
| CONTENT-02 | 12-01-PLAN.md | Uutisartikkeli sisältää 2-4 bullet-pointtia avainpointeista | SATISFIED | `DigestEmail.tsx` lines 197-221 render `<ul>/<li>` from `contentBlocks` bullets; prompt template instructs "2-4 avainpointtia" |
| CONTENT-03 | 12-01-PLAN.md | Uutisartikkeli käyttää alaotsikointia, boldausta ja korostuksia luettavuuden parantamiseksi | SATISFIED | `<Heading as="h3">` for title (line 171); `fontWeight: 600` on lead text (line 188); `<ul>/<li>` for bullet hierarchy (lines 201-215) |
| CONTENT-04 | 12-01-PLAN.md | Vanhat digestit (ilman uutta rakennetta) renderöityvät edelleen oikein | SATISFIED | Fallback path at `DigestEmail.tsx` lines 223-228 renders `story.businessImpact`; both `lead` and `contentBlocks` are `.optional()` in Zod schema and TypeScript type; old digests without these fields parse without errors |

**Notes on REQUIREMENTS.md traceability:**
- All four CONTENT-0x requirements are marked `[x]` complete in REQUIREMENTS.md (lines 12-15)
- Traceability table maps all four to Phase 12 with status "Complete" (lines 51-54)
- No orphaned requirements found: all Phase 12 IDs in PLAN frontmatter match REQUIREMENTS.md exactly

**Important note — EMAIL-01 (Gmail 102KB monitoring):**
REQUIREMENTS.md classifies `EMAIL-01` ("Gmail 102KB HTML-rajan monitorointi ja varoitus") as a **Future/Deferred** requirement. However, Phase 12 effectively implements this functionality (Buffer.byteLength logging + 80KB warn threshold in emailService.ts). This is an over-delivery against the deferred requirement, not a gap. The PLAN did not claim EMAIL-01, and REQUIREMENTS.md did not assign it to Phase 12, so there is no traceability conflict.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `api/src/services/emailService.ts` | 61 | `unsubscribeUrl: ''` with comment "Placeholder — korvataan per-jäsen lähetettäessä" | INFO | Not a phase 12 artifact — this was pre-existing and intentional (per-member override happens in `sendDigestToClient`). No impact on phase goal. |

No blockers or warnings. The one placeholder is pre-existing, intentional, and outside Phase 12 scope.

---

### Human Verification Required

#### 1. Structured content in generated emails

**Test:** Trigger a new digest generation (via admin at `/clients/{id}` → Generate Digest) after updating the production prompt template via admin UI at `/templates`.
**Expected:** Generated digest JSON contains `lead` (string) and `contentBlocks` (array with at least one bullets block) on each story; email preview shows bold lead sentence and bullet list per story.
**Why human:** The prompt template in `seed.ts` only seeds new databases (`onConflictDoNothing`). Existing production databases still have the old template. Claude's actual output with the new prompt cannot be verified programmatically without executing the AI pipeline.

#### 2. Visual rendering across email clients

**Test:** Send a test digest and open in Gmail, Apple Mail, and Outlook (if available).
**Expected:** Lead sentence renders bold; bullet points render with visible disc markers and correct indentation; story titles use heading-sized text; fallback story (businessImpact-only) renders as normal paragraph.
**Why human:** Email client rendering differences (especially Outlook Word engine vs Chromium engine) cannot be verified by static analysis. Inline styles are used on `<ul>/<li>` for Outlook compatibility, but visual outcome requires a real email client.

#### 3. Backward compatibility with existing digests

**Test:** View an existing issued digest (from before Phase 12) in the admin digest preview or resend it.
**Expected:** Email renders with `businessImpact` text block (not empty, not erroring); no React rendering errors in server logs.
**Why human:** Requires a real database with pre-Phase-12 digest records to trigger the fallback path at runtime.

---

### Gaps Summary

No gaps found. All 5 observable truths are verified against the actual codebase. All 4 artifacts exist, are substantive, and are properly wired. All 4 requirement IDs (CONTENT-01 through CONTENT-04) are satisfied with concrete implementation evidence.

The only pending item is a human-side operational task: the production prompt template in an existing deployment must be updated manually via the admin UI at `/templates` (documented in seed.ts line 70 and SUMMARY.md). This is a deployment concern, not an implementation gap.

---

_Verified: 2026-03-04T13:15:00Z_
_Verifier: Claude (gsd-verifier)_
