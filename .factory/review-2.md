# Review 2 — Play three remote co-op games

**Verdict: PASS**

- Findings: **0** at every severity.
- Untested public claims: **0**.
- Implementation candidate: `d2d88307ee42c31265236bacb4e33a3750f3edf3`.
- Documentation source reviewed: `912e6239bb4144443837dc9ed8f8bb0250975638`.
- Live build identity: `e2b6f489f6bcc05e8af3bec7f257a76282c23442`.
- Live URL: <https://clean-family-coop-room.sociobot.in>.
- Review date: 2026-09-05 UTC.

The last behavior-changing commit is `d2d8830`. Commit `d3f0d6e` adds a
`#[cfg(test)]` restart-persistence assertion and claim documentation. Commits
`e2b6f48` and `912e623` contain reports only. The live container was built from
`e2b6f48`; its frontend and release behavior match the implementation
candidate. No product code or live configuration was changed in this review.

## Job, audience, and first action before scrolling

Fresh 1440×900 desktop and 390×844 phone contexts showed, before scrolling:

- Job: **Play three remote co-op games**.
- Audience: a parent and child on different devices.
- First action: **Try it with sample data**.

The first action, the next-step explanation, and three account, expiry, and
price facts were visible on both screens. Neither viewport overflowed. Visual
inspection confirmed the product-specific dark pixel-console design and
original two-treehouse illustration.

## One-click sample

The first-screen action opened `/demo` in one click. Desktop and phone both
showed Alex and Sam, an in-progress 4-of-6 Star Signal round, and completed
Patchwork Pair and Firefly Ferry results with turn counts. The persistent
**Demo — sample data, nothing is saved** label remained visible after the
sample move and after reset.

The sample move completed the round. **Reset demo** restored 4-of-6 progress,
and **Start for real** returned to the normal entry screen. A planted real-data
local-storage value remained byte-for-byte unchanged. Demo activity made only
two same-origin `GET /api/demo` requests and made no room mutation or browser
storage write. Source inspection also confirms that `/api/demo` does not query
SQLite.

## Public claims

Every exact command in `.factory/claims.json` ran individually from the clean,
documented setup and passed. The live landing page, sample, room screens,
Privacy, Terms, manifest, and README were cross-checked for unlisted or broader
claims; none remain untested.

| Claim | Result | Observable proof |
| --- | --- | --- |
| `demo-sandbox` | PASS | Populated sample, reset, request log, and unchanged real-data sentinel. |
| `remote-room` | PASS | Two fresh contexts joined with one six-digit code and no account. |
| `three-games` | PASS | Both live devices completed all three games. |
| `turn-taking` | PASS | Enabled moves alternated between the two players. |
| `reconnect` | PASS | Reload and a direct offline/online cycle restored both players and state. |
| `restart-persistence` | PASS | The release binary reopened its SQLite file and accepted a join after a full stop/start. |
| `continued-room` | PASS | Another game and a second round both started after completion. |
| `privacy-boundary` | PASS | Landing and sample used first-party files only and no identity storage. |
| `offline-sample` | PASS | A dedicated context reopened the populated sample offline. |
| `room-expiry` | PASS | The isolated expiry test rejected and then removed expired state. |
| `data-minimization` | PASS | The isolated database test found only disclosed fields and hashed device keys. |
| `rate-limits` | PASS | Local create, join, and socket tests returned 429 with `Retry-After`; live create allowance did too. |
| `paid-pack` | PASS | Recorded valid verdict exposed Dawn, Berry, and the celebration stamp; the stamp appeared on a completed round. |
| `billing-boundary` | PASS | The product-specific buy URL returned 303 to hosted Sociobot/Dodo checkout. |
| `paid-core-free` | PASS | A live invalid verdict kept the three games and buy path available. |
| `license-daily` | PASS | A recent recorded verdict retained the license and made no verification request. |

## End-to-end, invalid, boundary, and recovery paths

- Fresh desktop and phone contexts joined one live room, completed Star Signal,
  Patchwork Pair, and Firefly Ferry, and retained the completed room after a
  desktop reload.
- A second live pair recovered after one context went offline and came back.
  Both connection labels returned to `connected` and the warning cleared.
