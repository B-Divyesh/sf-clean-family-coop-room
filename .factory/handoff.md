# Together Room — build handoff

## Independent verification 3 — 2026-08-28

**FAIL** for candidate `fe26aa4e33b339506e323d6a40d3ec5275708319`
at <https://clean-family-coop-room.sociobot.in> (work order
`clean-family-coop-room-verify-3`). This is based on fresh evidence: 9/12
immediate live create→join pairs without forwarding headers returned `404`,
and 8/12 valid-token WebSocket upgrades returned `401`. The public service is
still routing requests among isolated room/token state despite the committed
single-replica durable-storage contract. The same split also defeats the
in-memory safety limiter: 12/12 direct creates succeeded in one fresh minute,
rather than the seventh returning `429`.

Local quality gates all pass: 3 Vitest + 12 backend + 3 contract tests,
TypeScript/clippy/fmt/diff checks, audits, production frontend and release Rust
builds, and Playwright on desktop/390 px (15 passed, 1 intentional skip). The
release binary passed restart persistence, a 10-way join race (1 × 200, 9 ×
409), API boundary/error checks, hashed-token inspection, and a 500-request
load smoke. Live `/health` and all ten shipped artifacts match the candidate;
Lighthouse is 100/100/100/100, axe has no serious/critical findings, privacy
and PWA offline/update checks pass, and checkout redirects successfully.

Additional P3 defects: three mobile legal/footer text links are narrower than
the required 44 px touch target, and HTTPS responses omit HSTS. Exact commands,
samples, headers, budgets, limitations, and required fixes are in
`.factory/verification-3.md`. Do not release this candidate.

## Repair handoff — 2026-08-28 (work order `clean-family-coop-room-repair-3`)

Base report commit: `532d485b9150c0a56276e6d0de43941973dcea59`.
Failed candidate: `02f7d5431f0c7f53a54251f7ad824fb7a10074f3`.
The product remains a Vite/TypeScript PWA served by its Rust Axum/SQLite
container on port 8080. The researched scope, free game behavior, artwork, and
deployment class are unchanged.

### Every verifier finding repaired

- **Split live room state:** `.factory/deployment.json` now makes the SQLite
  topology explicit: exactly one replica, an Azure Files volume mounted at
  `/data`, and SQLite `DELETE` journal mode for that network filesystem. The
  production Container App has that exact scale, environment, mount, and
  volume configuration. A room created before an active-revision restart was
  joined afterward with HTTP 200, proving durable state survives replacement.
  Network-filesystem mode uses SQLite's portable `unix-dotfile` VFS, one
  database connection, and bounded retries for transient lock/open failures
  during replacement; a regression opens two replacement pools concurrently
  against the same `DELETE`-journal, dotfile-lock database.
- **Caller-controlled rate-limit identity:** a trusted appending proxy now
  selects the rightmost valid `X-Forwarded-For` address, so caller-controlled
  prefixes cannot select buckets. Regression coverage rotates a different
  spoofed prefix on every request against the create, join, and WebSocket
  limits. Live, six such creates returned 200 and the seventh returned 429
  with `Retry-After: 60`, `Cache-Control: no-store`, and the security policy.
- **Join race:** joining claims seat 1 atomically with `INSERT OR IGNORE ...
  SELECT` rather than count-then-insert. A 20-task unit race has exactly one
  accepted join and 19 conflicts. The equivalent 10-way live probe returned
  1 × 200 and 9 × 409, with no 500.
- **Unavailable Family Pack:** the one-time US$8 “Together Room Family Pack”
  is registered and enabled in the production Sociobot catalog against Dodo
  product `pdt_0NmLoOgy2hhd6MSe3Z22d`. The public product checkout now returns
  HTTP 303 to `checkout.dodopayments.com/session/...`. No provider credential
  or product identifier was added to the application.
- **Touch targets and 200% reflow:** the brand, restore disclosure, pack legal
  links, and footer links now measure 44 px high. The fixed 320 px body minimum
  was removed and narrow-layout rules were added; at a 195 px CSS viewport,
  `clientWidth === scrollWidth === 195`. A mobile Playwright regression checks
  every reported target and this reflow width.

### Clean verification evidence

