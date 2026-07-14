export function wrapText(
  text: string,
  maxChars = 30,
  maxLines = Number.POSITIVE_INFINITY,
  breakLongWords = false,
): string[] {
  const limit = Math.max(1, maxChars);
  const lineLimit = Math.max(1, Math.floor(maxLines));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';

  const pushLine = (line: string) => {
    if (lines.length < lineLimit) lines.push(line);
  };

  const appendOverflow = (value: string) => {
    if (!breakLongWords) return value;
    let rest = value;
    while (rest.length > limit && lines.length < lineLimit - 1) {
      pushLine(rest.slice(0, limit));
      rest = rest.slice(limit);
    }
    return rest.slice(0, limit);
  };

  for (const word of words) {
    if (lines.length >= lineLimit) break;
    if (!cur && word.length > limit) {
      cur = appendOverflow(word);
      continue;
    }

    const next = cur ? `${cur} ${word}` : word;
    if (next.length > limit && cur) {
      pushLine(cur);
      cur = word.length > limit && lines.length < lineLimit ? appendOverflow(word) : word;
    } else {
      cur = next;
    }
  }

  if (cur && lines.length < lineLimit) pushLine(breakLongWords ? cur.slice(0, limit) : cur);
  return lines;
}
