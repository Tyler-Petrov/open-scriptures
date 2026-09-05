# @openscripture/backend

Convex functions behind the Bible app. See the root `README.md` for setup and env vars.

- `convex/chapters.ts` — `get` (reactive read; says `missing`/`passthrough`/`stale` when the client should call `load`), `load` (fetches from API.Bible or Crossway, stores API.Bible chapters in `chapterCache`), `purgeExpired` (cron), `purgeTranslation` (run by hand when a licence ends).
- `convex/search.ts` — `exact`: Convex search index for permanent text, publisher search for NASB/NIV/NKJV/ESV.
- `convex/verses.ts` — `lookup`: text for a list of verse keys (semantic hits, library snippets).
- `convex/commentary.ts` — commentary entries covering one verse.
- `convex/timings.ts` — LibriVox chapter and verse offsets for one book.
- `convex/translations.ts` — `list`: each translation with availability and attribution.
- `convex/lib/providers/*` — API.Bible and ESV HTTP clients and response parsers.

KJV text, commentary, and timings are stored as Convex deployment data. Back them up with a Convex
snapshot export instead of committing source copies to this package.

Cache policy for API.Bible text: refresh after 14 days, purge after 30 (`@openscripture/core` constants).
ESV is never written to the database.

## Strong's data

`convex/strongs.ts` serves a shared dictionary (`entry`), a translation's chapter word links
(`chapter`), and its concordance references (`occurrences`). Every public query enforces the
existing app client key. Dictionary entries retain their explicitly labeled historical KJV usage.

`strongsChapters` is indexed by translation, book, and chapter. Its source label identifies the
alignment dataset. Verse records contain UTF-16 offsets, Strong's codes, supplied-word flags,
and a text fingerprint, with no Scripture text. The client applies links
only when the fingerprint matches the displayed verse and all offsets are valid. It always
renders the text fetched from the selected translation's provider, unchanged.

Only KJV alignments are included today. NASB, NIV, NKJV, and ESV queries return no links until
verified alignments for that particular translation and edition are imported. Sharing the lexicon
does not make KJV word positions valid for another translation. Do not infer alignments from
similar English wording. Confirm rights to use each alignment dataset before importing it.

### Initial import and rollout

Use Node 22.18 or later for the import and test scripts. From the repository root:

```bash
# In a separate terminal, keep the chosen development deployment running.
cd packages/backend
npx convex dev

# From the repository root, prepare and validate the existing KJV data.
node packages/backend/scripts/import-strongs.mjs

# Inspect packages/backend/.env.local to confirm the intended deployment first.
# Append the data to its new tables. This never replaces or deletes existing rows.
node packages/backend/scripts/import-strongs.mjs --import
```

The importer validates every verse round trip and checks document sizes before writing JSONL.
The `--import` preflight refuses to append if that translation already has chapter or occurrence
rows, preventing accidental duplicates. An existing shared dictionary is left in place. Do not
run concurrent imports. If an import is interrupted, inspect the tables and the Convex import
status before resuming; this script deliberately does not erase or overwrite partially imported data.
The committed KJV `occurrences.json` is retained as a migration regression fixture. Runtime
occurrences are rebuilt from the same links that produce the chapter records.

Deploy the schema and functions, then import all three tables into the app's deployment before
releasing the updated mobile client. This PR's validation uses an isolated local deployment;
it does not populate production. Export a Convex snapshot after import to back up the records.

For another translation, provide a directory of independently aligned `{BookName}.json` files
in the same `{book, chapters}` span format as the KJV source and an explicit source label:

```bash
node packages/backend/scripts/import-strongs.mjs \
  --translation NASB --input /path/to/verified-nasb-alignments \
  --source 'dataset name, edition, revision' --out /tmp/nasb-strongs
```

Review the generated files before rerunning with `--import`. Missing books/verses remain
unavailable. The importer does not fetch or generate licensed translation alignments. Keep
licensed input files outside this repository. Only fingerprint and offset metadata enters Convex.
The initial import is intentionally separate from updating an existing dataset; updates need an
explicit migration that keeps chapter links and occurrence indexes consistent.

To regenerate the public-domain KJV source, run
`python3 packages/backend/scripts/build-strongs.py`. The dictionary and raw alignment inputs
live under `packages/backend/data/strongs`, outside both the mobile bundle and Convex function
imports. Source URLs are recorded in the builder.

### Verification

```bash
node --test packages/backend/scripts/strongs.test.mjs
# After importing KJV into the isolated local deployment at port 3210:
node --test packages/backend/scripts/strongs-live.test.mjs
npm run typecheck
npm run lint
```

### Multiple words and source-word identities

New links use `codes: string[]`. The reader presents every linked dictionary entry as a choice
in the word sheet and loads the selected entry's references. Multiple codes never become a
single comma-separated lookup key. The KJV builder now preserves every source tag, including
detached tags, and the concordance includes a verse once for each of its linked codes.

The schema also accepts the earlier `code: string | null` form so previously imported rows
remain readable during deployment. The import script always writes the new form. For data that
was already imported from an earlier revision of this PR, use a reviewed migration of the two
alignment tables; rerunning the initial append-only importer intentionally refuses duplicates.
No production data was changed while building this extension.

For datasets with original-language word identities, a verse can use this richer format instead
of the compact span array. IDs are local to the verse and identify individual word occurrences,
so repeated words can share a Strong's number without sharing an ID:

```json
{
  "text": "one two three",
  "sourceWords": [
    { "id": "w1", "codes": ["G1"], "text": "α", "morphology": "N" },
    { "id": "w2", "codes": ["G2"], "text": "β" }
  ],
  "links": [
    { "start": 0, "end": 7, "sourceWordIds": ["w1"] },
    { "start": 4, "end": 13, "sourceWordIds": ["w1", "w2"] }
  ]
}
```

This example is synthetic. Offsets use UTF-16 code units. The importer derives codes from the
referenced source words and validates IDs and ranges. Overlapping links combine their codes;
one source word can also link to multiple separated ranges. Optional source text and morphology
are preserved when supplied; the KJV tag source does not identify original-word occurrences,
so its importer does not invent those IDs or inflected forms. The English `text` field is used
only to validate offsets and compute the fingerprint; it is not stored in alignment records.

Run the source-tag regression tests with
`python packages/backend/scripts/test_strongs_builder.py`. Regenerate only the KJV links with
`python packages/backend/scripts/build-strongs.py --alignments-only` to preserve the shared lexicon.

A browser regression test records opening a real multi-code word, switching dictionary entries,
checking each entry's reference count, navigating to an occurrence, and dismissing the sheet.
It also verifies that ordinary verse words are not italicized. It requires Playwright, the local
backend seeded with KJV chapter text plus Strong's data, and Expo running on port 8082 with
`EXPO_PUBLIC_CONVEX_URL=http://127.0.0.1:3210`:

```bash
# PLAYWRIGHT_MODULE may point to an existing Playwright module outside this repo.
node packages/backend/scripts/strongs-browser.mjs
```

The current KJV rebuild maps 30,360 of 31,102 verses and contains 3,901 multi-code spans.
A full comparison against the first PR revision preserved verse text, coverage, existing word
codes, and supplied-word italics. Reference counts describe the available links in this dataset,
not an independently complete concordance. See `docs/strongs-data-sources.md` for provenance,
BLB's documented approach, and standards and open-data options.
