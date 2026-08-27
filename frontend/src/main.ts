import './styles.css';
import { clueForSeat, displayRoomCode, escapeHtml, normalizeRoomCode, safeReturnPath, type Seat } from './lib';

const SLUG = 'clean-family-coop-room';
const LICENSE_KEY = `sb_license:${SLUG}`;
const VERDICT_KEY = `sb_license_verdict:${SLUG}`;
const BILLING_BASE = 'https://api.sociobot.in/api/v1';
const SYMBOLS: Record<string, string> = { moon: '◐', drop: '◆', leaf: '❧', star: '✦', sun: '☀', heart: '♥' };
const GAME_NAMES: Record<string, string> = { star_signal: 'Star Signal', patchwork: 'Patchwork Pair', firefly_ferry: 'Firefly Ferry' };

interface Session { code: string; token: string; seat: Seat; expires_at: number }
interface RoomGame { kind: string; phase: 'lobby' | 'playing' | 'won' | 'paused'; turn: Seat; round: number; moves: number; board: Record<string, unknown>; message: string }
interface RoomEvent { type: 'state'; room: RoomGame; connected: [boolean, boolean] }
interface LicenseVerdict { valid: boolean; checked_at: number; reason?: string }

const appElement = document.querySelector<HTMLDivElement>('#app');
if (!appElement) throw new Error('App root missing');
const app: HTMLDivElement = appElement;

let session: Session | null = null;
let room: RoomGame | null = null;
let connected: [boolean, boolean] = [false, false];
let socket: WebSocket | null = null;
let reconnectTimer = 0;
let reconnectAttempt = 0;
let joining = false;
let joinOpen = false;
let joinCode = '';
let selectedPatch = 'mint';
let unlocked = false;
let notice = '';
let noticeKind: 'error' | 'success' = 'error';

function sessionKey(code: string): string { return `together_room:${code}`; }

function loadSession(code: string): Session | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(sessionKey(code)) ?? 'null') as Session | null;
    if (!parsed || parsed.expires_at * 1000 <= Date.now()) return null;
    return parsed;
  } catch { return null; }
}

function saveSession(next: Session): void {
  localStorage.setItem(sessionKey(next.code), JSON.stringify(next));
}

function setNotice(message: string, kind: 'error' | 'success' = 'error'): void {
  notice = message;
  noticeKind = kind;
  renderNotice();
}

function renderNotice(): void {
  const banner = document.querySelector<HTMLElement>('#status-banner');
  if (!banner) return;
  banner.hidden = !notice;
  banner.className = `status-banner ${noticeKind === 'success' ? 'success' : ''}`;
  banner.textContent = notice;
}

function layout(content: string): string {
  return `
    <header class="site-header">
      <a class="brand" href="/" data-nav><img src="/assets/mark.svg" width="52" height="32" alt="" /> Together Room</a>
      <div class="header-tools"><span class="privacy-chip">private by design</span>${session ? '<button class="quiet small" data-action="leave">Leave room</button>' : ''}</div>
    </header>
    <div id="status-banner" class="status-banner" role="status" aria-live="polite" ${notice ? '' : 'hidden'}></div>
    ${content}
    <footer class="site-footer">
      <span>No ads · no accounts · no open chat · rooms expire</span>
      <nav class="footer-links" aria-label="Footer"><a href="/privacy" data-nav>Privacy</a><a href="/terms" data-nav>Terms</a><span>Hero art made with the factory image model</span></nav>
    </footer>`;
}

function render(): void {
  applyTheme();
  const path = location.pathname;
  if (path === '/privacy') app.innerHTML = layout(privacyPage());
  else if (path === '/terms') app.innerHTML = layout(termsPage());
  else if (session) app.innerHTML = layout(roomPage());
  else app.innerHTML = layout(landingPage());
  renderNotice();
}

