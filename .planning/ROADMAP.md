# Roadmap: AI-Sanomat Yrityksille

## Milestones

- ✅ **v1.0 Full Platform** — Phases 1-4 (shipped 2026-03-03)
- ✅ **v1.1 Smart Sourcing & Polish** — Phases 5-9 (shipped 2026-03-04)
- **v1.2 Newsletter Quality & Design** — Phases 10-13 (active)

## Phases

<details>
<summary>✅ v1.0 Full Platform (Phases 1-4) — SHIPPED 2026-03-03</summary>

- [x] Phase 1: Foundation and Admin Setup (2/2 plans) — completed 2026-03-02
- [x] Phase 2: Content Pipeline (2/2 plans) — completed 2026-03-02
- [x] Phase 3: Email Delivery and Send Workflow (2/2 plans) — completed 2026-03-02
- [x] Phase 4: Company Portal (2/2 plans) — completed 2026-03-03

</details>

<details>
<summary>✅ v1.1 Smart Sourcing & Polish (Phases 5-9) — SHIPPED 2026-03-04</summary>

- [x] Phase 5: Foundation Automation (2/2 plans) — completed 2026-03-03
- [x] Phase 6: Premium Email Experience (2/2 plans) — completed 2026-03-03
- [x] Phase 7: Web Search Integration (1/1 plan) — completed 2026-03-03
- [x] Phase 8: Semantic Deduplication (1/1 plan) — completed 2026-03-03
- [x] Phase 9: X/Twitter Monitoring (2/2 plans) — completed 2026-03-03

</details>

### v1.2 Newsletter Quality & Design (Active)

**Milestone Goal:** Make the HTML newsletter significantly better — structured content, relevant images, proper branding.

- [x] **Phase 10: Foundation & Branding** - DB schema extension, TypeScript types, and logo in email header
- [x] **Phase 11: OG Image Extraction** - Fetch og:image from source articles at collection time
- [ ] **Phase 12: Structured Article Content** - Lead sentence, bullets, and rich formatting in newsletter stories
- [ ] **Phase 13: AI Infographic Fallback** - Conditional Gemini generation for stories without OG images

## Phase Details

### Phase 10: Foundation & Branding
**Goal**: The database, types, and email header are ready — existing newsletters look better immediately with the real logo, and the new data shape is in place for all subsequent phases.
**Depends on**: Phase 9
**Requirements**: BRAND-01, BRAND-02
**Success Criteria** (what must be TRUE):
  1. Sent newsletter emails display the AI-Sanomat logo image (not text) in the header
  2. Logo renders correctly on both light and dark email backgrounds (white island background prevents logo disappearing)
  3. Logo is a hosted PNG URL — no base64 bloat, no SVG blocked by Outlook
  4. `newsItems` table has an `ogImageUrl` column and `DigestStory` TypeScript type has `lead` and `contentBlocks` fields
  5. Existing newsletters and digests in the DB render without errors (no breaking schema change)
**Plans:** 1/1 plans complete

Plans:
- [x] 10-01-PLAN.md — Extend DB schema + types, add logo to email header with dark mode protection

### Phase 11: OG Image Extraction
**Goal**: Newly collected news articles have their source OG images stored in the database, ready to be used in newsletter generation.
**Depends on**: Phase 10
**Requirements**: IMAGE-01, IMAGE-02
**Success Criteria** (what must be TRUE):
  1. After news collection runs, articles with fetchable OG images have a non-null `ogImageUrl` in the database
  2. OG fetch completes within 3-5 seconds per article and never blocks or delays digest generation
  3. Generic site-wide OG images (containing "default", "logo", "fallback", "placeholder" in URL path) are rejected and stored as null
  4. OG fetch failures (timeout, 404, blocked) are caught silently — the article is stored normally without OG URL
**Plans:** 1/1 plans complete

Plans:
- [x] 11-01-PLAN.md — Create ogService.ts, install open-graph-scraper, wire non-blocking OG fetch into newsCollectorService.ts

### Phase 12: Structured Article Content
**Goal**: Newsletter stories display with a lead sentence, bullet points, and rich formatting — not single text blocks — and old digests still render correctly.
**Depends on**: Phase 10
**Requirements**: CONTENT-01, CONTENT-02, CONTENT-03, CONTENT-04
**Success Criteria** (what must be TRUE):
  1. Each newsletter story opens with a lead sentence summarising the article's core message
  2. Each story contains 2-4 bullet points highlighting key takeaways
  3. Story content uses subheadings, bold text, and visual hierarchy (renders correctly in Outlook desktop and Gmail)
  4. Previously generated digests (stored with old `businessImpact` string shape) render without errors — backward compatibility holds
  5. Email HTML byte length is logged before every send; a warning appears in logs when the email exceeds 80KB
**Plans:** 1 plan

Plans:
- [ ] 12-01-PLAN.md — Update prompt template, shared Zod schema, DigestEmail structured content rendering, and email size logging

### Phase 13: AI Infographic Fallback
**Goal**: Every newsletter story has an image — either an OG photo from the source article or an AI-generated infographic — and stories where both fail show cleanly without an image.
**Depends on**: Phase 11, Phase 12
**Requirements**: IMAGE-03, IMAGE-04
**Success Criteria** (what must be TRUE):
  1. Stories where OG image extraction succeeded show the source article's image (not a Gemini-generated one)
  2. Stories without an OG image get a Gemini-generated infographic as fallback
  3. Stories where both OG fetch and Gemini generation fail render cleanly with no image element (no broken image tags)
  4. OG image URLs pass through `toImageUrl()` unchanged — remote http:// URLs are not prefixed with the API base URL
**Plans**: TBD

Plans:
- [ ] 13-01: Update newsletterService.ts conditional Gemini logic, fix toImageUrl() for absolute URLs, update Gemini infographic prompts

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation and Admin Setup | v1.0 | 2/2 | Complete | 2026-03-02 |
| 2. Content Pipeline | v1.0 | 2/2 | Complete | 2026-03-02 |
| 3. Email Delivery and Send Workflow | v1.0 | 2/2 | Complete | 2026-03-02 |
| 4. Company Portal | v1.0 | 2/2 | Complete | 2026-03-03 |
| 5. Foundation Automation | v1.1 | 2/2 | Complete | 2026-03-03 |
| 6. Premium Email Experience | v1.1 | 2/2 | Complete | 2026-03-03 |
| 7. Web Search Integration | v1.1 | 1/1 | Complete | 2026-03-03 |
| 8. Semantic Deduplication | v1.1 | 1/1 | Complete | 2026-03-03 |
| 9. X/Twitter Monitoring | v1.1 | 2/2 | Complete | 2026-03-03 |
| 10. Foundation & Branding | v1.2 | Complete    | 2026-03-04 | 2026-03-04 |
| 11. OG Image Extraction | v1.2 | Complete    | 2026-03-04 | 2026-03-04 |
| 12. Structured Article Content | v1.2 | 0/1 | Not started | - |
| 13. AI Infographic Fallback | v1.2 | 0/1 | Not started | - |
