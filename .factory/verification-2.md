# Together Room — independent verification 2

**Result: FAIL**

Verified on 2026-08-28 against candidate
`02f7d5431f0c7f53a54251f7ad824fb7a10074f3` (`main` and `origin/main`) and
<https://clean-family-coop-room.sociobot.in>. The checkout was clean before
installation. No product code was changed.

## Release-blocking defects

### P1 — live room state is split across instances, so two-device joining and reconnect are unreliable

The live service does not present one shared room database. A room created by
one request is frequently invisible to the next request:

- In two independent sequential samples, **14 of 20** create-then-immediate-join
  pairs failed: 8/12 and 6/8 joins returned `404` with `That room was not
  found`, even though the preceding create returned `200` and the new code.
- A 30-way join probe against one newly created room returned 1 × `200`, 13 ×
  `409` (the instance that owned the room), and **16 × `404`** (instances that
  did not have it).
- Repeated WebSocket connections using the same valid creator token produced
  5 opens and 7 handshake errors in a 12-attempt sample, below the 20/minute
  socket limit.
- There is no ingress-affinity cookie on room creation. Static responses also
  alternated between `Last-Modified: 03:56:05 GMT` and `04:03:30 GMT`,
  corroborating routing among independently started instances.

This directly fails the brief's central job: a parent and child on separate
devices cannot reliably enter the same six-digit room, and a reconnect may be
routed to an instance that has neither the token nor the game. The image uses
SQLite at `/data/together-room.db`; production needs durable shared state or a
deployment topology that guarantees the necessary single-instance persistence
and restart behavior.

### P1 — live rate limiting trusts a caller-controlled forwarding header

Production is configured with `TRUST_PROXY_HEADERS=1`, and the backend takes
the first `X-Forwarded-For` value. Fresh live requests with
`X-Forwarded-For: 198.51.100.77` produced 6 × `200`, then the expected `429`
with `Retry-After`. Changing only the supplied header to
`198.51.100.78` immediately produced `200`. The public ingress therefore
passes an attacker-provided first address through to the limiter.

An automated caller can rotate this header and bypass the create, join-code
guessing, and WebSocket limits. That defeats the safety repair protecting the
child-facing six-digit private-room boundary. The service must derive identity
only from an ingress-overwritten, trusted field or strip untrusted forwarding
values before the app.

## Other defects

### P2 — simultaneous joins can return an internal server error

Against the exact local release binary, 10 simultaneous joins to one room
returned 1 × `200`, 8 × `409`, and **1 × `500`**. The server log identified
SQLite error 1555: `UNIQUE constraint failed: participants.room_code,
participants.seat`. The count-then-insert path is not atomic and maps the
losing race to a generic 500 rather than the documented room-full 409. A retry
recovers, but this is an avoidable failure at a normal two-device boundary.

### P2 — the advertised one-time purchase cannot be bought

The live “Buy family pack” link points to the required Sociobot endpoint, but
`GET https://api.sociobot.in/api/v1/products/clean-family-coop-room/checkout`
returned `404 {"error":"enabled factory product","status":404}`. Invalid
license verification itself returned the correct structured response and the
UI recovered cleanly, but checkout/product registration is not live.

### P3 — some mobile targets and 200% reflow miss the supplied accessibility contract

At 390 px, primary buttons are at least 48 px high, but the brand link is 32 px
high, the purchase-restore summary is 24.8 px high, inline terms/privacy links
are 15 px high, and footer links are 22.3 px high. These miss the required
44×44 CSS px target. At a 195 CSS px layout viewport (the 390 px reflow
equivalent at 200%), `clientWidth` was 195 while `scrollWidth` remained 320
because `body` has `min-width: 320px`; controls extended to x=308. No content
was missing, but horizontal reflow is required.

## Fresh source and build evidence

- `git status` was clean; `HEAD` and `origin/main` both resolved to the tested
  candidate.
- `npm ci` installed 59 packages and reported 0 vulnerabilities.
- `npm test` passed 3/3 Vitest tests, 8/8 Rust unit/router tests, and 2/2
  Docker-contract tests.
- `npm run check` passed strict TypeScript and
  `cargo clippy --all-targets -- -D warnings`.
- `cargo fmt --all -- --check`, `git diff --check`, and
  `npm audit --omit=dev --audit-level=high` passed.
- `npm run build` passed with Vite 7.3.6 and produced `dist/`: initial JS
  22,442 bytes (8.71 kB gzip), CSS 14,588 bytes (4.18 kB gzip), no web fonts,
  and the mobile hero 39,562 bytes. All are within the 200/50/120/300 kB
  budgets.