function landingPage(): string {
  const offline = !navigator.onLine;
  return `<main id="main">
    <section class="hero" aria-labelledby="page-title">
      <div class="hero-copy">
        <p class="eyebrow">Two windows · ten good minutes</p>
        <h1 id="page-title">A tiny room to play together.</h1>
        <p class="lede">Three calm co-op games for a parent and child on different devices. Share six digits, take turns, then get back to your day.</p>
        <div class="entry-console">
          <div class="action-row">
            <button class="primary" data-action="create" ${joining || offline ? 'disabled' : ''}>${joining ? 'Making room…' : 'Make a room'}</button>
            <button data-action="show-join" aria-expanded="${joinOpen}" aria-controls="join-drawer">I have a code</button>
          </div>
          ${offline ? '<p class="field-error">You are offline. The welcome screen is saved, but making or joining a room needs a connection.</p>' : ''}
          <div class="join-drawer" id="join-drawer" ${joinOpen ? '' : 'hidden'}>
            <form data-form="join" novalidate>
              <div class="form-row"><div><label for="room-code">Six-digit room code</label><input class="code-input" id="room-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" value="${escapeHtml(displayRoomCode(joinCode))}" aria-describedby="join-help" /></div><button class="primary" ${joining || offline ? 'disabled' : ''}>${joining ? 'Opening…' : 'Open room'}</button></div>
              <p class="tiny" id="join-help">The other player will see the code at the top of their room.</p>
              <p class="field-error" id="join-error" aria-live="polite"></p>
            </form>
          </div>
        </div>
      </div>
      <figure class="hero-art">
        <picture><source srcset="/assets/together-room-hero-720.webp 720w, /assets/together-room-hero-1200.webp 1200w" sizes="(max-width: 860px) calc(100vw - 24px), 52vw" type="image/webp" /><img src="/assets/together-room-hero-1200.webp" width="1200" height="800" fetchpriority="high" decoding="async" alt="Two cozy pixel-art treehouses on floating islands joined by a glowing stepped bridge" /></picture>
        <figcaption class="art-caption"><span>signal: steady</span><span>players: 2</span></figcaption>
      </figure>
    </section>
    <section class="tape" aria-label="How a room works">
      <div class="tape-step"><span class="tape-number">1</span><div><h2>Connect</h2><p>Send a private link or read out six digits.</p></div></div>
      <div class="tape-step"><span class="tape-number">2</span><div><h2>Choose</h2><p>Pick a two-player puzzle. No setup lesson.</p></div></div>
      <div class="tape-step"><span class="tape-number">3</span><div><h2>Play</h2><p>Take turns for a round or two. Rejoin if Wi-Fi blips.</p></div></div>
    </section>
    <section class="promise">
      <div><p class="eyebrow">Bounded on purpose</p><h2>A playroom, not a platform</h2><ul class="plain-list"><li>No account or profile</li><li>No chat, strangers, feeds, or friend requests</li><li>No ads, analytics, or third-party scripts</li><li>Room state deletes after two hours</li><li>Works with keyboard, touch, and reduced motion</li></ul></div>
      ${packMarkup()}
    </section>
  </main>`;
}

function packMarkup(): string {
  if (unlocked) return `<aside class="pack"><p class="eyebrow">Family pack restored</p><h2>Your extra tapes are ready</h2><p>Pick a room palette. Your three games and all safety features were always included.</p><div class="theme-picker" role="group" aria-label="Room palette"><button class="theme-swatch" data-theme="night" aria-label="Night palette"></button><button class="theme-swatch" data-theme="dawn" aria-label="Dawn palette"></button><button class="theme-swatch" data-theme="berry" aria-label="Berry palette"></button></div></aside>`;
  return `<aside class="pack" aria-labelledby="pack-title"><p class="eyebrow">Optional family pack</p><h2 id="pack-title">More color, never more pressure</h2><p>Two extra room palettes, celebration stamps, and one-tap surprise picks. Every game, reconnect, and safety feature stays free.</p><p class="pack-price">US$8 once · no subscription</p><div class="pack-actions"><a class="button primary" href="${BILLING_BASE}/products/${SLUG}/checkout">Buy family pack</a></div><details class="restore"><summary>Have a license? Restore it</summary><form data-form="restore"><label for="license">License token</label><div class="form-row"><input class="license-input" id="license" name="license" autocomplete="off" required /><button>Verify license</button></div><p class="field-error" id="license-error" aria-live="polite"></p></form></details><p class="tiny">Sociobot/Dodo is the merchant of record and handles refunds. A refund disables the license. See <a href="/terms" data-nav>terms</a> and <a href="/privacy" data-nav>privacy</a>.</p></aside>`;
}

