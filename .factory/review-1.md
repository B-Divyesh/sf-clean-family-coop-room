# Review 1 — Play three remote co-op games

**Verdict: FAIL**

- Findings: **12** (3 P1, 5 P2, 4 P3)
- Untested public claims: **30**
- Implementation candidate: `fe26aa4e33b339506e323d6a40d3ec5275708319`
- Documentation commit reviewed: `3c5be9708ce7ddf469bc33370c2987575585276a`
- Live URL: <https://clean-family-coop-room.sociobot.in>
- Review date: 2026-09-05 UTC

The product is not accepted. The real two-device games now work reliably, but
the required sample sandbox and claims system do not exist. A paid feature is
also advertised without an implementation. PASS requires zero findings and
zero untested claims.

## Job, audience, and first action before scrolling

- Job shown: play three turn-based games across two devices for about ten minutes.
- Audience shown: a parent and child using different devices.
- First action shown: **Make a room**, with **I have a code** beside it.

This was checked at 1440×900 and 390×844 before scrolling. The explanatory
sentence communicates the audience, but the headline, `A tiny room to play
together.`, uses the room metaphor instead of naming the remote co-op job. The
required **Try it with sample data** action is absent.

## Findings

### F01 — P1 — There is no isolated one-click sample

The first screen has no **Try it with sample data** action. Live `/demo` returns
the normal landing app with no sample state, persistent sample label, **Reset
demo**, or **Start for real**. The repository has no `.factory/demo.md` and no
demo storage namespace or ephemeral demo tenant. Creating from `/demo` would
create a normal two-hour room, so a reviewer cannot demonstrate the product
with sample data without changing normal product state.

Required disposition: provide the complete demo contract and prove that the
sample cannot read or write normal room data.

### F02 — P1 — The claims manifest is missing and 30 public claims are untested

`.factory/claims.json` does not exist. Therefore there are no declared claim
commands and no `@claim:<id>` tests. Existing unit and browser tests are useful,
but they do not satisfy the one-claim/one-sandbox-test contract. The complete
inventory is below; every row is unlisted and therefore counted as untested.

| # | Public claim group | Public location | Review observation |
|---:|---|---|---|
| 1 | A parent and child can play on different devices | Landing, README | Observed live; no claim test |
| 2 | The activity lasts about ten minutes | Title, landing, README | Quantitative claim not tested |
| 3 | Three original co-op games work | Landing, README | All three completed live; no claim test |
| 4 | A private link or six-digit code joins a room | Landing, README | Observed live; no claim test |
| 5 | Players always take turns | Landing, game copy | Observed live; no claim test |
| 6 | A game needs no setup lesson | Landing | Subjective and untested |
| 7 | Reload and short disconnect reconnect | Landing, README | Observed live; no claim test |
| 8 | A room stays open after a completed round | Result screen | Observed live; no claim test |
| 9 | No account or profile is needed | Landing, README, privacy | Observed; no claim test |
| 10 | Names, ages, messages, contacts, and location are not requested | Privacy | Source supports it; no claim test |
| 11 | No chat, strangers, feeds, friends, listings, or matchmaking | Landing, README, privacy | Source supports it; no claim test |
| 12 | No ads are used | Landing, README, privacy | Network/source check supports it; no claim test |
| 13 | No analytics or tracking is used | Landing, README, privacy | Network/source check supports it; no claim test |
| 14 | No third-party runtime scripts or fonts are used | Landing, README | Network/source check supports it; no claim test |
| 15 | Only the disclosed room fields are stored | Privacy | Schema inspection supports it; no claim test |
| 16 | Rooms expire and are deleted after two hours | Landing, README, privacy | Source supports expiry/cleanup; no claim test |
| 17 | Reconnect keys are hashed on the server | README, privacy | Local database check passed; no claim test |
| 18 | The product works with a keyboard | Landing | Basic checks pass; no claim test |
| 19 | The product works with touch | Landing | Live phone flow passed; no claim test |
| 20 | Reduced motion is respected | Landing | Live reduced-motion check passed; no claim test |
| 21 | The welcome screen works offline after the first visit | Live offline notice | Live offline reload passed; no claim test |
| 22 | Limits are 6 creates, 12 joins, and 20 socket attempts per minute, with 429 and Retry-After | README | Live create allowance passed; no claim test |
| 23 | SQLite state is durable across restart | README | Local restart passed; no claim test |
| 24 | The family pack costs US$8 once with no subscription | Landing, terms, README | Checkout redirects; no purchase or claim test |
| 25 | The paid pack adds two palettes, celebration stamps, and surprise picks | Landing, terms, README | Partly false; see F03 |
| 26 | Games, reconnect, safety, privacy, and accessibility stay free | Landing, terms, README | Source supports it; no claim test |
| 27 | A license stays on the device and is checked at most daily | Privacy | Source/test fixture supports it; no claim test |
| 28 | The app receives no card details and refunds disable licenses | Landing, privacy, terms | Checkout/invalid flow checked; refund not tested |
| 29 | The app has no paid-service dependency | README | Ambiguous due to optional billing; no claim test |
| 30 | The service does not knowingly collect personal information from children | Privacy | Source inspection only; no claim test |

