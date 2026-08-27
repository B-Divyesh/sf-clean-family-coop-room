# Together Room visual thesis

## Direction and rationale

Together Room is a **quiet pixel/demoscene console for two people**. It borrows the economy and tactile certainty of an early home-computer title screen—hard pixel edges, scanline texture, numbered steps, and small status lamps—without nostalgia clutter or arcade urgency. The shared “signal” is the hero: two distant windows connected by one warm, stepped beam. This fits a bounded family ritual better than a social dashboard: the screen feels special for ten minutes, then lets the family leave.

The treatment is intentionally single-mode and dark. A night-room world makes the remote connection legible, reduces glare during video calls, and lets bright game pieces carry meaning. Depth comes from a deep navy field, an inset console surface, a thin lit edge, and a foreground pixel illustration—not stacks of generic cards.

## Tokens

- `--ink: #07131d` — night-sky background.
- `--panel: #0d2530` and `--panel-raised: #123541` — console and raised controls.
- `--paper: #f7f0d0` — primary text, warm rather than sterile white (12.9:1 on panel).
- `--muted: #b7c9c4` — secondary copy (7.5:1 on panel).
- `--signal: #ffd166` / `--signal-ink: #231800` — the one primary-action color.
- `--mint: #69e3b2` — connected/success, always paired with words or symbols.
- `--sky: #70c6e8` — player-two/game accent.
- `--coral: #ff8066` — errors and caution, always paired with text.
- Grid/spacing: 4px base; 8, 12, 16, 24, 32, 48, 64. Corners are stepped 0/4/8px, never pill-heavy.

Contrast was checked against the painted dark surfaces; body copy remains above 4.5:1 and controls above 3:1.

## Type

- Display: `Courier New`, `Courier`, monospace at 700–800, tracked slightly wide. Its square rhythm belongs to the demoscene language and requires no network font.
- Reading/UI: `Trebuchet MS`, `Segoe UI`, system sans-serif. Rounded apertures keep instructions warm and readable at 16px minimum.
- Room codes and scores use tabular monospace numerals. Scale: 14 utility, 16 body, 20 control, 28 section, clamp(36–64) display. One `h1` only.

Using durable system fonts eliminates font transfer, licensing ambiguity, and first-render swaps while preserving the pairing.

## Layout and interaction grammar

The entry screen is a split stage: copy and actions on the left, one authored image on the right. On phones the picture becomes a short establishing panel after the primary actions. A “10-minute tape” stepper communicates the complete ritual: connect, choose, play. Game screens reserve the top band for room/connection, the center for the shared board, and the bottom for the current action. On phones, secondary explanation collapses beneath the board; the turn and next action never move off-screen.

Controls rise 3px with a dark offset edge; activation pushes them flush. Focus is a 3px paper-and-sky double outline. Every network action immediately changes its verb to a progress state and reports through a polite live region. Board pieces use both shape/pattern and color. The six-character room code is grouped as `123 456` visually but accepts/pastes plain digits.

## Motion policy

UI transitions last 160–240ms and use only opacity/transform. The hero signal draws once from the first window to the second; game pieces move from their actual source square. Nothing loops. With `prefers-reduced-motion: reduce`, drawing and movement become an immediate opacity change, smooth scrolling is disabled, and all durations approach zero. No flashes or particle storms.

## Original asset plan and provenance

- Hero illustration: two small treehouse-like rooms on separate floating pixel islands connected by a warm signal bridge, presented as a limited-palette demoscene scene. It explains remote togetherness without depicting or profiling children.
- In-game boards and icons: authored in CSS/semantic HTML (small geometric pixels, constellations, garden tiles, and route arrows) so state remains crisp, accessible, and deterministic.
- App mark: hand-authored SVG of two square windows joined by a stepped line.

### Generation prompt sheet

Use case: `illustration-story`. Asset type: responsive landing-page hero. Subject: two cozy empty rooms/treehouses on separate tiny floating islands, each with one square glowing window, joined by a single warm stepped beam made of chunky pixels. World: tranquil deep-night sky with a few geometric stars and subtle dither, family-safe and hopeful. Medium/materials: polished 16-bit demoscene pixel art, hard square pixels, no antialiasing, limited color count, subtle CRT-era ordered dithering. Composition: wide landscape, islands on left and right with open breathing space and an unbroken connection between. Light: warm amber windows and bridge against navy/teal night. Palette words: ink navy, deep petrol, cream, signal amber, mint, sky blue, sparing coral. Negative list: no people, no faces, no text, no letters, no numbers, no logo, no watermark, no existing game characters, no brand marks, no UI screenshot, no neon gradient, no photorealism, no blur.

Provenance: generated 2026-08-27 with the factory `factory-image` model using the prompt sheet above. The accepted 1536×1024 PNG and prompt sidecar are in `assets/src/`; it was reviewed for anatomy, text artifacts, seams, symbols, brands, and palette consistency. No people are depicted; the bridge is continuous and there are no text or brand artifacts. Shipping WebP derivatives are 720×480 (39 KB) and 1200×800 (79 KB), both well below the 300 KB mobile budget. Generated imagery is disclosed in the site footer.