function roomPage(): string {
  if (!session) return '';
  const body = room ? (room.phase === 'lobby' ? lobbyMarkup() : room.phase === 'won' ? winMarkup() : gameMarkup()) : loadingRoomMarkup();
  return `<main id="main" class="room-shell">
    <div class="room-topbar">
      <div><button class="quiet small" data-action="share">Copy invite</button></div>
      <div class="room-code"><small>room code</small>${displayRoomCode(session.code)}</div>
      <div class="connection-pair" aria-label="Player connections">${windowStatus(0)}${windowStatus(1)}</div>
    </div>
    <div class="room-stage">${body}</div>
  </main>`;
}

function windowStatus(seat: Seat): string {
  return `<span class="window-status ${connected[seat] ? 'online' : ''}"><i class="status-light" aria-hidden="true"></i>Window ${seat === 0 ? 'A' : 'B'}${session?.seat === seat ? ' (you)' : ''}: ${connected[seat] ? 'connected' : 'away'}</span>`;
}

function loadingRoomMarkup(): string {
  return `<section aria-labelledby="room-loading"><p class="eyebrow">Tuning the signal</p><h1 id="room-loading">Opening your room…</h1><p class="lede">If the connection dropped, this device will keep trying automatically.</p></section>`;
}

function lobbyMarkup(): string {
  const ready = connected[0] && connected[1];
  return `<section aria-labelledby="lobby-title">
    <div class="room-intro"><div><p class="eyebrow">You are Window ${session?.seat === 0 ? 'A' : 'B'}</p><h1 id="lobby-title">Choose tonight’s tiny adventure.</h1><p>Either player can start. You will always take turns.</p></div><span class="waiting-signal ${ready ? 'ready' : ''}">${ready ? 'Both windows are lit' : 'Waiting for the other window'}</span></div>
    <div class="game-picker">
      ${gameCard('star_signal', '✦', 'Star Signal', 'Each window holds half the clues. Say them aloud and rebuild the six-symbol signal.')}
      ${gameCard('patchwork', '▦', 'Patchwork Pair', 'Match the stitched edges and alternate tiles until one shared nine-patch picture appears.')}
      ${gameCard('firefly_ferry', '◆', 'Firefly Ferry', 'Window A steers sideways; Window B steers vertically. Guide one light around the river stones.')}
    </div>
  </section>`;
}

function gameCard(kind: string, icon: string, name: string, copy: string): string {
  const disabled = !(connected[0] && connected[1]);
  return `<article class="game-card"><span class="game-icon" aria-hidden="true">${icon}</span><div><h2>${name}</h2><p>${copy}</p></div><button class="primary" data-start="${kind}" ${disabled ? 'disabled' : ''}>Play ${name}</button></article>`;
}

function gameMarkup(): string {
  if (!room || !session) return '';
  const mine = room.turn === session.seat;
  const title = GAME_NAMES[room.kind] ?? 'Together game';
  let board = '';
  if (room.kind === 'star_signal') board = starBoard(mine);
  if (room.kind === 'patchwork') board = patchBoard(mine);
  if (room.kind === 'firefly_ferry') board = riverBoard(mine);
  return `<section aria-labelledby="game-title"><div class="game-header"><div><p class="eyebrow">Round ${room.round} · ${room.moves} turns</p><h1 id="game-title">${title}</h1><p class="round-message" aria-live="polite">${escapeHtml(room.message)}</p></div><span class="turn-chip ${mine ? 'mine' : ''}">${mine ? 'Your move' : "Partner's move"}</span></div><div class="game-board-wrap"><div class="game-board">${board}</div><aside class="game-aside"><h2>Play aloud</h2>${instructions(room.kind)}<button class="quiet small" data-action="lobby">Choose another game</button></aside></div></section>`;
}

