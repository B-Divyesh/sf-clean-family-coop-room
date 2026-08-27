export type Seat = 0 | 1;

export function normalizeRoomCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

export function displayRoomCode(value: string): string {
  const code = normalizeRoomCode(value);
  return code.length > 3 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

export function clueForSeat(sequence: string[], seat: Seat): string[] {
  return sequence.map((symbol, index) => index % 2 === seat ? symbol : 'partner');
}

export function safeReturnPath(url: URL): string {
  url.searchParams.delete('license');
  return `${url.pathname}${url.search}${url.hash}`;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char);
}
