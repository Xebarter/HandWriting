import {
  caretPositionFromLayout,
  lineIndexForOffset,
  WorksheetTextLayout,
} from '@/lib/text-line-layout';

function isWordSeparator(char: string): boolean {
  return /\s/.test(char);
}

/** Offset of the start of the word at/before the given offset (Ctrl+Left). */
export function wordLeft(text: string, offset: number): number {
  let index = Math.max(0, Math.min(offset, text.length));
  while (index > 0 && isWordSeparator(text[index - 1])) index -= 1;
  while (index > 0 && !isWordSeparator(text[index - 1])) index -= 1;
  return index;
}

/** Offset of the end of the word at/after the given offset (Ctrl+Right). */
export function wordRight(text: string, offset: number): number {
  const length = text.length;
  let index = Math.max(0, Math.min(offset, length));
  while (index < length && isWordSeparator(text[index])) index += 1;
  while (index < length && !isWordSeparator(text[index])) index += 1;
  return index;
}

/** Start offset of the visual line containing the offset (Home). */
export function lineStartOffset(layout: WorksheetTextLayout, offset: number): number {
  const lines = layout.lines;
  if (lines.length === 0) return 0;
  return lines[lineIndexForOffset(layout, offset)].start;
}

/** End offset of the visual line containing the offset (End). */
export function lineEndOffset(layout: WorksheetTextLayout, offset: number): number {
  const lines = layout.lines;
  if (lines.length === 0) return 0;
  return lines[lineIndexForOffset(layout, offset)].end;
}

/** Offset on a specific visual line closest to a target x coordinate. */
export function offsetAtLineX(
  layout: WorksheetTextLayout,
  lineArrayIndex: number,
  targetX: number
): number {
  const lines = layout.lines;
  if (lines.length === 0) return 0;

  const line = lines[Math.max(0, Math.min(lineArrayIndex, lines.length - 1))];
  if (line.start >= line.end) {
    return line.start;
  }

  const lineChars = layout.chars.filter(
    (char) => char.lineIndex === line.lineIndex && char.charIndex >= line.start && char.charIndex < line.end
  );

  let bestOffset = line.start;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const char of lineChars) {
    const distance = Math.abs(char.x - targetX);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestOffset = char.charIndex;
    }
  }

  const lastChar = lineChars[lineChars.length - 1];
  if (lastChar) {
    const endDistance = Math.abs(lastChar.x + lastChar.width - targetX);
    if (endDistance < bestDistance) {
      bestOffset = line.end;
    }
  }

  return bestOffset;
}

export interface VerticalMoveResult {
  offset: number;
  /** The x used for the move; callers keep this as the sticky column. */
  stickyX: number;
}

/**
 * Move the caret one visual line up or down, keeping the preferred column
 * (sticky X) like Word / Google Docs.
 */
export function moveVertical(
  layout: WorksheetTextLayout,
  textLength: number,
  offset: number,
  direction: -1 | 1,
  preferredX: number | null
): VerticalMoveResult {
  const lines = layout.lines;
  const stickyX = preferredX ?? caretPositionFromLayout(layout, offset).x;

  if (lines.length === 0) {
    return { offset: direction < 0 ? 0 : textLength, stickyX };
  }

  const currentLine = lineIndexForOffset(layout, offset);
  const targetLine = currentLine + direction;

  if (targetLine < 0) {
    return { offset: 0, stickyX };
  }
  if (targetLine >= lines.length) {
    return { offset: textLength, stickyX };
  }

  return { offset: offsetAtLineX(layout, targetLine, stickyX), stickyX };
}