function instructions(kind: string): string {
  if (kind === 'star_signal') return '<p>Read only the symbols shown in your window. Your partner has the missing ones. On your turn, choose the next symbol you agreed on.</p>';
  if (kind === 'patchwork') return '<p>The colored top stitch tells you which patch belongs in a square. Choose a color, then an empty square. A mismatch simply asks you to try again.</p>';
  return `<p>${session?.seat === 0 ? 'You move the light left or right.' : 'You move the light up or down.'} Plan the whole path together; stones block a square.</p>`;
}

function starBoard(mine: boolean): string {
  if (!room || !session) return '';
  const sequence = room.board.sequence as string[];
  const progress = Number(room.board.progress ?? 0);
  const clues = clueForSeat(sequence, session.seat);
  return `<div class="clue-strip" aria-label="Your half of the signal">${clues.map((clue, index) => `<div class="clue ${clue === 'partner' ? 'partner' : ''} ${index < progress ? 'done' : ''}" aria-label="Step ${index + 1}: ${clue === 'partner' ? "partner's clue" : clue}">${clue === 'partner' ? 'other' : SYMBOLS[clue]}</div>`).join('')}</div><div class="progress-pips" aria-label="${progress} of 6 symbols complete">${sequence.map((_, index) => `<span class="pip ${index < progress ? 'lit' : ''}"></span>`).join('')}</div><div class="symbol-buttons" role="group" aria-label="Choose the next symbol">${Object.entries(SYMBOLS).map(([name, symbol]) => `<button class="symbol-button" data-symbol="${name}" aria-label="Choose ${name}" ${mine ? '' : 'disabled'}>${symbol}</button>`).join('')}</div>`;
}

function patchBoard(mine: boolean): string {
  if (!room) return '';
  const target = room.board.target as string[];
  const placed = room.board.placed as Array<string | null>;
  return `<div class="color-buttons" role="group" aria-label="Choose patch color">${['mint','sky','amber'].map((color) => `<button class="color-button" data-color="${color}" aria-pressed="${selectedPatch === color}" ${mine ? '' : 'disabled'}>${color}</button>`).join('')}</div><p class="tiny">Choose a color, then a square with the same top stitch.</p><div class="patch-grid" aria-label="Shared three by three patchwork">${placed.map((color, index) => `<button class="patch-cell ${color ? `filled ${color}` : ''}" data-patch-index="${index}" data-target="${target[index]}" aria-label="${color ? `${color} patch placed` : `Empty square, ${target[index]} top stitch`}" ${!mine || color ? 'disabled' : ''}></button>`).join('')}</div>`;
}

function riverBoard(mine: boolean): string {
  if (!room || !session) return '';
  const position = Number(room.board.position);
  const goal = Number(room.board.goal);
  const rocks = room.board.rocks as number[];
  const energy = Number(room.board.energy);
  const cells = Array.from({ length: 25 }, (_, index) => {
    const rock = rocks.includes(index), firefly = index === position;
    return `<div class="river-cell ${rock ? 'rock' : ''} ${index === goal ? 'goal' : ''} ${firefly ? 'firefly' : ''}" aria-label="${firefly ? 'Firefly' : rock ? 'River stone' : index === goal ? 'Home lantern' : 'Open water'}">${firefly ? '✦' : rock ? '■' : index === goal ? '⌂' : '≈'}</div>`;
  }).join('');
  const directions = session.seat === 0 ? [['left','← Left'],['right','Right →']] : [['up','↑ Up'],['down','Down ↓']];
  return `<div class="river-grid" role="img" aria-label="Five by five river grid. Guide the firefly to the outlined home lantern.">${cells}</div><div class="energy" aria-label="${energy} lights left">${Array.from({length: 14}, (_, i) => `<span class="${i < energy ? 'on' : ''}"></span>`).join('')}</div><div class="direction-buttons">${directions.map(([direction,label]) => `<button data-direction="${direction}" ${mine ? '' : 'disabled'}>${label}</button>`).join('')}</div>`;
}

