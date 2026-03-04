# Phase 11: OG Image Extraction - Research

**Researched:** 2026-03-04
**Domain:** OG metadata scraping, non-blocking async patterns, Node.js / TypeScript ESM
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| IMAGE-01 | Uutisartikkelin kuva haetaan ensisijaisesti lähdeartikkelin OG-metatiedoista (source article OG image fetched first) | `open-graph-scraper` reads `og:image` from article HTML; `result.ogImage[0].url` is the extraction target |
| IMAGE-02 | OG-kuvahaku käyttää timeoutia (3-5s) eikä estä digestin generointia (OG fetch uses timeout and never blocks digest generation) | `open-graph-scraper` has a native `timeout` option (seconds); fire-and-forget `.catch(console.error)` pattern after DB insert mirrors existing `logFetchAttempt()` usage |
</phase_requirements>

---

## Summary

Phase 11 adds a non-blocking OG image extraction step to the news collection pipeline. Immediately after a new `newsItem` row is inserted into the database, a background async call fetches the source article's `og:image` meta tag and writes the URL back into `newsItems.ogImageUrl`. The operation must never delay the caller — it uses a fire-and-forget pattern identical to how `logFetchAttempt()` is called today.

The library `open-graph-scraper` (v6.11.0, ESM-native) is pre-specified in the roadmap and is the standard choice for this task. It wraps Node's Fetch API, supports a `timeout` in seconds, and returns a discriminated union (`SuccessResult | ErrorResult`). A URL-based filter rejects generic site images before the DB write. All failures are silently swallowed — the article record is unaffected.

**Primary recommendation:** Install `open-graph-scraper`, create `ogService.ts` with a `fetchOgImage(url)` helper, call it non-blocking in `newsCollectorService.ts` after each successful `onConflictDoNothing` insert that returned `rowCount > 0`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| open-graph-scraper | 6.11.0 | Fetches and parses `og:image` (and other OG tags) from any URL | ESM-native, ships own TypeScript types, uses Node Fetch API, actively maintained, pre-specified in roadmap plan |

### Supporting

No additional libraries needed. The project already has:
- `drizzle-orm` — DB update after OG fetch
- Node.js built-in Fetch API — used internally by open-graph-scraper

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| open-graph-scraper | `cheerio` + custom HTML fetch | More code, same outcome; open-graph-scraper handles redirect chains, charset detection, and error wrapping out of the box |
| open-graph-scraper | `metascraper` | Heavier, plugin-based, overkill for a single `og:image` extraction |

**Installation:**
```bash
npm install open-graph-scraper
```

(No `@types` package needed — open-graph-scraper 6.x ships its own TypeScript declarations.)

---

## Architecture Patterns

### Recommended File Structure

The single new file is `ogService.ts` in the existing services directory:

```
api/src/services/
├── newsCollectorService.ts   # MODIFIED — call fetchAndStoreOgImage() post-insert
├── ogService.ts              # NEW — fetchOgImage() + fetchAndStoreOgImage()
└── ...existing services...
```

### Pattern 1: Non-Blocking Fire-and-Forget (same as logFetchAttempt)

**What:** After a successful DB insert, launch a background async operation without `await`. Attach `.catch(console.error)` to prevent unhandled promise rejection.

**When to use:** Any enrichment that must not delay the caller's response. The project already uses this pattern for `logFetchAttempt()`.

**Example (newsCollectorService.ts):**
```typescript
// After successful insert (rowCount > 0):
if (result.rowCount && result.rowCount > 0) {
  collected++;
  // Non-blocking OG fetch — mirrors logFetchAttempt() pattern
  fetchAndStoreOgImage(insertedId, item.url).catch(console.error);
}
```

### Pattern 2: ogService.ts Structure

```typescript
// api/src/services/ogService.ts
import ogs from 'open-graph-scraper';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { newsItems } from '../db/schema.js';

const GENERIC_URL_PATTERNS = ['default', 'logo', 'fallback', 'placeholder'];

/**
 * Returns the og:image URL from a page, or null if none / rejected as generic.
 */
export async function fetchOgImage(url: string): Promise<string | null> {
  const { error, result } = await ogs({
    url,
    timeout: 4, // 4 seconds — within the 3-5s requirement
    fetchOptions: {
      headers: { 'User-Agent': 'AI-Sanomat-Collector/1.0' },
    },
  });

  if (error || !result.ogImage || result.ogImage.length === 0) return null;

  const imageUrl = result.ogImage[0].url;
  if (!imageUrl) return null;

  // Reject generic site-wide images by URL path pattern
  const lowerUrl = imageUrl.toLowerCase();
  if (GENERIC_URL_PATTERNS.some((pat) => lowerUrl.includes(pat))) return null;

  return imageUrl;
}

/**
 * Fetches og:image and writes it to newsItems.ogImageUrl.
 * All errors are silently caught — the article record is never affected.
 */
export async function fetchAndStoreOgImage(
  newsItemId: number,
  url: string
): Promise<void> {
  const imageUrl = await fetchOgImage(url);
  if (imageUrl) {
    await db
      .update(newsItems)
      .set({ ogImageUrl: imageUrl })
      .where(eq(newsItems.id, newsItemId));
  }
}
```