- A short code showed `Enter all six digits.`; an unknown code showed a clear
  not-found recovery message; the same phone then made a valid room.
- HTTP boundaries returned 400 for a short code, 404 for an unknown code, 413
  for a body over 16 KiB, and 409 for a third participant.
- A room key opened its own live WebSocket with 101 but received 401 against a
  different room, proving room isolation.
- The licensed result showed `ROUND COMPLETE ✦`. **Play this game again** then
  opened Star Signal round 2 with zero turns.
- A fake returned license was stripped from the URL, checked only with
  `api.sociobot.in`, and produced the inactive-license recovery message. A
  short pasted license produced a specific form error. No payment was made.

## Backend and delivery

The candidate-identified release binary started in an empty directory with
only `PORT=18081`. `/health` returned the implementation SHA and `status: ok`.
A room created before a graceful stop remained joinable after restart, with a
real SQLite file beside the binary. Production was not restarted during this
read-only review.

Live `/health` returned 200, `status: ok`, and build `e2b6f48`. Six fresh room
creates succeeded; the seventh returned 429 with `Retry-After: 60` and
`Cache-Control: no-store`. Rotating caller-supplied forwarding prefixes did not
open a new bucket. A 500-request, 40-way local health smoke returned 500/500 at
about 1,276 requests per second.

A build with `VITE_BUILD_SHA=e2b6f48...` matched the live root HTML, JavaScript,
CSS, manifest, service worker, robots, sitemap, icons, social image, and both
hero images byte-for-byte. The production checkout returned 303 to the hosted
Dodo checkout. HTTPS responses include HSTS, CSP, no-sniff, frame denial,
no-referrer, and the expected cache policy.

## Accessibility, routes, privacy, and offline behavior

- The factory `verify-url.sh` passed in 597 ms with the correct title,
  `lang=en`, one h1, one main landmark, complete alt text, labelled buttons,
  and no normal-load console or page errors.
- Playwright axe reported no violations on the landing, sample, Privacy,
  Terms, designed 404, licensed view, or Night, Dawn, and Berry palettes.
- Tab first exposed the skip link with a 3 px cream outline and 6 px sky focus
  halo. Keyboard activation opened the sample. Route navigation and browser
  back/forward focused the new h1 and set the correct title.
- Required phone targets were at least 44×44 CSS pixels. At a 195 px viewport,
  equivalent to the 390 px phone at 200% zoom, client and scroll width both
  remained 195 px.
- Reduced-motion mode reduced animation and transition durations to 0.01 ms.
- The service worker had an active controller with no installing or waiting
  update. The sample then reloaded offline with its title, h1, banner, progress,
  and completed-round history. Chromium logged the expected failed network
  fetch while offline; the application caught it and used the bundled sample
  without an exception or broken state.
- `/`, `/demo`, `/privacy`, and `/terms` returned 200 with distinct titles.
  The sitemap and robots file were correct. Internal links worked; contact
  links are explicit `mailto:` targets.
- `/definitely-not-a-route` deliberately returned HTTP 404 and rendered the
  styled recovery page with home and sample links. Its browser resource 404 is
  expected evidence, not a defect.
- Fresh landing and sample contexts contacted only the product origin and
  stored no identity. The only external request observed in the invalid-license
  path was the disclosed Sociobot verification call.

## Clean setup and performance

```text
npm ci                                      PASS (59 packages, 0 vulnerabilities)
npm test                                    PASS (3 Vitest, 14 backend, 3 contract)
npm run build                               PASS (dist/ produced)
npm run check                               PASS
cargo fmt --all -- --check                  PASS
npm audit --audit-level=high                PASS
npm audit --omit=dev --audit-level=high     PASS
npm run test:e2e                            PASS (39 passed, 1 intentional phone-only skip)
BUILD_SHA=<candidate> cargo build --release PASS
all 16 declared claim commands              PASS individually
git diff --check                            PASS
```

The production build contains 28.84 kB JavaScript (10.31 kB gzip), 17.80 kB
CSS (4.83 kB gzip), no web-font transfer, and a 39.56 kB phone hero. Lighthouse
13.4.1 mobile scored 100 performance, 100 accessibility, 100 best practices,
and 100 SEO. FCP was 1,009 ms, LCP 1,199 ms, TBT 69.5 ms, and CLS 0. A
navigation-only lab run does not report INP.