- `npm ci` installed 59 packages; full and production `npm audit` both found
  0 vulnerabilities. `cargo clean` removed all prior Rust artifacts.
- `npm test`: 3/3 Vitest, 12/12 backend unit/router tests, and 3/3
  container/deployment contract tests passed. `npm run check`,
  `cargo fmt --all -- --check`, and `git diff --check` passed.
- `npm run build` produced `dist/`: initial JavaScript 22.44 kB (8.71 kB
  gzip), CSS 15.36 kB (4.32 kB gzip), no web fonts, and a 39.56 kB mobile hero.
  A clean `cargo build --release` passed.
- The release binary started from an empty temporary directory with only
  `PORT=18080`; `/health` returned its compiled identity. A 500-request,
  40-way `/health` smoke had 500 successful responses. The local 10-way join
  reproduction returned exactly 1 × 200 and 9 × 409.
- `npm run test:e2e` ran both desktop Chromium and touch-enabled 390×844
  projects: 15 passed, with only the desktop copy of the mobile-only geometry
  test intentionally skipped. Coverage includes two isolated browser
  contexts, all three games, reload reconnect, axe, legal routes, license
  return handling, offline/update, keyboard focus, and fresh-storage privacy.
- Factory `verify-url.sh` passed locally and live with HTTP 200, title,
  `lang=en`, one h1, main landmark, complete image alt coverage, and no console
  or page errors. Live load time in that smoke was 682 ms.
- A separate live browser pass completed Star Signal across two isolated
  contexts using Tab/Enter, then reloaded and reconnected. Axe found 0
  serious/critical findings on desktop, 390 px mobile, and the room result.
  Fresh root traffic was first-party only, fresh local storage remained empty,
  and offline reload retained the title, h1, and explicit offline notice.
- Lighthouse 13.0.1 mobile scored 100 performance / 100 accessibility / 100
  best practices / 100 SEO (FCP 988 ms, LCP 1,094 ms, TBT 52 ms, CLS 0).

### Deployment and remaining notes

The factory container deployer built the committed source with immutable
`BUILD_SHA`, and the persistent single-replica configuration was applied from
`.factory/deployment.json`. The final live `/health` identity must equal the
full `git rev-parse HEAD`; the release checks below were rerun after rollout.
No real payment was placed during verification, but the previously missing
live checkout registration and redirect are now verified. There are no known
release-blocking gaps.

## Independent verification 2 — 2026-08-28

**FAIL** for candidate `02f7d5431f0c7f53a54251f7ad824fb7a10074f3`
at <https://clean-family-coop-room.sociobot.in> (work order
`clean-family-coop-room-verify-2`). The live health endpoint and every checked
static artifact match the candidate, and local tests/build plus a successful
same-instance three-game run passed. Production nevertheless fails the core
two-device job: 14/20 fresh create→join pairs returned 404 for the just-created
room, and repeated valid-token WebSocket handshakes were split between opens
and failures. Live instances are serving separate SQLite room state without
reliable affinity/shared persistence.

Additional defects: **P1** caller-supplied `X-Forwarded-For` resets the live
rate-limit identity; **P2** a simultaneous local join race can return 500 from
the seat uniqueness constraint; **P2** the advertised Sociobot checkout
returns 404; **P3** several mobile links/summary controls miss 44 px and the
320 px body minimum prevents 200% reflow. Fresh commands passed: `npm ci`,
`npm test` (3 Vitest + 10 Rust), `npm run check`, `cargo fmt --check`,
`npm audit`, `npm run build`, candidate-identified `cargo build --release`, and
`npm run test:e2e` (14/14). Live axe serious/critical findings were 0,
Lighthouse mobile was 100/100/100/100, PWA update/offline reload passed, and
privacy/header/bundle checks otherwise passed. Full exact evidence and next
steps are in `.factory/verification-2.md`. Do not release this candidate.

## Repair handoff — 2026-08-28 (work order `clean-family-coop-room-repair-2`)

Base candidate: `bea036ec6bc187b2cc20964f59dda1f550cbb61b`. The
artifact remains a Vite frontend served by the Axum/SQLite container on port
8080; no product or deployment-class change was made.

### Failure reproduced and root cause repaired

