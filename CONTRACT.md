# Bible App — Build Contract (read fully before coding)

Expo SDK 57 · expo-router (routes live in `src/app/`) · TypeScript strict · English UI · KJV only.

## Hard rules
- Do NOT run `npm install`, do NOT edit `package.json`. Everything needed is installed:
  `@react-native-async-storage/async-storage`, `expo-audio`, `expo-font`, `@expo-google-fonts/crimson-pro`.
  If you truly need another package, do not install it — list it in your final report.
- Do NOT run `expo prebuild`, `expo run`, gradle, or eas — the main agent builds the APK at the end.
- Only touch files you own (see ownership). Never edit another agent's files.
- Do not edit `CONTRACT.md`.

## File ownership
- **CORE**: `src/app/_layout.tsx`, `src/app/onboarding.tsx`, `src/app/(tabs)/_layout.tsx`, `src/app/(tabs)/index.tsx`, `src/app/(tabs)/more.tsx`, `src/lib/theme.tsx`, `src/lib/settings.tsx`, `src/lib/store.ts`, `src/components/ui.tsx` (shared primitives: Screen, Card, Chip, TabBar-safe helpers)
- **DATA**: `src/assets/bible/**`, `src/lib/bible.ts`, `src/lib/search.ts`, `scripts/build-bible.mjs`
- **BIBLE**: `src/app/(tabs)/read.tsx`, `src/app/book-picker.tsx`, `src/app/search.tsx`, `src/components/verse-sheet.tsx`, `src/lib/audio.ts`, `src/lib/annotations.ts`
- **PLANS**: `src/assets/plans/**`, `src/lib/plans.ts`, `src/app/(tabs)/plans.tsx`, `src/app/plans/[id].tsx`, `src/app/plans/[id]/day/[day].tsx`, `scripts/gen-yearly.mjs`
- Main agent owns: `app.json`, root config files, README, final integration fixes (may edit anything to fix build errors).

## Navigation map (expo-router)
```
src/app/_layout.tsx          root Stack: ThemeProvider + fonts; on first launch redirect to /onboarding, else /(tabs)
src/app/onboarding.tsx       S-01  (shown once; sets settings.onboarded = true)
src/app/(tabs)/_layout.tsx   bottom tabs: Home=index, Read=read, Plans=plans, More=more
src/app/(tabs)/index.tsx     S-02 Home
src/app/(tabs)/read.tsx      S-03 Bible Reader
src/app/(tabs)/plans.tsx     S-07 Plans
src/app/(tabs)/more.tsx      S-10 More & Settings
src/app/book-picker.tsx      S-04 (presentation: "modal" via Stack.Screen options)
src/app/search.tsx           S-06 (pushed from reader / home)
src/app/plans/[id].tsx       S-08 (pushed from plans tab)
src/app/plans/[id]/day/[day].tsx  S-09 (pushed from plan detail)
```

## Design language
- Light: paper `#F6F1E6` bg, cards `#FBF8F0` (border `#E2DBC9`), ink text `#3E3226`, subtext `#8B8272`
- Dark: bg `#141A24`, cards `#1B2130` (border rgba(255,255,255,.10)), text `#EFE8D8`, subtext `#98A0B3`
- Accents both modes: gold `#C9A24B` (primary/progress), oxblood `#B45454` (active tab, buttons)
- Reading face: Crimson Pro (expo-font). UI face: system default (Roboto on Android). Reading font size from settings (14–28).
- Tone: plain, active-voice UI copy. Sentence case. Buttons say what they do ("Mark complete", "Continue reading").

## Storage (AsyncStorage keys — JSON values, all via src/lib/store.ts helpers)
| Key | Shape |
|---|---|
| `bible.settings` | `{ theme: "system"\|"light"\|"dark", fontSize: number, onboarded: boolean }` |
| `bible.position` | `{ book: string (abbrev), chapter: number }` — last reading position |
| `bible.highlights` | `{ [verseKey]: "yellow"\|"green"\|"blue"\|"pink"\|"purple" }` |
| `bible.bookmarks` | `string[]` (verseKeys, ordered) |
| `bible.notes` | `{ [verseKey]: string }` |
| `bible.planProgress` | `{ [planId]: { completed: number[] } }` |

**verseKey format**: `${abbrev}.${chapter}.${verse}` e.g. `Gen.1.1`. Abbreviations (66, canonical order):
Gen Exo Lev Num Deu Jos Jdg Rut 1Sa 2Sa 1Ki 2Ki 1Ch 2Ch Ezr Neh Est Job Psa Pro Ecc Sng Isa Jer Lam Ezk Dan Hos Jol Amo Oba Jon Mic Nam Hab Zep Hag Zec Mal Mat Mrk Luk Jhn Act Rom 1Co 2Co Gal Eph Php Col 1Th 2Th 1Ti 2Ti Tit Phm Heb Jas 1Pe 2Pe 1Jn 2Jn 3Jn Jud Rev