### Retrieving the Inserted Row ID

`newsCollectorService.ts` currently uses `.onConflictDoNothing()` without returning the new row's `id`. To call `fetchAndStoreOgImage(id, url)`, the insert must return the ID. Drizzle's `.returning()` gives us this:

```typescript
const result = await db
  .insert(newsItems)
  .values({ ... })
  .onConflictDoNothing()
  .returning({ id: newsItems.id });

if (result.length > 0) {
  collected++;
  fetchAndStoreOgImage(result[0].id, item.url).catch(console.error);
}
```

**Note:** `.returning()` replaces the current `result.rowCount` check. `result.length > 0` is the new "new row was inserted" signal.

### Anti-Patterns to Avoid

- **`await fetchAndStoreOgImage()`** — blocks the item loop, violates IMAGE-02. Always fire-and-forget.
- **`Promise.all()` over all items** — makes OG fetch concurrent across all articles; could hit rate limits and slow down collection.
- **Fetching OG at digest generation time** — must happen at collection time per roadmap design; rendering must not wait on external HTTP.
- **`result.rowCount` after adding `.returning()`** — `rowCount` is a property of the raw `QueryResult`; using `.returning()` changes the return shape to an array. Use `result.length > 0` instead.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML fetch + OG parse | Custom `fetch` + regex/cheerio for `<meta property="og:image">` | `open-graph-scraper` | Handles redirect chains, charset, malformed HTML, twitter fallback tags, multiple image variants |
| Timeout cancellation | `AbortController` + `setTimeout` wiring | `open-graph-scraper`'s `timeout` option (seconds) | Built-in, tested, no boilerplate |
| Error discrimination | Try/catch around fetch | `open-graph-scraper`'s `error` boolean in return value | Consistent shape for 404, blocked, parse failures |

**Key insight:** `open-graph-scraper` wraps Fetch with decades of edge-case handling. A custom implementation would rediscover all the same problems.

---

## Common Pitfalls

### Pitfall 1: Blocking the Insert Loop

**What goes wrong:** Awaiting `fetchAndStoreOgImage` inside the `for (const item of items)` loop adds 3-5 seconds per article, turning a fast sync into a minutes-long hang.

**Why it happens:** Natural instinct to `await` all async functions.

**How to avoid:** Call without `await`, chain `.catch(console.error)` to handle rejection silently.

**Warning signs:** Collection takes proportionally longer as article count grows; scheduler timeout violations.

### Pitfall 2: Drizzle .returning() Shape Change

**What goes wrong:** After adding `.returning({ id: newsItems.id })`, accessing `result.rowCount` returns `undefined`; the "new row" check silently breaks.

**Why it happens:** `.returning()` changes Drizzle's return type from a `QueryResult` (with `.rowCount`) to a typed array.

**How to avoid:** Replace `result.rowCount && result.rowCount > 0` with `result.length > 0` immediately when adding `.returning()`.

**Warning signs:** `collected` counter always 0 despite articles being inserted; OG fetch never triggered.

### Pitfall 3: Generic Image Not Filtered

**What goes wrong:** A news site sets `og:image` to `https://example.com/assets/logo-default.png` for articles without specific images. The logo ends up in the newsletter for every story from that source.

**Why it happens:** URL check missing or patterns incomplete.

**How to avoid:** Filter against `['default', 'logo', 'fallback', 'placeholder']` on the full URL (lowercased). If the check grows complex, centralise it in `ogService.ts`.

**Warning signs:** Multiple stories from the same source all share the same image URL.

### Pitfall 4: Unhandled Promise Rejection

**What goes wrong:** Node.js crashes or emits `UnhandledPromiseRejection` when a fire-and-forget promise rejects.

**Why it happens:** Calling `fetchAndStoreOgImage(id, url)` without `.catch()`.

**How to avoid:** Always append `.catch(console.error)` — the existing `logFetchAttempt()` calls in the codebase demonstrate this pattern.