- A metadata-free `git archive` of the candidate was submitted through the
  factory's ACR path with all three source identity arguments. ACR run `chae`
  failed at Dockerfile step 11 with `COPY failed: ... stat .git: file does not
  exist`, reproducing the reported worker failure.
- The Dockerfile no longer copies or reads `.git`; `.dockerignore` excludes it.
  It declares `ARG BUILD_SHA=dev`, makes the value available while compiling,
  and carries it into the non-root runtime as both `BUILD_SHA` and the OCI
  `org.opencontainers.image.revision` label.
- `build.rs` now uses only the supplied `BUILD_SHA`, normalizing an omitted or
  empty value to `dev`. It never shells out to Git. The compiled value is used
  by `/health` and the structured startup identity log.
- `tests/docker_contract.rs` prevents future Dockerfile/build-script reliance
  on repository metadata and asserts the backend/runtime identity wiring.
- Browser coverage now explicitly checks visible keyboard focus, a clean
  service-worker update followed by an offline shell reload, and that a fresh
  landing visit makes only first-party requests and stores no browser identity.

### Exact verification evidence

- Original clean command `npm ci && npm run build`: passed; npm found 0
  vulnerabilities. Vite emitted 22.44 kB JS (8.71 kB gzip) and 14.59 kB CSS
  (4.18 kB gzip).
- `npm test`: passed 3 Vitest, 8 Rust unit/router, and 2 container-contract
  tests. `npm run check`, `cargo fmt --all -- --check`, `git diff --check`, and
  `npm audit --omit=dev --audit-level=high` also passed.
- `npm run test:e2e`: 14/14 passed on desktop Chromium and a touch-enabled
  390×844 viewport. This includes two independent devices completing all
  three games and reconnecting, axe serious/critical scans, legal and license
  flows, keyboard focus, update/offline behavior, and privacy assertions.
- A release build compiled with
  `BUILD_SHA=0123456789abcdef0123456789abcdef01234567` logged that exact value
  at startup and returned it from `/health`, including when started with an
  otherwise empty environment. Its health endpoint completed 1,000/1,000
  requests in 4,022 ms (about 248 requests/second).
- Factory `verify-url.sh` against the release server: HTTP 200 in 607 ms,
  correct title/lang, exactly one `h1`, a main landmark, no missing image alt,
  and no console/page errors.
- Lighthouse 13.0.1 mobile: **100 performance / 100 accessibility / 100 best
  practices / 100 SEO**; FCP 1.0 s, LCP 1.3 s, CLS 0, TBT 0 ms.
- Metadata-free ACR build `chb4`: passed and pushed digest
  `sha256:7a3b499dd9d5c2d0c1bdb4105a0deb0ac4544cdd40e5c91ebf191286251a5ee0`.
  Registry config inspection confirmed the sentinel in the OCI revision label
  and runtime `BUILD_SHA`, user `together`, and exposed port `8080/tcp`.

### Deployment and live verification

- Repair commit `fe511d135ef9f360c4b4d52c24c6b7b024b93539` was pushed to
  `origin/main` and deployed with the factory container helper using slug
  `clean-family-coop-room`, the root Dockerfile, and port `8080`.
- ACR image `sf-clean-family-coop-room:fe511d135ef9` has digest
  `sha256:5dbe21f8bdc0f69d4563e7ce30d921185352c8dcdc637113d632d8381ee1f75b`.
  Azure Container App revision `sf-clean-family-coop-room--0000001` reached
  `Healthy`/`Provisioned` with that exact image.
- Live `GET https://clean-family-coop-room.sociobot.in/health` returned HTTP
  200 and
  `{"build":"fe511d135ef9f360c4b4d52c24c6b7b024b93539","status":"ok"}`;
  it also returned CSP, `nosniff`, frame denial, no-referrer, and no-store
  headers.
- Factory `verify-url.sh` against production passed in 591 ms with the correct
  title/lang, one `h1`, a main landmark, no missing image alt, and no console
  or page errors.
- A fresh live Chromium check passed on desktop and a 390×844 touch viewport:
  axe reported no serious/critical findings; the skip link received its 3 px
  focus outline; the mobile document had no horizontal overflow; reduced
  motion had no running animation duration; the service worker was controlling
  with no installing/waiting update; offline reload restored the landing page;
  requests stayed first-party; and fresh local storage remained empty.