function winMarkup(): string {
  if (!room) return '';
  return `<section class="win-panel" aria-labelledby="win-title"><div><p class="win-mark" aria-hidden="true">✦</p><p class="eyebrow">Round ${room.round} complete</p><h1 id="win-title">You did it together.</h1><p class="lede">${escapeHtml(room.message)} The room stays open, so one more round is easy.</p><div class="action-row"><button class="primary" data-action="again">Play this game again</button><button data-action="lobby">Choose another game</button></div>${unlocked ? '<p class="tiny">Family pack celebration stamp: SIGNAL KEPT ✦</p>' : ''}</div></section>`;
}

function privacyPage(): string {
  return `<main id="main" class="legal"><p class="eyebrow">Plain-language policy</p><h1>Privacy without profiles.</h1><time datetime="2026-08-27">Updated 27 August 2026</time><p class="lede">Together Room is designed so a parent and child can play without creating an identity.</p><h2>What a room stores</h2><p>When you create a room, our server stores its six-digit code, game board and turn state, two pseudonymous device-key hashes, connection timestamps, and an expiry time. We do not ask for names, ages, messages, contacts, or location. There is no open chat and no advertising or behavioral analytics.</p><h2>How long it stays</h2><p>Room records automatically expire two hours after creation and are deleted by a regular cleanup job. A reconnect key and optional purchase license are kept in your browser’s local storage so this device can reopen the room or restore the family pack. You can clear them through your browser settings.</p><h2>Purchases</h2><p>If you buy the optional family pack, checkout is hosted by Sociobot/Dodo, the merchant of record. Together Room sends you to that service; it does not receive card details. It stores the returned license token only on this device and sends that token to Sociobot to verify it at most once per day. Their transaction records follow their own legal retention duties.</p><h2>Children and safety</h2><p>The service does not knowingly collect personal information from children. Codes are not listed or matched publicly. Families should share a room code only with the person they intend to play with.</p><h2>Contact</h2><p>For privacy requests, email <a href="mailto:privacy@sociobot.in">privacy@sociobot.in</a>. Include no child’s personal details; a room code is enough for troubleshooting.</p></main>`;
}

function termsPage(): string {
  return `<main id="main" class="legal"><p class="eyebrow">Fair-play terms</p><h1>Short rooms, simple terms.</h1><time datetime="2026-08-27">Updated 27 August 2026</time><p class="lede">Together Room provides a private, temporary co-op activity. A parent or guardian should supervise a child’s use.</p><h2>Using the service</h2><p>Use rooms only with someone you know. Do not attempt to guess codes, disrupt other rooms, automate requests, reverse engineer access keys, or use the service for unlawful activity. Rooms expire and availability is not guaranteed.</p><h2>Family pack</h2><p>The optional family pack costs US$8 as a one-time purchase and unlocks two palettes, celebration stamps, and surprise picks on devices where its license is restored. The three games, reconnect, accessibility, privacy, and safety features are free. Sociobot/Dodo is the merchant of record and handles payment and refunds. A refunded, expired, revoked, or wrong-product license stops unlocking extras.</p><h2>No warranty</h2><p>The service is provided “as is” without warranties to the extent allowed by law. We are not liable for indirect loss. Nothing here limits rights that cannot legally be limited, including applicable consumer rights.</p><h2>Changes and contact</h2><p>Material changes will be posted here with a new date. Questions can be sent to <a href="mailto:support@sociobot.in">support@sociobot.in</a>.</p></main>`;
}

async function createRoom(): Promise<void> {
  if (joining || !navigator.onLine) return;
  joining = true; notice = ''; render();
  try {
    const response = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const data = await response.json() as Session & { error?: string };
    if (!response.ok) throw new Error(data.error ?? 'A room could not be made.');
    enterRoom(data);
  } catch (error) { setNotice(error instanceof Error ? error.message : 'A room could not be made.'); }
  finally { joining = false; if (!session) render(); }
}

