# @openscripture/backend

Convex functions behind the Bible app. See the root `README.md` for setup and env vars.

- `convex/chapters.ts` — `get` (reactive read; says `missing`/`passthrough`/`stale` when the client should call `load`), `load` (fetches from API.Bible or Crossway, stores API.Bible chapters in `chapterCache`), `purgeExpired` (cron), `purgeTranslation` (run by hand when a licence ends).
- `convex/search.ts` — `exact`: Convex search index for bundled text, publisher search for NASB/NIV/ESV.
- `convex/verses.ts` — `lookup`: text for a list of verse keys (semantic hits, library snippets).
- `convex/translations.ts` — `list`: each translation with availability and attribution.
- `convex/lib/providers/*` — API.Bible and ESV HTTP clients and response parsers.
- `scripts/build-seed.mjs` — KJV JSONL for `npx convex import` (`npm run seed`).

Cache policy for API.Bible text: refresh after 14 days, purge after 30 (`@openscripture/core` constants).
ESV is never written to the database.
