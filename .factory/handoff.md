# Together Room — build handoff

Work order: `clean-family-coop-room-build-1`

Completed: 2026-08-28

## What shipped

- A two-device, invite-only PWA with six-digit room codes, private device reconnect keys, automatic WebSocket recovery, connection presence, and two-hour safety expiry.
- Three complete original turn-based co-op games: Star Signal (split clues), Patchwork Pair (alternating shared mosaic), and Firefly Ferry (split-axis navigation). Either player can choose a game; rounds can be replayed without recreating the room.
- An Axum/Tokio backend with authoritative game validation, SQLite persistence, hashed reconnect tokens, structured JSON logs, secure response headers, request-size limits, static compression/caching, `/health`, cleanup, and graceful shutdown.
- A responsive 390 px/desktop pixel-demoscene interface with keyboard/touch paths, visible focus, live state/error announcements, reduced-motion treatment, offline/reconnecting states, installable manifest, and service-worker shell caching.
- An original factory-generated pixel-art hero, reviewed and optimized from a 1.7 MB source to 39 KB/79 KB WebPs. Prompt, model/date, review, and source are recorded in `.factory/design.md` and `assets/src/`.
- Optional US$8 one-time Family Pack integration using only the Sociobot hosted checkout and license verification contract. Returned licenses are stored under `sb_license:clean-family-coop-room`, stripped from the URL, cached for daily verification, restorable by paste, and never block the free experience.
- Plain-language `/privacy` and `/terms`, expanded README, MIT license, multi-stage non-root container, and no analytics, advertising, CDN fonts, third-party runtime scripts, profiles, chat, UGC, or matchmaking.

## Verification

All of these passed locally:

- `npm test` — 3 Vitest tests and 4 Rust unit/integration tests.
- `npm run build` — reproducible output at `dist/index.html`; initial JavaScript 22.44 KB (8.71 KB gzip), CSS 14.59 KB (4.18 KB gzip), mobile hero 39 KB.
- `npm run check` — strict TypeScript plus `cargo clippy --all-targets -- -D warnings`.
- `npm run test:e2e` — 8/8 Playwright checks on Chromium desktop and a touch-enabled 390×844 mobile viewport. Two isolated contexts joined, completed all three games, and reconnected after reload; axe found no serious/critical violations; console remained clean; legal and paid-license return paths passed.
- Factory `verify-url.sh` — HTTP 200, title, `lang=en`, exactly one `h1`, main landmark, alt text, and zero console/page errors. Observed page load: 615 ms locally.
- Lighthouse mobile: **100 performance / 100 accessibility / 100 best practices / 100 SEO**; FCP 0.9 s, LCP 1.3 s, CLS 0, TBT 0 ms.
- Load smoke: 500/500 successful `/health` responses at 338 requests/second against the debug server (target was 100 rps).
- `npm audit` — 0 known vulnerabilities after updating Vite and Vitest to patched releases.
- `cargo build --release` — production Rust binary built successfully.
- Visual inspection at 1440×1000 and 390×844; a figure-margin overflow found on the first mobile pass was corrected and rechecked at a 390 px document width.

## Run and deploy

Development and verification commands are in `README.md`. The factory build command is exactly:

```bash
npm ci && npm run build
```

Container deployment uses the root `Dockerfile`, listens on `PORT` (default 8080), serves `FRONTEND_DIR`, and writes SQLite to the configured `DATABASE_URL`. The image runs as UID/GID 10001 and expects writable `/data`.

## Known gaps / factory next steps

- The local worker image has no Docker CLI, so `docker build` could not be executed here. Both constituent production builds passed and the Dockerfile was reviewed, but CI/deployment should perform the actual image build and `/health` smoke.
- The factory still needs to register the paid product slug with Sociobot and configure its checkout return URL. License behavior is browser-tested with a contract-faithful mocked verification response; no product ID or payment-provider secret is embedded.
- The success measure is intentionally not tracked in-product because the contract favors analytics minimization. If aggregate completion measurement is required later, derive anonymous counters server-side without device identifiers and document the privacy change first.
