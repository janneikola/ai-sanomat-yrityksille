---
phase: 02-content-pipeline
plan: 02
subsystem: api, integrations, shared
tags: [anthropic-sdk, google-genai, claude-structured-outputs, gemini-image, newsletter-pipeline, fastify, drizzle]

# Dependency graph
requires:
  - phase: 02-content-pipeline/01
    provides: News collection pipeline, integration client pattern, newsItems in database
provides:
  - Claude API client with structured JSON outputs (generateDigest, validateDigest, generateImagePrompts)
  - Gemini image generation client with filesystem storage and placeholder fallback
  - Newsletter service orchestrating full digest pipeline (generate -> validate -> images -> ready)
  - Image service with sequential generation and per-image fallback
  - Digest API routes (generate, get single, list)
  - TypeScript types and JSON schemas for digest content, validation report, image prompts
  - Shared Zod schemas for digest response
affects: [03-email-delivery, 04-company-portal]

# Tech tracking
tech-stack:
  added: ["@anthropic-ai/sdk", "@google/genai"]
  patterns: [Claude structured outputs (output_config.format), sequential image generation with fallback, template variable interpolation]

key-files:
  created:
    - api/src/types/digest.ts
    - api/src/integrations/claudeClient.ts
    - api/src/integrations/geminiClient.ts
    - api/src/services/newsletterService.ts
    - api/src/services/imageService.ts
    - api/src/routes/digests.ts
    - packages/shared/src/schemas/digest.ts
  modified:
    - api/src/app.ts
    - api/package.json
    - packages/shared/src/index.ts
    - package-lock.json

key-decisions:
  - "Claude structured outputs via output_config.format for guaranteed JSON -- no prompt-based JSON extraction"
  - "All JSON schemas use additionalProperties: false at every object level with all properties required"
  - "Model ID stored as env var CLAUDE_MODEL (default: claude-sonnet-4-5-20250929) for easy updates"
  - "Gemini model set to gemini-2.5-flash-preview-05-20 -- production image generation model"
  - "Images generated sequentially (not Promise.all) to avoid Gemini rate limits"
  - "Validation prompt includes all 26 humanizer AI-pattern rules inline for Finnish language quality checking"
  - "404 response schema added to GET /digests/:id for Fastify typed response compatibility"

patterns-established:
  - "Claude structured output pattern: JSON schema object -> output_config.format -> guaranteed parsed JSON"
  - "Pipeline orchestration: sequential status transitions with error rollback to 'failed'"
  - "Template interpolation: fillTemplate(template, variables) replacing {{key}} patterns"
  - "Image generation: sequential per-image try/catch with PLACEHOLDER_IMAGE_URL fallback"

requirements-completed: [CONT-06, CONT-07, CONT-08, CONT-09, CONT-10]

# Metrics
duration: 4min
completed: 2026-03-02
---

# Phase 2 Plan 02: Digest Generation Pipeline Summary

**Claude-powered digest generation with structured JSON output, fact + language quality validation using 26 humanizer AI-patterns, and Gemini image generation with sequential fallback**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-02T11:04:36Z
- **Completed:** 2026-03-02T11:08:38Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Built TypeScript types and JSON Schema objects for DigestContent, ValidationReport, and ImagePrompts with strict additionalProperties: false at every object level
- Built Claude API client using @anthropic-ai/sdk with structured outputs (output_config.format.type='json_schema') for guaranteed valid JSON -- three functions: generateDigest, validateDigest, generateImagePrompts
- Built Gemini image generation client using @google/genai with filesystem storage at configurable IMAGE_STORAGE_PATH, returning public URL paths
- Newsletter service orchestrates the full digest pipeline: fetch client + news -> generate (Claude) -> validate with humanizer patterns (Claude) -> image prompts (Claude) -> images (Gemini) -> update issue to 'ready'
- Image service generates hero (1200x630) and section (800x450) images sequentially with individual try/catch and PLACEHOLDER_IMAGE_URL fallback per image
- Digest API routes: POST /digests/generate (trigger), GET /digests/:id (parsed JSON fields), GET /digests (list), all authenticated
- Shared Zod schemas for digest content, validation report, and full digest response exported from @ai-sanomat/shared
- Validation prompt includes all 26 Finnish humanizer AI-pattern rules (passive overuse, missing particles, translation structures, genitive chains, significance inflation, etc.)

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, Claude client, and Gemini client** - `5de3e54` (feat)
2. **Task 2: Newsletter service, image service, digest route, and shared schemas** - `5d1d2ef` (feat)

## Files Created/Modified

- `api/src/types/digest.ts` - TypeScript interfaces + JSON Schema objects for digest, validation, image prompts
- `api/src/integrations/claudeClient.ts` - Claude API wrapper with structured outputs for 3 functions
- `api/src/integrations/geminiClient.ts` - Gemini image generation with filesystem storage
- `api/src/services/newsletterService.ts` - Full pipeline orchestration with template filling and status transitions
- `api/src/services/imageService.ts` - Sequential image generation with per-image fallback
- `api/src/routes/digests.ts` - POST generate, GET single (parsed), GET list, all authenticated
- `packages/shared/src/schemas/digest.ts` - Zod schemas for digest content, validation report, response
- `api/src/app.ts` - Registered digest routes plugin at /api/admin prefix
- `api/package.json` - Added @anthropic-ai/sdk and @google/genai dependencies
- `packages/shared/src/index.ts` - Added digest schema re-export
- `package-lock.json` - Updated with new dependencies

## Decisions Made

- Used Claude structured outputs (output_config.format) instead of prompt-based JSON extraction for guaranteed valid JSON
- All JSON schemas enforce additionalProperties: false at every object level and list all properties in required (mandatory for Claude structured outputs)
- Model ID stored as CLAUDE_MODEL env var (default: claude-sonnet-4-5-20250929) so it can be updated without code changes
- Gemini model set to gemini-2.5-flash-preview-05-20 for image generation
- Images generated sequentially (not Promise.all) to avoid Gemini rate limits per research recommendation
- Validation prompt includes all 26 humanizer AI-pattern rules inline rather than referencing external file
- Added 404 response schema to GET /digests/:id for Fastify typed provider compatibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added 404 response schema to GET /digests/:id**
- **Found during:** Task 2 (digest routes)
- **Issue:** Fastify type provider requires all response status codes declared in schema. Sending code(404) without a 404 schema caused TS2345 error.
- **Fix:** Added `404: z.object({ error: z.string() })` to the route's response schema
- **Files modified:** api/src/routes/digests.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 5d1d2ef (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor schema addition for TypeScript compatibility. No scope creep.

## Issues Encountered

None beyond the 404 schema fix -- both tasks compiled and verified cleanly.

## User Setup Required

This plan requires API credentials for the generation pipeline to work:
- `ANTHROPIC_API_KEY` - From console.anthropic.com -> API Keys
- `GEMINI_API_KEY` - From aistudio.google.com -> Get API Key
- `IMAGE_STORAGE_PATH` - Local: ./uploads (default), Railway: /data (volume mount)
- `CLAUDE_MODEL` - Optional, defaults to claude-sonnet-4-5-20250929

These should be added to `api/.env`. The API routes compile and register without these keys, but generation calls will fail at runtime without them.

## Next Phase Readiness

- Digest generation pipeline is complete and can be triggered via POST /api/admin/digests/generate
- Generated digests have structured JSON content ready for HTML email rendering in Phase 3
- Validation reports with language quality scores are stored for admin review
- Images are stored on filesystem and referenced by URL paths ready for email embedding

---
*Phase: 02-content-pipeline*
*Completed: 2026-03-02*
