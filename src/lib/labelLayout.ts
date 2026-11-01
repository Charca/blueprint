/** Split labels over at most two balanced lines. Keeping the line count bounded
 * makes labels compact while avoiding a single line that grows indefinitely. */
export function labelLines(text: string, maxChars = 24): string[] {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const words = normalized.split(' ');
  if (words.length === 1) {
    const middle = Math.ceil(normalized.length / 2);
    return [normalized.slice(0, middle), normalized.slice(middle)];
  }

  let best = 1;
  let bestWidth = Infinity;
  for (let i = 1; i < words.length; i += 1) {
    const left = words.slice(0, i).join(' ');
    const right = words.slice(i).join(' ');
    const width = Math.max(left.length, right.length);
    if (width < bestWidth) {
      best = i;
      bestWidth = width;
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

export const LABEL_INLINE_PADDING = 14;

/** Approximate Inter/system-ui bold glyph widths at the label's 13px size.
 * This only sizes the pill; SVG text remains naturally rendered and unscaled. */
export function estimateLabelLineWidth(line: string): number {
  return [...line].reduce((width, char) => {
    if (char === ' ') return width + 3.5;
    if (/[ilIjtfr.,'!:;|]/.test(char)) return width + 4;
    if (/[MW@%&]/.test(char)) return width + 10;
    if (/[A-Z0-9]/.test(char)) return width + 8;
    return width + 7;
  }, 0);
}

export function labelWidth(lines: string[], inlinePadding = LABEL_INLINE_PADDING): number {
  const longest = Math.max(0, ...lines.map(estimateLabelLineWidth));
  return longest + inlinePadding * 2;
}
