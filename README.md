# Open Scripture

Monorepo for Open Scripture: an Expo client plus a Convex backend that serves scripture in
several translations.

```
apps/mobile         Expo SDK 57 / React Native app (Android, iOS, web)
packages/backend    Convex backend — chapter text, search, verse lookup, cache purge cron
packages/core       Shared book table, translation config, verse-key helpers
docs/               Design blueprint and the licensing/caching notes for API.Bible and Crossway
```

## Translations

| Id   | Source                      | Served from                           | Cached on server        |
|------|-----------------------------|---------------------------------------|-------------------------|
| KJV  | Public domain dataset       | Convex                                | Permanent |
| NASB | API.Bible                   | Convex, fetched on first read         | 14-day refresh, 30-day purge |
| NIV  | API.Bible                   | Convex, fetched on first read         | 14-day refresh, 30-day purge |
| NKJV | API.Bible                   | Convex, fetched on first read         | 14-day refresh, 30-day purge |
| ESV  | Crossway ESV API            | Convex, fetched on every read         | Never                   |

Every read goes through Convex, KJV included. Commentary and LibriVox verse timings also live in
Convex. The mobile bundle keeps only the derived Strong's and semantic-search indexes.

Rules that shaped this (full notes in `docs/scripture-api-context.md`):
- API keys live only in Convex env vars and never reach the client.
- ESV text is never stored; if Crossway can't be reached the reader says so instead of showing KJV.
- Licensed text is shown unchanged with its attribution under the chapter and on copy/share.
- Exact search runs on the selected translation's own provider. Semantic search uses the on-device
  KJV index, then fetches the hits in the selected translation.

## Setup

```bash
npm install                      # installs all workspaces (hoisted)
cd packages/backend
npx convex dev --once            # log in / pick the deployment; writes .env.local
cd ../../apps/mobile
cp .env.example .env             # set EXPO_PUBLIC_CONVEX_URL to the deployment URL
```

KJV text, commentary, and timing records are deployment data rather than repository assets. Use a
Convex snapshot export to back them up and import that snapshot when provisioning another deployment.

Convex env vars (dashboard → Settings → Environment variables):

| Var | Purpose |
|-----|---------|
| `API_BIBLE_KEY` | Shared API.Bible application key for NASB, NIV, and NKJV |
| `API_BIBLE_NASB_ID`, `API_BIBLE_NIV_ID`, `API_BIBLE_NKJV_ID` | Bible ids from the API.Bible dashboard once the translation agreements are accepted |
| `ESV_API_KEY` | Crossway ESV API key |
| `APP_CLIENT_KEY` | Optional. When set, every call must carry the same value from `EXPO_PUBLIC_CLIENT_KEY` |

A translation whose vars are missing shows as unavailable in the picker with the reason.

## Day to day

```bash
npm run dev:backend              # convex dev (watch + push)
npm run dev:mobile               # expo start
npm run web                      # expo start --web
npm run typecheck                # tsc in every workspace
npm run lint
```

Android builds run from `apps/mobile/android` exactly as before (see `apps/mobile/README.md`).
Gradle resolves `react-native`/Expo through Node, so the hoisted `node_modules` at the repo root
is fine. `apps/mobile/scripts/patch-ort.js` (postinstall) finds `onnxruntime-react-native` through
`require.resolve` for the same reason.

If a licence or API access ends, drop the cached text right away:

```bash
cd packages/backend && npx convex run chapters:purgeTranslation '{"translation":"NIV"}'
```
