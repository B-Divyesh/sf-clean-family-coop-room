# Together Room — independent verification 1

**Result: FAIL**

Verified 2026-08-28 against candidate `4d7d2aec35340da40d2e1133816eb2e4d1e57b7a` from a clean `main` checkout and the live URL <https://clean-family-coop-room.sociobot.in>.

## Release-blocking findings

### P1 — no request rate limiting on a child-facing six-digit room service

The backend has no rate-limiting dependency or router/middleware configuration (`Cargo.toml`, `src/main.rs`, and `src/routes.rs`); it accepts unauthenticated room creation and six-digit-code join attempts. This violates the backend-service acceptance contract's required rate limiting and undermines the product's private, invite-only/COPPA-aware boundary: an automated client can make unbounded room-code guesses or create-room requests. No `Retry-After`/rate-limit response policy is present. This needs server-side, per-client/IP rate limiting before acceptance.

### P2 — health endpoint does not identify the deployed build

`GET https://clean-family-coop-room.sociobot.in/health` returned `200 {"build":"dev","status":"ok"}`. The locally built candidate does the same. `src/main.rs` falls back to `"dev"` when `BUILD_SHA` is not compiled in, and the candidate Dockerfile never supplies that build argument/environment. This fails the health/build-identity acceptance requirement. Static artifact parity (below) proves the deployed shell is this candidate, but the backend cannot independently attest its own SHA.

## Evidence that passed

- Clean install: `npm ci` completed; `npm audit --omit=dev --audit-level=high` found 0 vulnerabilities.
- Automated checks: `npm test` passed (3 Vitest + 4 Rust tests); `npm run check` passed (strict TypeScript and `cargo clippy --all-targets -- -D warnings`); `npm run build` passed; `cargo build --release` passed.
- Browser suite: `npm run test:e2e` passed all 8 Chromium checks (desktop and 390×844 touch viewport). It exercises two independent devices, creation/join, all three games, round completion, and reconnect after reload.
- Manual/API boundary checks against live: malformed room code `12A456` → 400; unknown code → 404; room creation → 200; second join → 200; third join → 409. A 16-way concurrent join race yielded exactly 1 × 200 and 15 × 409.
- Persistence: a room created against a local SQLite database could be joined after graceful server stop/restart (200). A release-binary `/health` load smoke yielded 500/500 successful responses in 1,258 ms (397 req/s).
- PWA: live service worker became controlling, `registration.update()` left no waiting/installation worker, and a 390 px context reloaded offline from the cached shell with HTTP 200 and the landing h1. No console/page errors occurred; requests on first load went only to `clean-family-coop-room.sociobot.in`.
- Accessibility: live desktop and 390 px axe scans had 0 serious/critical violations. Keyboard Tab exposed the skip link with a 3 px visible outline and 6 px sky ring. At 390 px, `scrollWidth === clientWidth === 390`; reduced-motion computed animation/transition durations were `0.00001s`.
- Basic live check: factory `verify-url.sh` returned 200 in 882 ms, with title, `lang=en`, one h1, main landmark, no missing image alt attributes, and zero console/page errors.
- Privacy/security response policy: no third-party runtime hosts were requested. Live root and asset responses include CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: no-referrer`; API/health use `Cache-Control: no-store`, the hashed JS uses `public, max-age=31536000, immutable`, and the root uses `no-cache`.
- Budget: built initial JS is 22.44 kB (8.71 kB gzip), CSS 14.59 kB (4.18 kB gzip), and mobile hero 39,562 bytes — all under contract budgets. Lighthouse 13.4.1 was attempted with the installed Playwright Chromium but its browser tab crashed while collecting the full-page screenshot, so no Lighthouse score is claimed.
- Deployment parity: SHA-256 hashes matched exactly for live versus local candidate `index.html`, JS, CSS, manifest, service worker, robots, both SVGs, and both hero WebPs. The only live health identity is nevertheless `dev` (P2 above).

## Environment limitations

The container has no `docker` or `podman` executable, so the Docker image could not be built/run here. The exact frontend production build and the Rust release build both passed separately. This is an environment limitation, not the reason for the FAIL result.

## Required next steps

1. Add and test an appropriate server-side rate limiter for room create/join and WebSocket upgrade paths; return clear retry responses.
2. Inject the immutable Git SHA into the release binary/image and make `/health` return it; redeploy and re-verify it against the requested commit.
3. Run the Docker build and container health smoke in an environment with Docker, then rerun Lighthouse in a stable browser environment.