### Pitfall 5: timeout Option Is in Seconds, Not Milliseconds

**What goes wrong:** Passing `timeout: 4000` gives a 4000-second timeout — the operation never cancels.

**Why it happens:** Most JS timeout APIs use milliseconds; `open-graph-scraper`'s `timeout` is in **seconds**.

**How to avoid:** Use `timeout: 4` for a 4-second cutoff (within the 3-5s requirement).

---

## Code Examples

Verified patterns from official sources and codebase inspection:

### Install and Import (ESM / TypeScript)

```typescript
// Source: open-graph-scraper 6.11.0 README (ESM)
import ogs from 'open-graph-scraper';
```

### Basic Call with Timeout and Custom User-Agent

```typescript
// Source: open-graph-scraper README options table
const { error, result } = await ogs({
  url: 'https://example.com/article',
  timeout: 4,                          // seconds, NOT milliseconds
  fetchOptions: {
    headers: { 'User-Agent': 'AI-Sanomat-Collector/1.0' },
  },
});
```

### Return Value Shape

```typescript
// Source: open-graph-scraper TypeScript declarations
// SuccessResult shape when error === false:
result.ogImage // Array<{ url: string; width?: string; height?: string; type?: string }>
result.ogImage[0].url // The primary OG image URL
```

### Drizzle .returning() on Insert

```typescript
// Source: drizzle-orm docs pattern; replaces current rowCount check
const rows = await db
  .insert(newsItems)
  .values({ ... })
  .onConflictDoNothing()
  .returning({ id: newsItems.id });

if (rows.length > 0) {
  // New row was inserted
  fetchAndStoreOgImage(rows[0].id, item.url).catch(console.error);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| open-graph-scraper used `request` HTTP library | Now uses Node built-in Fetch API | v6.0 (2023) | No extra HTTP dependency; `fetchOptions` maps to Fetch API options |
| `timeout` was in milliseconds | Now in **seconds** | v6.0 | Must pass `4` not `4000` |
| Returns `{ result, error }` as separate values | Discriminated union `SuccessResult | ErrorResult` with `error` boolean | v5+ | Predictable error handling without try/catch |

---

## Open Questions

1. **Concurrent OG fetch volume**
   - What we know: Fire-and-forget means all inserts in a collection run can spawn OG fetches simultaneously
   - What's unclear: Maximum number of articles inserted per run; could be dozens triggering simultaneous external HTTP
   - Recommendation: Accept for now — each fetch is a single HEAD/GET to a public URL with a 4s timeout; Node.js handles this fine at typical collection volumes (10-50 articles/run). If rate-limit issues appear in future, add a queue.

2. **Web search / X-sourced items**
   - What we know: The `newsCollectorService.ts` also inserts items from web search (`searchForClient`) and X search (`searchXForClient`) via those services directly
   - What's unclear: Whether those services perform their own inserts internally or return items for the collector to insert
   - Recommendation: Inspect `webSearchService.ts` and `xCollectorService.ts` to confirm insert paths. If they insert independently, OG fetch wiring may need to be added there too (Phase 11 plan mentions only the RSS/Beehiiv path).

---

## Sources

### Primary (HIGH confidence)

- `open-graph-scraper` npm (v6.11.0) — confirmed via `npm show open-graph-scraper version`
- GitHub: jshemas/openGraphScraper README — API options table, return value shape, timeout semantics, ESM import
- `/Users/janne/coding/ai-sanomat-yrityksille/api/src/services/newsCollectorService.ts` — existing fire-and-forget pattern with `logFetchAttempt()`
- `/Users/janne/coding/ai-sanomat-yrityksille/api/src/db/schema.ts` — confirms `ogImageUrl text('og_image_url')` column already exists on `newsItems`

### Secondary (MEDIUM confidence)

- drizzle-orm `.returning()` pattern — consistent with drizzle docs; verified against existing codebase usage patterns

### Tertiary (LOW confidence)

- Generic image URL filtering patterns (`default`, `logo`, `fallback`, `placeholder`) — derived from roadmap success criteria wording; no authoritative list exists

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `open-graph-scraper` pre-specified in roadmap, version confirmed from npm registry
- Architecture: HIGH — fire-and-forget pattern is a direct copy of existing `logFetchAttempt()` usage in codebase
- Pitfalls: HIGH — Drizzle `.returning()` shape change and timeout-in-seconds are documented library behaviours; others derived from code analysis
- Generic image filter: MEDIUM — patterns copied verbatim from roadmap success criteria; exact list is a product decision

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (open-graph-scraper is a stable library; Drizzle APIs are stable)