- `BUILD_SHA=02f7d... cargo build --release` passed. Starting the release
  binary with `env -i PORT=18080` required no other configuration, logged the
  full SHA, and `/health` returned it.
- No Docker or Podman executable is installed in this verifier image, so a
  fresh container build could not be rerun. The frontend and optimized Rust
  production builds passed separately, and the checked Docker contract is
  multi-stage, metadata-free, non-root, and wired to `BUILD_SHA`.

## Local functional and backend evidence

- `npm run test:e2e` passed **14/14** on desktop Chromium and a touch-enabled
  390×844 project, including all three complete games, two contexts, reload
  reconnect, legal routes, license return handling, axe, PWA update/offline,
  focus, and fresh-storage privacy.
- An independent keyboard-only local flow used Tab and Enter to create, join,
  and complete Star Signal. The create button was the third Tab stop, the room
  field the fifth, and every game move was reachable and operable.
- API boundaries: short, long, and alphanumeric room codes returned `400`;
  an unknown six-digit code returned `404`; a third participant returned
  `409`; a 17,000-byte body returned `413`; and a deliberately expired room
  returned `410` with a recovery instruction.
- The first 6 creates from one direct client returned `200`; the seventh
  returned `429` with `Retry-After: 60`. Changing `X-Forwarded-For` locally did
  not evade the limit because the default does not trust it.
- A room at Star Signal round 1/progress 1/move 1 retained exactly that state
  after graceful server stop/restart. An unjoined room could also be joined
  after restart.
- 500/500 local release `/health` requests succeeded in 3,999 ms (125 req/s).
- The persisted reconnect token was absent in plaintext; its SHA-256 hash was
  present in the SQLite/WAL files.

## Live parity and browser evidence

- Live `/health` returned HTTP 200 and the exact full candidate SHA. SHA-256
  matched between live and local for all 10 shipped artifacts checked:
  `index.html`, manifest, robots, service worker, JS, CSS, two SVGs, and both
  hero WebPs.
- A successful live two-device run (when both clients happened to reach the
  same stateful instance) recovered from an incomplete code, recovered from a
  wrong Star Signal choice and an invalid Firefly boundary move, completed all
  three games, and reconnected after reload with the final state intact.
- No console or page errors occurred. Fresh root requests were first-party
  only and fresh local storage was empty. A returned invalid license was
  stripped from the URL, verified only with Sociobot, left all free games
  available, and showed a clear inactive-license notice.
- Axe found **0 serious/critical** findings on live desktop landing, 390 px
  landing, a live room/game state, and both optional palettes. There was one
  false positive in the factory helper's simple `innerText` button heuristic:
  the text-labelled “Verify license” button is inside a closed `details` and
  therefore has empty rendered `innerText`; axe did not flag it.
- Keyboard focus started at the skip link with a 3 px outline and 6 px sky
  ring. At 390 px, `scrollWidth === clientWidth === 390`. Reduced-motion
  animation and transition durations computed to `0.00001s`.
- Service-worker update reached active/controlling with no installing or
  waiting worker. Offline navigation reloaded the cached shell with HTTP 200,
  the correct title/h1, and an explicit offline explanation.
- Live security/cache policy included CSP, `nosniff`, `DENY` framing,
  `no-referrer`, API/health `no-store`, shell/service-worker `no-cache`, hashed
  JS/CSS `max-age=31536000, immutable`, and images `max-age=86400`. TLS
  verification passed. No third-party fonts, scripts, ads, or analytics loaded.
- Lighthouse 13.0.1 mobile scored **100 performance / 100 accessibility / 100
  best practices / 100 SEO**: FCP 1.0 s, LCP 1.1 s, TBT 70 ms, CLS 0. INP is
  not available from a navigation-only lab run.
- Factory `verify-url.sh` returned HTTP 200 in 763 ms with title, `lang=en`,
  one h1, main, complete image alt coverage, and no console/page errors.

## Required next steps

1. Move room/game/token state to storage shared by every live instance, or use
   a deliberately single-instance durable deployment with no split routing;
   then stress create/join and reconnect across independent connections.
2. Sanitize forwarding headers at ingress and derive limiter identity only
   from a proxy-authenticated address; prove arbitrary client headers cannot
   reset any of the three buckets.
3. Make join seat claiming atomic and map the losing race to 409.
4. Register/enable the Sociobot product and verify the live checkout redirect
   plus return-license flow.
5. Enlarge the small mobile targets and remove the 320 px fixed minimum for
   200% reflow.
