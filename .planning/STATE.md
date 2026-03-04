---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Newsletter Quality & Design
status: unknown
last_updated: "2026-03-04T13:30:10.665Z"
progress:
  total_phases: 8
  completed_phases: 8
  total_plans: 12
  completed_plans: 12
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** The AI-generated weekly digest must be genuinely useful and industry-relevant -- content quality is the entire selling point.
**Current focus:** v1.2 milestone complete

## Current Position

Phase: 13 of 13 (AI Infographic Fallback) -- COMPLETE
Plan: 1 of 1 in current phase
Status: Phase 13 complete, v1.2 milestone complete
Last activity: 2026-03-04 — Phase 13 Plan 01 executed (OG image fallback + conditional Gemini generation)

Progress: [██████████] 100% (4/4 plans complete)

## Milestones

- ✅ v1.0 Full Platform — Phases 1-4 (shipped 2026-03-03)
- ✅ v1.1 Smart Sourcing & Polish — Phases 5-9 (shipped 2026-03-04)
- v1.2 Newsletter Quality & Design — Phases 10-13 (active)

## Accumulated Context

### Decisions

- Admin member endpoints reuse portal member route patterns with admin auth (quick-001)
- Admin sees all members including inactive for full visibility (quick-001)
- Logo must be hosted PNG on aisanomat.fi — SVG blocked by Outlook since Oct 2025, base64 inflates HTML toward Gmail 102KB limit
- OG fetch runs non-blocking after newsItem insert, never at render time — same pattern as logFetchAttempt()
- Structured content is backward-compatible: old digests fall back to businessImpact string field
- Logo rendered above AI-Sanomat text heading, not replacing it (Phase 10)
- White island uses #FAFAFA background for dark mode logo protection (Phase 10)
- contentBlocks and lead are optional in both TS and JSON schema for backward compat (Phase 10)
- logoUrl always constructed by emailService, DigestEmail renders conditionally (Phase 10)
- isGenericImageUrl extracted as testable pure function to avoid ESM mocking complexity (Phase 11)
- Used .returning({ id }) instead of rowCount to get inserted row ID for OG fetch (Phase 11)
- Use story.lead as the structured-vs-fallback discriminator, not contentBlocks presence (Phase 12)
- Inline styles on ul/li bullet elements for Outlook Word engine compatibility (Phase 12)
- Buffer.byteLength with utf-8 for accurate Finnish multi-byte character size measurement (Phase 12)
- toImageUrl extracted as module-level export with baseUrl parameter for testability (Phase 13)
- PLACEHOLDER_IMAGE_URL eliminated entirely; undefined used as fallback for clean rendering (Phase 13)
- Gemini image prompts generated only for stories without OG images to save Claude API tokens (Phase 13)
- Hero image always generated via Gemini even when all stories have OG images (Phase 13)

### Pending Todos

- Set up DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD in api/.env before running db:push/db:seed
- Configure mail.aisanomat.fi domain in Resend Dashboard with SPF/DKIM/DMARC DNS records
- Set TAVILY_API_KEY, OPENAI_API_KEY, APIFY_TOKEN in api/.env
- Fix INT-01: Health dot key mismatch in X monitoring page
- Fix INT-02: Duplicate items not filtered during digest generation
- Logo PNG asset (320x80px, transparent, under 10KB) must exist at aisanomat.fi/assets/logo/ before Phase 10 deploys
- Verify Gemini billing enabled for image generation before Phase 13 (free tier is 0 IPM)
- Litmus or Email on Acid account needed for Outlook desktop testing before Phase 12

### Blockers/Concerns

- [Phase 12] Outlook desktop uses Word 2007 rendering — all structured content must use table-based layout (Section/Row/Column), no CSS flexbox
- [Phase 12] Gmail clips email at 102KB — structured HTML adds bytes, add byte logging before any new content elements
- [Phase 13] Gemini safety filter rejects AI-topic prompts — use visual metaphor prompts, not article subject matter

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 001 | Add user management to customer where admin user for the company can add recipients for the newsletter | 2026-03-04 | c977f51 | [001-add-user-mgmt-newsletter-recipients](./quick/001-add-user-mgmt-newsletter-recipients/) |

## Session Continuity

Last session: 2026-03-04
Stopped at: Completed 13-01-PLAN.md (AI Infographic Fallback) -- v1.2 milestone complete
Resume file: N/A
