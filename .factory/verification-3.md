# Together Room — independent verification 3

**Result: FAIL**

Verified on 2026-08-28 against candidate
`fe26aa4e33b339506e323d6a40d3ec5275708319` (`main` and `origin/main`) and
<https://clean-family-coop-room.sociobot.in> for work order
`clean-family-coop-room-verify-3`. The checkout was clean before installation.
No product code was changed.

The candidate builds and passes its local suite, and the live files and health
identity match it. Production still fails the central two-device job because
requests are routed among isolated room stores. This is fresh evidence, not a
carry-forward of an earlier verifier result.

## Release-blocking defects

### P1 — the live service still splits room state across request paths

Fresh sequential requests from the same verifier, with no forwarding headers,
created 12 rooms successfully. Each join was sent immediately after its create
from a separate HTTPS connection. **9 of 12 joins returned `404`** with `That
room was not found`; only 3 returned `200`.

The WebSocket path is split too. Twelve valid upgrade requests using the same
fresh creator reconnect token produced **4 × `101 Switching Protocols` and 8 ×
`401 Unauthorized`**, below the documented 20-upgrade limit. A browser run did
complete Star Signal when both contexts happened to reach compatible state,
which confirms the failure is intermittent routing/state isolation rather than
a broken game implementation.

This directly fails the brief's core requirement: a parent and child on two
devices cannot reliably join, remain connected, or reconnect. The checked-in
`.factory/deployment.json` declares one replica and durable `/data` storage,
but the public behavior is not consistent with one shared room/token store.
Possible operational causes include multiple active revisions/replicas or an
unapplied volume/topology configuration; the externally observable defect is
unambiguous regardless of which is responsible.

### P1 — the live six-digit room boundary is not rate-limited as promised

After allowing the 60-second rolling window to clear, **12 of 12** direct room
creation requests from the same client and without `X-Forwarded-For` returned
`200`. The documented limit is six creates per client per minute, with the
seventh returning `429`. A separate eight-request sample that rotated a
caller-supplied forwarding prefix also returned 8 × `200`.

The rate limiter is in process memory, so the observed split production state
also splits its counters. This weakens the safety boundary around short,
guessable room codes and fails the documented production behavior. The limit
must be enforced at a shared/trusted boundary or production must truly route
all room traffic through one state owner.

## Other defects

### P3 — several 390 px text links are narrower than the required 44 px target

On the live 390×844 landing page, the inline `terms` link measured 33.59×44 px,
the inline `privacy` link 42.58×44 px, and the footer `Terms` link 39.19×44 px.
The supplied design/accessibility contract requires at least 44×44 CSS px.
The prior height-only regression does not catch this width failure. There was
no horizontal overflow, and axe did not classify it as serious or critical.

### P3 — production omits HTTP Strict Transport Security

Plain HTTP correctly returns `301` to HTTPS, and HTTPS responses include CSP,
`nosniff`, frame denial, and `no-referrer`. They do not include
`Strict-Transport-Security`, leaving first-visit downgrade protection absent.

## Clean source, test, and build evidence

- `git status` was clean; `HEAD`, `origin/main`, and the requested candidate
  all resolved to `fe26aa4e33b339506e323d6a40d3ec5275708319`.
- `npm ci` installed 59 packages and reported 0 vulnerabilities. Full and
  production-only `npm audit --audit-level=high` both reported 0.
- `npm test` passed 3/3 Vitest tests, 12/12 backend tests, and 3/3
  Docker/deployment contract tests.
- `npm run check` passed strict TypeScript and
  `cargo clippy --all-targets -- -D warnings`. `cargo fmt --all -- --check` and
  `git diff --check` passed.
- The exact `npm run build` passed with Vite 7.3.6. Initial uncompressed assets
  are 22,442-byte JS and 15,361-byte CSS; there are no web fonts, and the mobile
  hero is 39,562 bytes. These are comfortably inside the 200/50/120/300 kB
  budgets.
- `BUILD_SHA=fe26aa4e... cargo build --release` passed from the clean Rust
  target. No Docker or Podman executable is installed in the verifier image,
  so a fresh container build could not be rerun; the constituent production
  builds and repository Docker contract checks passed.
