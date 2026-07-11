export function getParagraphBounds(text: string, index: number): { start: number; end: number } {
  const clamped = Math.max(0, Math.min(index, text.length));
  const start = text.lastIndexOf('\n', clamped - 1) + 1;
  const nextNewline = text.indexOf('\n', clamped);
  const end = nextNewline === -1 ? text.length : nextNewline;
  return { start, end };
}

/** Paragraphs whose text offsets overlap the selection (or caret). */
export function getParagraphRangesForSelection(
  text: string,
  selStart: number,
  selEnd: number
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  const seen = new Set<number>();

  let pos = 0;
  while (pos <= text.length) {
    const start = pos;
    const nextNewline = text.indexOf('\n', pos);
    const end = nextNewline === -1 ? text.length : nextNewline;

    if (selStart <= end && selEnd >= start && !seen.has(start)) {
      ranges.push({ start, end });
      seen.add(start);
    }

    if (nextNewline === -1) break;
    pos = nextNewline + 1;
  }

  return ranges;
}
