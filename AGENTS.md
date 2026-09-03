# Open Scripture monorepo

npm workspaces. Read `README.md` first.

- `apps/mobile` — Expo SDK 57 app (its own `AGENTS.md`/`CONTRACT.md` still apply inside it).
- `packages/backend` — Convex backend. Scripture is served from here; API keys live only in Convex env vars.
- `packages/core` — shared book table, translation config, verse-key helpers (no runtime deps).
- `docs/scripture-api-context.md` — licensing and caching rules for NASB/NIV (API.Bible) and ESV (Crossway). Follow it.
