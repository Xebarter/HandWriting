/** Controlled plain-text editing commands for the document editor. */

export interface TextRange {
  anchor: number;
  focus: number;
}

export function clampRange(range: TextRange, length: number): TextRange {
  return {
    anchor: Math.max(0, Math.min(range.anchor, length)),
    focus: Math.max(0, Math.min(range.focus, length)),
  };
}

export function rangesEqual(a: TextRange, b: TextRange): boolean {
  return a.anchor === b.anchor && a.focus === b.focus;
}

export function rangeBounds(range: TextRange) {
  return {
    start: Math.min(range.anchor, range.focus),
    end: Math.max(range.anchor, range.focus),
  };
}

export function normalizeEditorText(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function deleteRange(text: string, range: TextRange): { text: string; range: TextRange } {
  const { start, end } = rangeBounds(range);
  const nextText = text.slice(0, start) + text.slice(end);
  return { text: nextText, range: { anchor: start, focus: start } };
}

export function insertParagraph(text: string, range: TextRange): { text: string; range: TextRange } {
  const { start, end } = rangeBounds(range);
  const nextText = `${text.slice(0, start)}\n${text.slice(end)}`;
  const offset = start + 1;
  return { text: nextText, range: { anchor: offset, focus: offset } };
}

export function insertTextAt(
  text: string,
  range: TextRange,
  insert: string
): { text: string; range: TextRange } {
  const normalized = normalizeEditorText(insert);
  const { start, end } = rangeBounds(range);
  const nextText = `${text.slice(0, start)}${normalized}${text.slice(end)}`;
  const offset = start + normalized.length;
  return { text: nextText, range: { anchor: offset, focus: offset } };
}

export function deleteBackward(
  text: string,
  range: TextRange
): { text: string; range: TextRange } | null {
  if (range.anchor !== range.focus) {
    return deleteRange(text, range);
  }
  if (range.focus === 0) return null;
  const nextText = `${text.slice(0, range.focus - 1)}${text.slice(range.focus)}`;
  const offset = range.focus - 1;
  return { text: nextText, range: { anchor: offset, focus: offset } };
}

export function deleteForward(
  text: string,
  range: TextRange
): { text: string; range: TextRange } | null {
  if (range.anchor !== range.focus) {
    return deleteRange(text, range);
  }
  if (range.focus >= text.length) return null;
  const nextText = `${text.slice(0, range.focus)}${text.slice(range.focus + 1)}`;
  return { text: nextText, range: { anchor: range.focus, focus: range.focus } };
}

export type EditorInputCommand =
  | { type: 'insertParagraph' }
  | { type: 'insertText'; text: string }
  | { type: 'deleteBackward' }
  | { type: 'deleteForward' };

export function applyEditorCommand(
  text: string,
  range: TextRange,
  command: EditorInputCommand
): { text: string; range: TextRange } | null {
  const normalized = normalizeEditorText(text);
  const clamped = clampRange(range, normalized.length);

  switch (command.type) {
    case 'insertParagraph':
      return insertParagraph(normalized, clamped);
    case 'insertText':
      if (!command.text) return null;
      return insertTextAt(normalized, clamped, command.text);
    case 'deleteBackward':
      return deleteBackward(normalized, clamped);
    case 'deleteForward':
      return deleteForward(normalized, clamped);
    default:
      return null;
  }
}
