export const KIT_COLORS = [
  '#3258C2', '#3261E4', '#618AFF', '#5983F8', '#7394F3',
  '#7D9EFC', '#88A7FF', '#A3BBFF', '#D6E0FF',
] as const;

export const KIT_BASE = '#618AFF';

export const PRESETS = {
  gray: '#A9B4CC',
  blue: '#618AFF',
  teal: '#1FD9C6',
} as const;

export interface Hsl { h: number; s: number; l: number }

export function hexToHsl(hex: string): Hsl {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return { h, s, l };
}

export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Map each kit color to a shade derived from `base`, preserving the kit's
 * hue offsets and saturation/lightness ratios relative to KIT_BASE. */
export function derivePalette(base: string): Record<string, string> {
  const refBase = hexToHsl(KIT_BASE);
  const b = hexToHsl(base);
  const out: Record<string, string> = {};
  for (const ref of KIT_COLORS) {
    const r = hexToHsl(ref);
    const h = b.h + (r.h - refBase.h);
    const s = clamp01((r.s / refBase.s) * b.s);
    const l = clamp01((r.l / refBase.l) * b.l);
    out[ref.toLowerCase()] = hslToHex(h, s, l);
  }
  return out;
}
