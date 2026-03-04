---
phase: 06-premium-email-experience
plan: 01
subsystem: email-template
tags: [react-email, tailwind, dark-mode, branding, featured-posts]
dependency_graph:
  requires: [news_items, news_sources, clients]
  provides: [premium-email-template, featured-posts-service, extended-email-service]
  affects: [emailService, DigestEmail, digest-types]
tech_stack:
  added: [Tailwind-in-email, pixelBasedPreset]
  patterns: [dark-mode-via-css-classes, conditional-rendering]
key_files:
  created:
    - api/src/services/featuredPostsService.ts
  modified:
    - api/src/emails/DigestEmail.tsx
    - api/src/services/emailService.ts
    - api/src/types/digest.ts
decisions:
  - Tailwind with pixelBasedPreset converts rem to px for email-safe styling
  - Dark mode uses CSS class-based selectors with @media prefers-color-scheme in Head style tag
  - Featured posts queried at render time from existing Beehiiv source data -- no new collector
  - Teal accent bar uses inline style for reliable rendering alongside Tailwind classes
  - Off-white #F7F7F7 body background (better dark mode degradation than pure white)
metrics:
  duration: 4min
  completed: "2026-03-03T12:17:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 3
---

# Phase 6 Plan 01: Premium Email Template and Featured Posts Summary

Premium Tailwind-based email template with AI-Sanomat branding, teal accent, client co-branding, dark mode, and "AI-Sanomat suosittelee" section sourced from existing Beehiiv news items.

## What Was Done

### Task 1: Create featured posts service and extend digest types (35cb82e)

- Added `FeaturedPost` interface to `api/src/types/digest.ts` with title, url, summary fields
- Created `api/src/services/featuredPostsService.ts` with `getFeaturedPosts()` function
- Function queries `news_items` joined with `news_sources` filtered to `type = 'beehiiv'`
- Orders by `publishedAt DESC`, returns up to 3 posts (configurable via limit parameter)
- Returns empty array if no Beehiiv source or items exist (graceful degradation)

### Task 2: Redesign DigestEmail.tsx and extend emailService (2899b8e)

**DigestEmail.tsx (full rewrite):**
- Replaced inline CSS styles with Tailwind component using `pixelBasedPreset`
- Brand header: bold "AI-Sanomat" text with teal (#0D9488) accent bar below
- Client co-branding: `{clientName} | {clientIndustry}` subtitle
- Story layout: image above, text below, "Lue lisaa" as teal text links (not buttons)
- Divider lines between stories using `<Hr>` component
- Dark mode: `@media (prefers-color-scheme: dark)` in `<Head>` style tag with class-based selectors
- "AI-Sanomat suosittelee" section: compact card block showing up to 3 featured posts, omitted if zero
- Feedback section: conditional on `feedbackUrls` prop (placeholder for plan 06-02)
- Branded footer: tagline, aisanomat.fi link, X link, LinkedIn link, company info, unsubscribe link
- Tracking pixel support preserved

**emailService.ts:**
- `renderDigestEmail()` now accepts `client: { name: string; industry: string }` and optional `feedbackUrls`
- Calls `getFeaturedPosts(3)` before rendering to populate featured section
- Passes `clientIndustry`, `featuredPosts`, `feedbackUrls` to template
- `sendDigestToClient()` passes `client.industry` to `renderDigestEmail()`
- Existing callers (digests.ts preview route) continue to work via structural typing

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Tailwind pixel preset**: Using `pixelBasedPreset` converts all Tailwind rem units to px, preventing email client rendering issues
2. **Dark mode CSS approach**: Class-based selectors (`.email-body`, `.email-text`, etc.) in `<Head>` style tag, targetable by `@media (prefers-color-scheme: dark)` -- React Email components get both Tailwind classes and dark mode CSS classes
3. **Inline styles for accent bar**: Teal accent bar uses inline `style` prop alongside CSS class for maximum email client compatibility
4. **Off-white body background**: `#F7F7F7` (not pure white) provides better visual separation and dark mode degradation
5. **No new collector**: Featured posts use existing Beehiiv-collected news items, queried at render time

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 35cb82e | FeaturedPost type + featuredPostsService |
| 2 | 2899b8e | Premium DigestEmail template + emailService extension |

## Verification Results

- TypeScript compiles without errors (`npx tsc --noEmit` clean)
- DigestEmail.tsx contains all required sections: brand header, teal bar, co-branding, stories with images, featured section, feedback placeholder, dark mode, branded footer
- featuredPostsService queries Beehiiv source correctly with innerJoin and where clause
- emailService passes industry, featuredPosts, feedbackUrls to template
- sendDigestToClient passes client.industry
- Existing preview route caller works without changes (structural typing)

## Self-Check: PASSED

All files exist, all commits verified.