Required disposition: add `.factory/claims.json`, give every retained claim one
tagged sandbox test, and remove or narrow claims that cannot be proved.

### F03 — P1 — The paid pack advertises an absent feature

The live sales copy promises `one-tap surprise picks` and the terms repeat
`surprise picks`. The unlocked UI contains only Night, Dawn, and Berry palette
buttons. There is no surprise-pick action or implementation. The plural
`celebration stamps` is also represented by one fixed `SIGNAL KEPT` line.

This is a material false claim attached to a US$8 purchase. No payment was made
during review. The hosted checkout itself correctly returned 303.

Required disposition: implement and test the advertised paid features or remove
them from every public surface before selling the pack.

### F04 — P2 — First-screen and legal copy break the plain-words contract

The landing headline is metaphorical rather than a job title. `Two windows ·
ten good minutes`, `A playroom, not a platform`, `Privacy without profiles.`,
and `Short rooms, simple terms.` are mood or metaphor headings. The audience
sentence is 23 words, over the 22-word hard cap. Three short privacy/offline/
price facts are not present on the first phone screen. `.factory/copy-audit.md`
is also missing.

Required disposition: name the remote co-op job directly, replace mood headings,
put three facts on the first screen, and add a clean copy audit.

### F05 — P2 — Route titles and route-change focus are not implemented

`/`, `/demo`, `/privacy`, `/terms`, and an unknown path all retain `Together
Room — a calm 10-minute co-op`. Privacy and terms do not get their required
route titles. After activating the Privacy link, focus falls to `<body>` rather
than the new `<h1>`, and there is no route-title announcement. Back navigation
changes the content but does not restore focus.

Required disposition: set a job-naming title per route, focus the route `<h1>`,
announce the route, and verify back/forward focus and scroll behavior.

### F06 — P2 — Required discovery and sharing metadata is absent

The shell has a description, SVG favicon, manifest, language, and theme color.
It lacks a canonical link, Open Graph metadata, Twitter card metadata, a real
1200×630 social image declaration, and a 180 px Apple touch icon declaration.

### F07 — P2 — Unknown URLs do not return the designed 404 page

`/definitely-not-a-route` returns HTTP 200 and renders the landing page. This is
not the expected deliberate 404 described by the contract; it is a missing 404
route, status, and recovery design.

### F08 — P2 — Sitemap and standard global navigation are incomplete

`/sitemap.xml` returns the HTML app shell instead of XML. The header has only a
home link and no Demo or Privacy navigation. The footer has Privacy and Terms,
but lacks the product one-line description, `Built by Param Factory`, and a
version/build identifier.

### F09 — P3 — Three phone links remain narrower than 44 px

At 390×844, the paid-card `terms` link measured 33.59×44 px, its `privacy` link
42.58×44 px, and the footer `Terms` link 39.19×44 px. This reproduces the minor
finding from verification 3. The regression test checks height only, so it
passes while the width requirement fails.

### F10 — P3 — HTTPS responses still omit HSTS

HTTP redirects to HTTPS and the other checked security headers are present.
HTTPS responses still have no `Strict-Transport-Security`, reproducing the
verification-3 finding.

### F11 — P3 — The unlocked paid view has a moderate landmark defect

Axe reports `landmark-complementary-is-top-level` in each unlocked Night, Dawn,
and Berry view. The unlocked family-pack `<aside>` has different landmark
semantics from the labelled locked state. Default, legal, room, and phone scans
had no axe violations.

### F12 — P3 — The documented Docker verification commands need an undocumented prerequisite

README requirements list Node, npm, and Rust, then declare `docker build` and
`docker run` as verification commands. This clean worker has no Docker or
Podman executable, so those commands could not be rerun. The repository Docker
contract tests pass and the live service identifies the exact candidate, but a
fresh local container build/run remains unexecuted evidence. Document Docker as
a prerequisite or provide a verifier command that works from the stated setup.

## Core product and backend evidence

- A fresh desktop and a fresh 390×844 phone joined one live room, completed
  Star Signal, Patchwork Pair, and Firefly Ferry, and showed realistic completed
  output. Reload restored the final state and both connected indicators.
- Short code recovery showed `Enter all six digits.`; an unknown code showed a
  clear 404 message; the same browser then created and completed a valid room.
- Five extra live create→join pairs all returned 200. Including the earlier
  browser create, the next two create attempts returned 429 with
  `Retry-After: 47`. Rotating caller-supplied forwarding prefixes did not reset
  the allowance.
- The exact release binary started in an empty temporary directory with only
  `PORT=18081`. A created room remained joinable with 200 after graceful stop
  and restart. `/health` returned the candidate SHA.
- Local boundary results were: valid join 200, third participant 409, short and
  alphabetic code 400, unknown code 404, oversized body 413, cross-room token
  401, and expired room 410. The reconnect token was absent in plaintext and
  its SHA-256 hash was present in SQLite.