async function joinRoom(code: string): Promise<void> {
  const normalized = normalizeRoomCode(code);
  if (normalized.length !== 6) { showFormError('join-error', 'Enter all six digits.'); return; }
  joining = true; joinCode = normalized; render();
  try {
    const response = await fetch(`/api/rooms/${normalized}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const data = await response.json() as Session & { error?: string };
    if (!response.ok) throw new Error(data.error ?? 'That room could not be opened.');
    enterRoom(data);
  } catch (error) { joining = false; render(); showFormError('join-error', error instanceof Error ? error.message : 'That room could not be opened.'); }
}

function enterRoom(next: Session): void {
  session = next; room = null; connected = [false, false]; saveSession(next);
  history.replaceState({}, '', `/?room=${next.code}`);
  render(); connectSocket();
}

function connectSocket(): void {
  if (!session || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
  clearTimeout(reconnectTimer);
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${location.host}/api/rooms/${session.code}/socket?token=${encodeURIComponent(session.token)}`);
  socket.addEventListener('open', () => { reconnectAttempt = 0; notice = ''; renderNotice(); });
  socket.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(String(event.data)) as RoomEvent | { type: 'error'; message: string };
      if (data.type === 'error') { setNotice(data.message); return; }
      room = data.room; connected = data.connected; render();
    } catch { setNotice('The room sent an unreadable update. Reconnecting may help.'); }
  });
  socket.addEventListener('close', () => {
    socket = null; connected = [false, false];
    if (session) { setNotice(navigator.onLine ? 'Signal lost. Reconnecting automatically…' : 'You are offline. The room will reconnect when the network returns.'); scheduleReconnect(); render(); }
  });
  socket.addEventListener('error', () => socket?.close());
}

function scheduleReconnect(): void {
  clearTimeout(reconnectTimer);
  const delay = Math.min(10_000, 800 * 2 ** reconnectAttempt++);
  reconnectTimer = window.setTimeout(connectSocket, delay);
}

function send(payload: object): void {
  if (socket?.readyState !== WebSocket.OPEN) { setNotice('The signal is reconnecting. Your move was not sent; try again when your window is lit.'); return; }
  socket.send(JSON.stringify(payload));
}

function leaveRoom(): void {
  socket?.close(); socket = null; session = null; room = null; connected = [false, false]; notice = '';
  history.pushState({}, '', '/'); render();
}

async function shareRoom(): Promise<void> {
  if (!session) return;
  const url = `${location.origin}/?room=${session.code}`;
  try {
    if (navigator.share) await navigator.share({ title: 'Join my Together Room', text: `Our room code is ${displayRoomCode(session.code)}`, url });
    else { await navigator.clipboard.writeText(url); setNotice('Invite link copied.', 'success'); }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    try { await navigator.clipboard.writeText(session.code); setNotice('Room code copied.', 'success'); }
    catch { setNotice(`Share this code: ${displayRoomCode(session.code)}`, 'success'); }
  }
}

function showFormError(id: string, message: string): void {
  const target = document.querySelector<HTMLElement>(`#${id}`);
  if (target) target.textContent = message;
}

function navigate(path: string): void {
  if (path === location.pathname) return;
  history.pushState({}, '', path); render(); window.scrollTo({ top: 0 });
}

function applyTheme(): void {
  document.body.classList.remove('theme-dawn', 'theme-berry');
  const theme = unlocked ? localStorage.getItem('together_theme') : 'night';
  if (theme === 'dawn' || theme === 'berry') document.body.classList.add(`theme-${theme}`);
}