Docker is not installed in this clean worker. README correctly declares Docker
optional and scopes the image commands to container verification. The metadata-
free multi-stage, non-root, `/data`, build-identity, and single-replica contracts
passed their repository tests, and the live artifact matched the reviewed
build. This environment limitation leaves no public claim untested.

## Earlier finding disposition

| Earlier finding | Current proof and disposition |
| --- | --- |
| Verification 1: no room-boundary limiter | Six live creates followed by 429/`Retry-After`; all create, join, and socket limiter tests pass. Resolved. |
| Verification 1: `/health` returned `dev` | Local release health identifies `d2d8830`; live health identifies its build source `e2b6f48`. Resolved. |
| Verification 1: Lighthouse did not complete | Fresh Lighthouse is 100/100/100/100. Resolved. |
| Verification 1–3: Docker unavailable | Docker is documented as optional; three container/deployment contracts and live byte parity pass. Resolved as an environment limitation. |
| Verification 2–3: split live room state | Two-device live play, reload, offline reconnect, room isolation, durable restart test, and single-replica `/data` contract pass. Resolved. |
| Verification 2: forwarded-header limiter bypass | Rotating spoofed prefixes did not reset the live bucket; local regressions cover every boundary. Resolved. |
| Verification 2: join race returned 500 | Atomic-join regression passes and a third live participant receives 409. Resolved. |
| Verification 2: checkout returned 404 | Product checkout returns 303 to hosted Dodo checkout. Resolved. |
| Verification 2: 200% reflow failed | 195 px client and scroll widths are equal. Resolved. |
| Verification 2–3: small phone targets | Every previously reported link and primary control measures at least 44×44 px. Resolved. |
| Verification 3: HSTS absent | Live HTTPS sends `max-age=63072000; includeSubDomains`. Resolved. |
| Review 1 F01: no sample | One-click populated, resettable, isolated sample passes live and declared tests. Resolved. |
| Review 1 F02: claims missing | Sixteen claims and all exact commands pass; no unlisted claim remains. Resolved. |
| Review 1 F03: paid feature false | Copy and implementation agree on two palettes and one stamp; each is observable. Resolved. |
| Review 1 F04: plain words | Job title, audience, action, facts, copy audit, and catalog line comply. Resolved. |
| Review 1 F05: route title/focus | Distinct titles plus h1 focus and announcement pass forward and back navigation. Resolved. |
| Review 1 F06: metadata missing | Canonical, description, Open Graph, Twitter, 1200×630 image, favicon, and touch icon ship. Resolved. |
| Review 1 F07: no designed 404 | Deliberate HTTP 404 renders the styled recovery page. Resolved. |
| Review 1 F08: incomplete structure | Header, footer, sitemap, robots, legal links, factory link, and build id ship. Resolved. |
| Review 1 F09: small links | Previously reported links now meet both target dimensions. Resolved. |
| Review 1 F10: HSTS absent | Live HSTS is present. Resolved. |
| Review 1 F11: paid landmark defect | Licensed view and every paid palette have zero axe violations. Resolved. |
| Review 1 F12: undeclared Docker prerequisite | Docker is explicitly optional and its commands are conditional. Resolved. |

The earlier 30 untested claim groups were removed, narrowed, or mapped to the
16 outcome tests. The former subjective ten-minute and no-lesson claims remain
absent. No useful AI step is implied by this bounded two-person game, so there
is no missed-leverage finding.

## Evidence

- `/work/.evidence/review-2/live-desktop-first-screen.png`
- `/work/.evidence/review-2/live-phone-first-screen.png`
- `/work/.evidence/review-2/live-desktop-demo-populated.png`
- `/work/.evidence/review-2/live-phone-demo-populated.png`
- `/work/.evidence/review-2/live-desktop-completed-room.png`
- `/work/.evidence/review-2/live-phone-completed-room.png`
- `/work/.evidence/review-2/verify-url/verify.json`
- `/work/.evidence/review-2/lighthouse.json`
- `/work/.evidence/review-2/restart-probe.Sv9E9L/`
- `/work/.evidence/review-2/load-probe.BF5Ixy/`

**PASS — 0 findings; 0 untested claims.**
