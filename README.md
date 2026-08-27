# Together Room

Together Room is a private, two-device co-op room for a parent and child who want ten minutes of play without an account, ad, chat, tracker, or recurring service. One player creates a six-digit room; the other opens the invite; both take turns in three original games:

- **Star Signal** — reconstruct a six-symbol sequence from alternating clues.
- **Patchwork Pair** — place a shared nine-tile color pattern.
- **Firefly Ferry** — steer one light together using split movement controls.

Room state survives reloads and short disconnects, is stored in SQLite, and expires after two hours. Reconnect keys are stored as server-side hashes. The optional US$8 one-time family pack uses the Sociobot hosted checkout/license API and adds cosmetic palettes and celebrations; every game and safety/accessibility feature is free.

Live product: <https://clean-family-coop-room.sociobot.in>

## Stack

- Vite + strict vanilla TypeScript PWA frontend
- Rust 2021, Axum WebSockets, Tokio, SQLx/SQLite backend
- One non-root container serving the built frontend and API on `PORT`

No third-party runtime scripts, fonts, analytics, or paid service dependencies are used.

## Develop

Requirements: Node 22+, npm, Rust 1.88+.

```bash
npm ci
npm run dev          # frontend on :5173, proxies API to :8080
npm run dev:server   # in another terminal; backend on :8080
```

The backend accepts these environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | HTTP port |
| `DATABASE_URL` | `sqlite://together-room.db?mode=rwc` | SQLite connection |
| `FRONTEND_DIR` | `dist` | built assets to serve |
| `RUST_LOG` | info filters | structured log level |

## Build and verify

```bash
npm test             # Vitest plus Cargo unit/integration tests
npm run build        # reproducible frontend output at dist/index.html
npm run check        # strict TypeScript and clippy
npm run test:e2e     # Chromium desktop + 390 px mobile, axe included
docker build -t together-room .
docker run --rm -p 8080:8080 -v together-data:/data together-room
```

Playwright is pinned to `1.58.2`. Its browser should already be present in the factory image; elsewhere run `npx playwright install chromium` once.

## Privacy and safety

There are no user profiles, public listings, chat, UGC, or matchmaking. Rooms have only game state, token hashes, timestamps, and a two-hour expiry. Purchase tokens remain in local storage and are checked directly with Sociobot at most daily. See the product’s `/privacy` and `/terms` routes for the user-facing policies.

The opportunity brief is in `.factory/brief.json`, the authored visual system and image provenance are in `.factory/design.md`, and verification results are in `.factory/handoff.md`.

## License

MIT — see [LICENSE](LICENSE).