async function initializeLicense(): Promise<void> {
  const url = new URL(location.href);
  const incoming = url.searchParams.get('license');
  if (incoming) {
    localStorage.setItem(LICENSE_KEY, incoming);
    localStorage.removeItem(VERDICT_KEY);
    history.replaceState({}, '', safeReturnPath(url));
  }
  const token = localStorage.getItem(LICENSE_KEY);
  let cached: LicenseVerdict | null = null;
  try { cached = JSON.parse(localStorage.getItem(VERDICT_KEY) ?? 'null') as LicenseVerdict | null; } catch { /* ignore damaged cache */ }
  unlocked = Boolean(token && cached?.valid);
  render();
  if (!token || (cached && Date.now() - cached.checked_at < 86_400_000)) return;
  await verifyLicense(token);
}

async function verifyLicense(token: string): Promise<void> {
  try {
    const response = await fetch(`${BILLING_BASE}/products/${SLUG}/verify?license=${encodeURIComponent(token)}`);
    const data = await response.json() as { valid: boolean; reason?: string };
    const verdict: LicenseVerdict = { valid: Boolean(data.valid), checked_at: Date.now(), reason: data.reason };
    localStorage.setItem(VERDICT_KEY, JSON.stringify(verdict)); unlocked = verdict.valid;
    if (!verdict.valid) setNotice('This license is no longer active. The three games are still ready to play.');
    else setNotice('Family pack restored on this device.', 'success');
    render();
  } catch { /* Keep an already-cached valid verdict during a network failure. */ }
}

app.addEventListener('click', (event) => {
  const target = (event.target as Element).closest<HTMLElement>('a,button');
  if (!target) return;
  if (target.matches('[data-nav]')) { event.preventDefault(); navigate((target as HTMLAnchorElement).getAttribute('href') ?? '/'); return; }
  const action = target.dataset.action;
  if (action === 'create') void createRoom();
  if (action === 'show-join') { joinOpen = !joinOpen; render(); if (joinOpen) document.querySelector<HTMLInputElement>('#room-code')?.focus(); }
  if (action === 'leave') leaveRoom();
  if (action === 'share') void shareRoom();
  if (action === 'lobby') send({ type: 'lobby' });
  if (action === 'again') send({ type: 'play_again' });
  if (target.dataset.start) send({ type: 'start', game: target.dataset.start });
  if (target.dataset.symbol) send({ type: 'move', action: 'choose_symbol', value: target.dataset.symbol });
  if (target.dataset.color) { selectedPatch = target.dataset.color; render(); }
  if (target.dataset.patchIndex) send({ type: 'move', action: 'place_patch', value: { index: Number(target.dataset.patchIndex), color: selectedPatch } });
  if (target.dataset.direction) send({ type: 'move', action: 'move_firefly', value: target.dataset.direction });
  if (target.dataset.theme) { if (unlocked) { localStorage.setItem('together_theme', target.dataset.theme); render(); } }
});

app.addEventListener('input', (event) => {
  const input = event.target as HTMLInputElement;
  if (input.id === 'room-code') { joinCode = normalizeRoomCode(input.value); input.value = displayRoomCode(joinCode); }
});

app.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  const data = new FormData(form);
  if (form.dataset.form === 'join') void joinRoom(String(data.get('code') ?? ''));
  if (form.dataset.form === 'restore') {
    const token = String(data.get('license') ?? '').trim();
    if (token.length < 8 || token.length > 512) { showFormError('license-error', 'Paste the complete license token.'); return; }
    localStorage.setItem(LICENSE_KEY, token); localStorage.removeItem(VERDICT_KEY); void verifyLicense(token);
  }
});

window.addEventListener('popstate', () => { if (location.pathname !== '/') { socket?.close(); socket = null; } render(); });
window.addEventListener('online', () => { notice = ''; if (session) connectSocket(); render(); });
window.addEventListener('offline', () => { setNotice('You are offline. An open room will reconnect when the network returns.'); render(); });

const initialCode = normalizeRoomCode(new URL(location.href).searchParams.get('room') ?? '');
if (initialCode.length === 6) {
  const saved = loadSession(initialCode);
  if (saved) { session = saved; connectSocket(); }
  else { joinCode = initialCode; joinOpen = true; }
}

render();
void initializeLicense();
if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
