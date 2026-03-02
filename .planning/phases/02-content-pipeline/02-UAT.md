---
status: complete
phase: 02-content-pipeline
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md]
started: 2026-03-02T12:00:00Z
updated: 2026-03-02T12:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Uutiset sidebar navigation
expected: In the admin panel, the sidebar shows "Uutiset" (with Newspaper icon) as a navigation link. Clicking it navigates to /news.
result: pass

### 2. News page table layout
expected: The /news page shows heading "Uutiset" and a table with news items (title, source, published date, collected date). If no items yet, table is empty but renders without errors.
result: pass

### 3. Manually add a news item
expected: Clicking "Lisaa uutinen" shows an inline form with URL input (and optional title/summary fields). Pasting a URL and submitting adds the item to the table. A sonner toast confirms success.
result: pass

### 4. Duplicate URL silently handled
expected: Pasting the same URL again and submitting does NOT create a duplicate. A toast indicates the item already exists (or silent success). The table still shows only one entry for that URL.
result: pass

### 5. Collect news from sources
expected: Clicking "Keraa uutiset" triggers collection from all active sources. A sonner toast shows results (collected count, errors count). If RSS sources are configured and active, new items appear in the table.
result: pass

### 6. Delete a news item
expected: A news item can be deleted from the table. After deletion, the item no longer appears in the list.
result: pass
note: Initially failed — apiFetch threw on 204 No Content response. Fixed inline during UAT.

### 7. Trigger digest generation for a client
expected: POST /api/admin/digests/generate with { clientId: N } returns 201 with { issueId, status }.
result: skipped
reason: No API keys configured (ANTHROPIC_API_KEY, GEMINI_API_KEY)

### 8. View generated digest
expected: GET /api/admin/digests/:id returns parsed generatedContent and validationReport.
result: skipped
reason: Depends on test 7

### 9. List digests
expected: GET /api/admin/digests returns list of issues ordered by createdAt desc.
result: skipped
reason: Depends on test 7

### 10. Image generation fallback
expected: If GEMINI_API_KEY is not set, digest completes with placeholder image URLs instead of crashing.
result: skipped
reason: Depends on test 7

## Summary

total: 10
passed: 6
issues: 0
pending: 0
skipped: 4

## Bugs Fixed During UAT

1. **apiFetch Content-Type on bodiless POST** — `apiFetch` always sent `Content-Type: application/json` even without a body. Fastify rejected the empty JSON parse → 400. Fixed: only set Content-Type when body is present.
2. **apiFetch 204 No Content JSON parse** — DELETE returns 204 with no body. `res.json()` threw, causing false error toast. Fixed: return early for 204 responses.

## Gaps

[none]
