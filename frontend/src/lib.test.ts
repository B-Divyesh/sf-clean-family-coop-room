import { describe, expect, it } from 'vitest';
import { clueForSeat, displayRoomCode, normalizeRoomCode, safeReturnPath } from './lib';

describe('room code helpers', () => {
  it('keeps six digits and formats them for reading aloud', () => {
    expect(normalizeRoomCode('12a 34-567')).toBe('123456');
    expect(displayRoomCode('123456')).toBe('123 456');
  });
});

describe('seat clues', () => {
  it('shows alternating clues without changing sequence length', () => {
    expect(clueForSeat(['moon', 'star', 'sun', 'leaf'], 1)).toEqual(['partner', 'star', 'partner', 'leaf']);
  });
});

describe('license return URLs', () => {
  it('removes only the license query value', () => {
    expect(safeReturnPath(new URL('https://example.test/?room=123456&license=secret#play'))).toBe('/?room=123456#play');
  });
});