## DATA contract — src/lib/bible.ts
- Data files: `src/assets/bible/{BookName}.json` (e.g. `Genesis.json`, `1Samuel.json`, `3John.json`) — shape:
  `{ "name": "Genesis", "abbrev": "Gen", "chapters": [ ["v1 text","v2 text", ...], ... ] }`
- `type BookMeta = { name: string; abbrev: string; testament: "OT"\|"NT"; chapters: number }`
- `BOOKS: BookMeta[]` — all 66, OT then NT canonical order
- `getBookMeta(abbrev): BookMeta`
- `getChapter(abbrev, chapter): Promise<string[]>`
- `getChapterCount(abbrev): number`
- `ref(verseKey): string` → "Genesis 1:1"
- `src/lib/search.ts`: `searchBible(q: string, limit = 40): Promise<{ verseKey, ref, text }[]>` — case-insensitive substring across the whole KJV; terms split on spaces, all must match.

## PLANS contract — src/lib/plans.ts
- Data files: `src/assets/plans/{planId}.json` — shape:
  `{ "id","title","subtitle","description","accent":"#B45454"|"#C9A24B"|"#5B8DB8"|"#7FB069",
     "days":[ { "day":1, "label":"Genesis 1–3", "passages":[{ "book":"Gen","from":1,"to":3 }],
               "devotional":"150–250 words (short plans only)" } ] }`
- Five plans: `psalms-7` (7d, devotionals), `gospels-21` (21d, devotionals), `proverbs-5` (5d, devotionals),
  `yearly-canonical` (365d, Genesis→Revelation in order, no devotionals), `yearly-blended` (365d, OT+NT each day, no devotionals)
- `type PlanDay = { day, label, passages: {book,from,to?}[], devotional? }`
- `type Plan = { id, title, subtitle, description, accent, days }`
- `PLANS: Plan[]`, `getPlan(id): Plan | undefined`
- Yearly plans generated by `scripts/gen-yearly.mjs` (node script writes the two JSON files).

## BIBLE stack contracts
- `src/lib/annotations.ts`: typed helpers over the store keys above:
  `getHighlights()`, `setHighlight(verseKey, color|null)`, `getBookmarks()`, `toggleBookmark(verseKey)`,
  `getNotes()`, `setNote(verseKey, text|null)`, `getPosition()`, `setPosition(book, chapter)`.
- `src/lib/audio.ts`: `BOOK_AUDIO: Record<abbrev, string>` — LibriVox public-domain KJV recording,
  one URL per book where verified (HEAD 200). Reader shows a play control only when a URL exists.
  Streaming only — never bundle audio files.
- Reader (S-03): header "Book C" + KJV chip + optional ▶ audio button; tap verse → verse sheet (S-05);
  highlighted verses render behind-glyph color tint; opening reader restores last position.
- Verse sheet (S-05): 5 highlight colors, Bookmark toggle, Note (inline text input), Copy, Share (text).
- Book picker (S-04): modal — OT/NT segmented control, book list, chapter number grid for the selected book.
- Search (S-06): input + snippet list, tap → router.push to reader at that verse (reader accepts params `?book=&ch=&v=`).

## CORE contract
- `src/lib/theme.tsx`: `ThemeProvider`, `useTheme()` → `{ c: {bg, card, line, text, subtext, gold, ox}, isDark }`.
  Follows `bible.settings.theme` ("system" listens to useColorScheme). Provide `LIGHT`/`DARK` palettes per design language.
- `src/lib/store.ts`: tiny AsyncStorage JSON wrapper: `load<T>(key, fallback)`, `save(key, value)`, plus a `useStored<T>(key, fallback)` hook that re-reads on focus.
- `src/components/ui.tsx`: shared primitives used by all agents: `Screen` (safe-area + bg), `Card`, `Chip`, `PrimaryButton` (oxblood), `GhostButton`, `SectionLabel`.
- S-02 Home: Verse of the Day card (deterministic per date: e.g. verseKey = dayOfYear rotation across a curated list or Psa/Pro/Jhn pool) → "Read in context" → reader; Continue Reading card from `bible.position` with progress bar (book/chapter of 1,189 chapters); quick chips: Search, Plans, Random verse.
- S-10 More: library rows (Highlights / Bookmarks / Notes with counts → simple list screens? NO — keep counts + tap opens a list rendered inline below (no new routes; BIBLE owns verse-jump util `goToVerse(verseKey)` in `src/lib/annotations.ts`); settings rows: theme cycle (System/Light/Dark), font size stepper, default info (KJV).
- S-01 Onboarding: logo mark, one-line welcome, translation row (KJV — read-only chip), "Start reading" → sets onboarded, routes to /(tabs).

## Cross-agent imports (everyone may import, nobody may edit)
`src/lib/theme`, `src/lib/store`, `src/components/ui`, `src/lib/bible`, `src/lib/search`, `src/lib/plans`, `src/lib/annotations`, `src/lib/audio`.

## Definition of done per agent
- All owned files real and complete (no TODOs, no stubs).
- `npx tsc --noEmit` — your files contribute zero errors (ignore errors in other agents' in-progress files, list them if they block you).
- Data-producing agents: run their node scripts and verify outputs (counts, shapes) before finishing.