- `npm run test:e2e` ran pinned Playwright 1.58.2 on desktop Chromium and a
  touch-enabled 390×844 project: **15 passed**, with the desktop copy of the
  mobile-only geometry test intentionally skipped. Coverage includes two
  isolated contexts, all three games, reload reconnect, legal/license paths,
  axe, focus, privacy, and service-worker update/offline reload.

## Local functional and backend evidence

- The release binary started in a fresh temporary directory with only
  `PORT=18080`, logged and returned the exact candidate SHA, created its SQLite
  database, and served the production frontend.
- A newly created room remained joinable after a graceful stop/restart using
  that database. A 10-way simultaneous join produced exactly 1 × `200` and 9 ×
  `409`, with no 500.
- Short, alphabetic, overlong, and space-containing room codes returned `400`;
  an unknown code returned `404`; a third participant returned `409`; a
  deliberately expired room returned `410` with a recovery instruction; an
  oversized request returned `413`; invalid and 129-character WebSocket keys
  returned `401` and `400` respectively when sent with proper upgrade headers.
- 500/500 `/health` requests succeeded with concurrency 40 in 4,004 ms, about
  125 requests/s.
- A persisted reconnect token was absent in plaintext and its SHA-256 hash was
  present in the SQLite files. Source/runtime inspection found no secrets,
  analytics, advertising, third-party scripts, or CDN fonts.

## Live parity, browser, privacy, PWA, and performance evidence

- Live `/health` returned HTTP 200 and the exact full candidate SHA. SHA-256
  matched local `dist/` for all ten shipped artifacts checked: HTML, JS, CSS,
  service worker, manifest, robots file, two SVGs, and both hero WebPs.
- Factory `verify-url.sh` passed locally and live (623 ms and 713 ms): correct
  title, `lang=en`, one h1, main landmark, image alt coverage, and no console or
  page errors on a normal load. Its naive button-text count saw the text-labelled
  “Verify license” button inside a closed `details`; axe correctly did not flag
  the hidden control.
- A separate live desktop/390 px run recovered from a short code, a nonexistent
  code, and a wrong Star Signal choice, then completed the round using only
  focus plus Enter and reconnected after reload. The intentionally generated
  404 produced the expected browser resource-error log; clean normal loads had
  no console/page errors.
- Axe found **0 serious/critical** findings on the landing page and completed
  room on desktop and mobile. Tab first focused “Skip to the room” with a 3 px
  high-contrast outline. At 390 px, `clientWidth === scrollWidth === 390`;
  the repository's 195 px/200%-reflow regression also passed. Reduced motion
  had no active animations and a maximum declared animation duration of 0.01
  ms.
- A fresh root visit contacted only the product origin and left local storage
  empty. Room/reconnect storage begins only after room creation and is disclosed
  on `/privacy`. The live root loaded no tracking, ads, third-party scripts, or
  fonts.
- Service-worker registration was active and controlling with no installing or
  waiting worker after `registration.update()`. A fully offline 390 px reload
  restored the correct title/h1 and explicit offline notice with no page or
  console error.
- Live caching is `no-store` for health/API, `no-cache` for the shell and
  service worker, one-year immutable for hashed JS/CSS, and one day for other
  assets. Error responses retain CSP and no-store. HTTP redirects to HTTPS.
- The Sociobot family-pack checkout returned `303` to its hosted Dodo checkout.
  Invalid-license verification returned `{valid:false, reason:"invalid"}` with
  the correct product-origin CORS header and `Cache-Control: no-store`; no
  payment was attempted.
- Lighthouse 13.0.1 mobile scored **100 performance / 100 accessibility / 100
  best practices / 100 SEO**: FCP 1.1 s, LCP 1.1 s, TBT 70 ms, CLS 0, speed
  index 1.1 s, with no runtime error or warning. INP is unavailable from a
  navigation-only lab run.

## Required next steps

1. Inspect the active production revisions/replicas and volume mount, then make
   room, participant, WebSocket, presence, and limiter state consistent across
   every request path. Re-run create→join and valid-token WebSocket sampling
   from independent connections after the change.
2. Enforce the six-create/12-join/20-WebSocket limits at one shared trusted
   boundary; verify the seventh direct create is `429` and that arbitrary
   forwarding headers cannot reset the bucket.
3. Expand every small mobile text-link hit area to at least 44×44 CSS px.
4. Add HSTS at the HTTPS ingress or application layer.