- A 500-request, 40-way local `/health` smoke had 500 successes in 2.074 seconds
  (about 241 requests/second).
- Production was not restarted during this read-only review. The prior handoff
  records a successful live replacement-persistence check; current local
  restart evidence and live candidate parity support its present disposition.

## Browser, accessibility, privacy, and offline evidence

- Factory `verify-url.sh` passed live: HTTP 200, 617 ms load, title, `lang=en`,
  one h1, main landmark, complete image alt coverage, and no console/page errors.
  Its one `buttonsUnlabeled` count is a closed-details `innerText` limitation;
  the text-labelled Verify license button is not an accessibility defect.
- Axe had no violations on the default desktop landing page, phone landing
  page, privacy page, terms page, unknown-route landing, or completed room.
  F11 records the separate unlocked-state result.
- Tab first reaches the visible skip link with a 3 px focus outline. Standard
  buttons are keyboard operable, and the prior full keyboard live flow remains
  applicable because all shipped artifacts match this unchanged candidate.
- Phone width was 390/390 with no overflow. At 200% text size it remained
  390/390 and retained visible content. Reduced-motion durations were at most
  0.01 ms. The three target-width failures are listed in F09.
- A fresh landing context contacted only the product origin and left local
  storage empty. Creating a room added one disclosed reconnect entry. The legal
  pages give `privacy@sociobot.in` and `support@sociobot.in` mail links.
- The service worker was active and controlling with no installing or waiting
  update. Offline reload preserved the correct shell and explained that making
  or joining a room needs a connection. Normal and offline checks had no errors.
- All rendered internal links on the landing, Privacy, and Terms pages returned
  200. The purchase link returned the expected 303, and contact links use
  explicit `mailto:` targets.
- An invalid returned license was stripped from the URL, kept the three games
  free, and showed a clear inactive-license notice. No real purchase was made.
- The brief does not imply a useful AI step; adding one would add cost and data
  handling without helping this bounded family activity. No missed-AI finding.

## Build, performance, and live parity

Commands run from the clean checkout:

```text
npm ci                                      PASS (59 packages, 0 vulnerabilities)
npm test                                    PASS (3 Vitest, 12 backend, 3 contract)
npm run build                               PASS (dist/ produced)
npm run check                               PASS
cargo fmt --all -- --check                  PASS
npm audit --audit-level=high                PASS
npm audit --omit=dev --audit-level=high     PASS
npm run test:e2e                            PASS (15 passed, 1 intentional skip)
BUILD_SHA=<candidate> cargo build --release PASS
docker build / docker run                   NOT RUN (F12)
declared @claim commands                    NONE (F02)
```

The production build emitted 22.44 kB JS (8.71 kB gzip), 15.36 kB CSS
(4.32 kB gzip), no web fonts, and a 39.56 kB phone hero. Lighthouse 13.0.1
mobile scored 100 performance / 100 accessibility / 100 best practices / 100
SEO: FCP 900 ms, LCP 1,050 ms, TBT 0 ms, CLS 0. INP is not available from a
navigation-only lab run.

Live `/health` returns
`fe26aa4e33b339506e323d6a40d3ec5275708319`. SHA-256 matched local `dist/` for
the HTML, manifest, robots, service worker, both SVGs, both hero WebPs, hashed
CSS, hashed JS, and source map. The later `3c5be97` commit changes only review
documents, so no newer product image is required.

## Earlier finding disposition

| Earlier review item | Current disposition |
|---|---|
| Verification 1: room-boundary rate limiting absent | Resolved; local tests and live 429/Retry-After passed |
| Verification 1: `/health` returned `dev` | Resolved; live returns exact implementation SHA |
| Verification 1: Lighthouse did not complete | Resolved; current live run is 100/100/100/100 |
| Verification 1–3: Docker unavailable locally | Still an evidence/documentation gap; F12 |
| Verification 2–3: live room state split across paths | Resolved in current samples: full two-device run plus 5/5 extra joins |
| Verification 2: forwarded-header limiter bypass | Resolved; rotating prefixes did not evade the live bucket |
| Verification 2: simultaneous join could return 500 | Resolved; 20-way test returns one success and 19 conflicts |
| Verification 2: checkout returned 404 | Resolved; live checkout returns 303 to hosted checkout |
| Verification 2: 200% reflow failed | Resolved; 195 px regression and live 200% text check pass |
| Verification 2–3: small phone targets | Partly repaired; three width failures remain as F09 |
| Verification 3: HSTS absent | Unresolved; F10 |

## Evidence files

- `/work/.evidence/live-desktop-first-screen.png`
- `/work/.evidence/live-phone-first-screen.png`
- `/work/.evidence/live-phone-room.png`
- `/work/.evidence/live-desktop-completed-room.png`
- `/work/.evidence/verify-url/verify.json`
- `/work/.evidence/lighthouse.json`

No product code or live configuration was changed during this review.
