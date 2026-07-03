import { describe, expect, it } from 'vitest';
import { KIT_COLORS, KIT_BASE, derivePalette, hexToHsl, hslToHex } from './color';

function channelDelta(a: string, b: string): number {
  const ca = a.replace('#', ''), cb = b.replace('#', '');
  let max = 0;
  for (let i = 0; i < 6; i += 2) {
    max = Math.max(max, Math.abs(parseInt(ca.slice(i, i + 2), 16) - parseInt(cb.slice(i, i + 2), 16)));
  }
  return max;
}

describe('color', () => {
  it('round-trips hex through HSL within 1/channel', () => {
    for (const hex of KIT_COLORS) {
      const { h, s, l } = hexToHsl(hex);
      expect(channelDelta(hslToHex(h, s, l), hex)).toBeLessThanOrEqual(1);
    }
  });

  it('derivePalette of the kit base reproduces the kit palette', () => {
    const pal = derivePalette(KIT_BASE);
    for (const hex of KIT_COLORS) {
      expect(channelDelta(pal[hex.toLowerCase()], hex)).toBeLessThanOrEqual(1);
    }
  });

  it('derivePalette of a red base shifts every color toward red hue', () => {
    const pal = derivePalette('#E05252');
    for (const hex of KIT_COLORS) {
      const out = hexToHsl(pal[hex.toLowerCase()]);
      const src = hexToHsl(hex);
      expect(out.h).not.toBeCloseTo(src.h, 0);
    }
  });

  it('derivePalette of a gray base yields desaturated shades', () => {
    const pal = derivePalette('#9AA0AB');
    for (const hex of KIT_COLORS) {
      expect(hexToHsl(pal[hex.toLowerCase()]).s).toBeLessThan(0.25);
    }
  });
});