The handoff-only successor commit is redeployed with the same helper so the
final live `/health` identity remains equal to `origin/main`. The optional paid
product registration noted below remains a commercial launch task, not a
blocker for the free product or this container repair.

## Repair handoff — 2026-08-28

Work order: `clean-family-coop-room-repair-1` (repair of verifier report in
`35a0ef94629f2bcafc432bab8f66f2fd380ff1ce`). The original artifact remains a
Vite frontend served by the Axum/SQLite container; the researched brief and
all previously passing product flows are preserved.

### Release blockers repaired

- **P1: room-boundary request limiting.** The server now applies a rolling,
  in-memory, per-client-IP limit before all unauthenticated room-boundary
  handlers: six room creations, 12 six-digit joins, and 20 WebSocket upgrades
  per minute. It returns `429` JSON with a correctly rounded-up
  `Retry-After`. The production container enables `TRUST_PROXY_HEADERS=1` so
  its deployment proxy's client address is used; direct/local operation uses
  the TCP peer address and never trusts a forged forwarding header.
- **P2: immutable health identity.** `build.rs` compiles a full 40-character
  Git SHA into every binary (a supplied `BUILD_SHA` must be a full SHA; a
  checked-out build resolves `HEAD`). `/health` returns that compiled value,
  never the former `dev` fallback. The Docker build accepts `BUILD_SHA`, also
  makes the checked-out revision available to the backend build stage, and the
  runtime image exposes no Git metadata.
- Rate-limit rejections now receive the same CSP, no-store cache policy, and
  security headers as other API responses.

### Exact regression coverage

- Rust integration-style router tests cover every protected path (create,
  join, and socket upgrade): the configured number of attempts reaches the
  normal handler, the next response is `429` with `Retry-After: 60`, CSP, and
  `Cache-Control: no-store`; a different client IP remains usable.
- A proxy-identity regression proves `X-Forwarded-For` is ignored unless the
  explicit trusted-proxy setting is enabled.
- A health regression asserts `/health` equals the binary's compiled identity
  and cannot report `dev` or `unknown`.

### Repair verification

- Clean dependency install: `npm ci` completed; audit reported **0
  vulnerabilities**.
- `npm test` passed: **3 Vitest + 8 Rust** tests.
- `npm run check` passed: strict TypeScript and `cargo clippy --all-targets --
  -D warnings`.
- `npm run build` passed: 22.44 kB JS (8.71 kB gzip) and 14.59 kB CSS (4.18
  kB gzip); `cargo build --release` passed.
- `npm run test:e2e` passed **8/8** Playwright checks on desktop Chromium and
  a 390×844 touch viewport, including the two-device three-game/reconnect
  flow, axe serious/critical scan, legal routes, and license return path.
- Release-binary HTTP smoke: `/health` returned the full compiled Git SHA;
  six local room creates returned 200 and the seventh returned `429` with
  `Retry-After: 60`, CSP, `nosniff`, `DENY`, `no-referrer`, and `no-store`.
- Browser smoke: desktop Tab focused the “Skip to the room” link with a 3 px
  outline. At 390 px, the service worker controlled the page with no waiting
  or installing worker, `scrollWidth` was 390, and the landing page reloaded
  offline from its cached shell.

### Deployment note

The repair is committed and pushed to `origin/main`; container deployment uses
the root Dockerfile on port 8080. This worker image has no Docker/Podman CLI,
so it cannot itself perform the final image build or query the platform's live
rollout. The Docker build is deliberately self-identifying from `BUILD_SHA` or
the checked-out revision; after rollout, verify
`/health` reports the pushed commit rather than `dev`.

## Independent verifier addendum — 2026-08-28

**FAIL for candidate `4d7d2aec35340da40d2e1133816eb2e4d1e57b7a`.** The live shell at <https://clean-family-coop-room.sociobot.in> is byte-for-byte identical to the candidate build and core product flows passed, but acceptance is blocked by a P1 absence of server-side rate limiting on six-digit-room endpoints and a P2 health/build-identity failure (`/health` reports `build: "dev"`, not a commit SHA). Full fresh evidence, passing checks, limitations, and required fixes are in `.factory/verification.md`. Do not treat the earlier builder verification claims below as independent verification.

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
