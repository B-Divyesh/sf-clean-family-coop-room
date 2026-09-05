# Together Room — independent verification 4

**Verdict: PASS**

Verified on 2026-09-05 for `clean-family-coop-room-verify-4`.
There are **0 findings** at every severity and **0 untested public claims**.
No product code was changed during verification.

## Build identity

- Implementation candidate reviewed: `d2d88307ee42c31265236bacb4e33a3750f3edf3`.
- Documentation/report SHA: `e2b6f489f6bcc05e8af3bec7f257a76282c23442`.
- Live URL: <https://clean-family-coop-room.sociobot.in>.
- Live `/health`: HTTP 200, `status: ok`, build `e2b6f489f6bcc05e8af3bec7f257a76282c23442`.

The live identity is the later documentation-source SHA. Changes after
`d2d8830` are a test-only SQLite assertion plus documentation, claims, and
handoff records; they do not alter shipped product behaviour. The requested
implementation candidate is therefore correctly `d2d8830`.

## Job, audience, and first action

Before scrolling, fresh 1440×900 desktop and 390×844 phone browsers showed:

- Job: **Play three remote co-op games**.
- Audience: a parent and child on different devices.
- First action: **Try it with sample data**.

The first action was visible on both viewports. Fresh screenshot inspection
confirmed the dark pixel-console identity, original treehouse illustration,
legible copy, and no phone overflow.

## Claims

`npm ci` installed 59 packages with zero vulnerabilities. Every exact command
in `.factory/claims.json` ran from the documented clean setup and passed.

| Claim ID | Result | Evidence |
| --- | --- | --- |
| `demo-sandbox` | PASS | Populated sample, reset, sentinel storage, and request boundary test. |
| `remote-room` | PASS | Two fresh contexts join one six-digit room without accounts. |
| `three-games` | PASS | All three games complete. |
| `turn-taking` | PASS | Moves alternate between players. |
| `reconnect` | PASS | Reload retains room and progress. |
| `restart-persistence` | PASS | Temporary SQLite state survives overlapping pools and restart. |
| `continued-room` | PASS | Completed round returns to game selection. |
| `privacy-boundary` | PASS | Request/storage boundary assertion passes. |
| `offline-sample` | PASS | Dedicated context reloads sample offline after first visit. |
| `room-expiry` | PASS | Expired room rejects; cleanup removes state. |
| `data-minimization` | PASS | Expected fields only; device key hashed. |
| `rate-limits` | PASS | Create, join, socket boundaries return 429 with Retry-After. |
| `paid-pack` | PASS | Fixture license enables both palettes and stamp. |
| `billing-boundary` | PASS | Product-specific Sociobot checkout target asserted. |
| `paid-core-free` | PASS | Inactive license leaves all games free. |
| `license-daily` | PASS | Recent local verdict avoids another verification request. |

## Local and live evidence

- `npm test` passed: 3 Vitest, 14 Rust unit/router, and 3 Docker/deployment
  contract tests. `npm run check`, `cargo fmt --all -- --check`, `git diff
  --check`, and production dependency audit also passed.
- `npm run build` produced `dist/`: JS 28.80 kB (10.27 kB gzip); CSS 17.80 kB
  (4.83 kB gzip). `npm run test:e2e` passed 39 tests with one intentional
  desktop skip of a phone-only geometry test.
- The live sample had Alex and Sam's in-progress Star Signal plus completed
  Patchwork Pair and Firefly Ferry rounds. Its persistent **Demo — sample
  data, nothing is saved** label remained visible, Reset demo worked, a seeded
  real-storage sentinel was unchanged, and no real-room write occurred.
- A fresh desktop and phone created/joined a real room, completed Star Signal,
  Patchwork Pair, and Firefly Ferry, and reloaded the desktop into its saved
  completed state. Invalid short and unknown room codes gave recovery guidance
  through the polite error region.
- Live creates returned six HTTP 200 results, then HTTP 429 with
  `Retry-After: 60`. Health was healthy. Local restart-persistence, the
  read-only demo, no room-list endpoint (GET `/api/rooms` is 405), and the
  token-protected socket cover the room isolation/persistence boundary. No
  live restart was performed.
- Checkout returned HTTP 303 to hosted Sociobot/Dodo checkout. No purchase or
  refund was attempted.

## Accessibility, privacy, routes, and delivery

- `/opt/fleet/lib/verify-url.sh` passed live in 583 ms: 200, title, `lang=en`,
  one h1, main landmark, image alt coverage, and no browser errors. Evidence:
  `/work/.evidence/verify-url/`.
- Direct live axe checks found zero serious/critical violations on landing and
  demo. Keyboard starts at the 3 px skip-link focus outline. All checked phone
  targets were at least 44×44 px; 390 px and 195 px layouts had no horizontal
  overflow; reduced-motion maximum duration was 0.00001 s.
- `/privacy` and `/terms` have distinct titles and focus the h1 after
  navigation. The deliberate `/definitely-not-a-route` response is HTTP 404
  with a designed return-home page, which is expected rather than a defect.
- `/demo` reloaded offline after a first visit. Landing/demo network traffic
  was first-party only; no accounts, ads, analytics, or third-party runtime
  files were observed.
- Internal product links returned 200, checkout returned 303, and the Param
  Factory link returned 200. HTTPS sends CSP, HSTS, nosniff, frame denial, and
  no-referrer; HTTP redirects to HTTPS. Canonical, social metadata, touch icon,
  robots, sitemap, and the plain-words copy audit are present.

## Earlier findings disposition

| Finding | Disposition |
| --- | --- |
| F01 demo | Resolved by live populated/resettable isolated sample proof. |
| F02 claims | Resolved: every one of 16 commands passed. |
| F03 paid feature | Resolved: exact extras fixture coverage and live 303 checkout. |
| F04 plain words | Resolved: job/audience/action first screen and clean copy audit. |
| F05 route state | Resolved: titles, focus, and legal navigation pass. |
| F06 metadata | Resolved: live canonical/social/favicons present. |
| F07 404 | Resolved: designed deliberate 404 recovery page. |
| F08 structure | Resolved: header/footer/sitemap/legal links and link crawl pass. |
| F09 touch/reflow | Resolved: live targets and 195 px reflow pass. |
| F10 HSTS | Resolved: live HSTS header present. |
| F11 paid landmark | Resolved: locked/licensed axe checks pass. |
| F12 Docker prerequisite | Resolved: Docker is optional in README; contract tests pass. |

The previous split-state, limiter-bypass, atomic-join, and missing live-rate
concerns are also resolved by the live two-device run, six-then-429 check, and
passing trusted-proxy/atomic-join tests.

## Measurement note

The direct Lighthouse CLI could not launch a compatible browser in this
verifier image. That is an environment-tool limitation, not an untested public
claim. Direct live axe, browser, offline, factory-verifier, and build-budget
checks passed; the candidate handoff records 100/100/100/100 Lighthouse.

## Conclusion

**PASS — 0 findings; 0 untested claims.**
