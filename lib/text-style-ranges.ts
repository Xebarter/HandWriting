import { HandwritingMode, TextStyleRange } from '@/lib/types';

export type TextAlign = 'left' | 'center' | 'right';

export interface ResolvedTextStyle {
  mode: HandwritingMode;
  linksEnabled: boolean;
  lettersTouching: boolean;
  fontSize: number;
  textAlign: TextAlign;
  textColor: string;
}

type StylePatch = Partial<
  Pick<
    TextStyleRange,
    | 'mode'
    | 'linksEnabled'
    | 'lettersTouching'
    | 'fontSize'
    | 'textAlign'
    | 'textColor'
  >
>;

export function getResolvedTextStyle(
  ranges: TextStyleRange[],
  charIndex: number,
  defaults: ResolvedTextStyle
): ResolvedTextStyle {
  let resolved = defaults;

  for (const range of ranges) {
    if (charIndex < range.start || charIndex >= range.end) continue;
    resolved = {
      mode: range.mode ?? resolved.mode,
      linksEnabled: range.linksEnabled ?? resolved.linksEnabled,
      lettersTouching: range.lettersTouching ?? resolved.lettersTouching,
      fontSize: range.fontSize ?? resolved.fontSize,
      textAlign: range.textAlign ?? resolved.textAlign,
      textColor: range.textColor ?? resolved.textColor,
    };
  }

  return resolved;
}

function sameStyle(a: TextStyleRange, b: TextStyleRange): boolean {
  return (
    a.mode === b.mode &&
    a.linksEnabled === b.linksEnabled &&
    a.lettersTouching === b.lettersTouching &&
    a.fontSize === b.fontSize &&
    a.textAlign === b.textAlign &&
    a.textColor === b.textColor
  );
}

export function normalizeTextStyleRanges(ranges: TextStyleRange[]): TextStyleRange[] {
  const filtered = ranges
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const normalized: TextStyleRange[] = [];

  for (const range of filtered) {
    const last = normalized[normalized.length - 1];
    if (last && last.end >= range.start && sameStyle(last, range)) {
      last.end = Math.max(last.end, range.end);
      continue;
    }
    normalized.push({ ...range });
  }

  return normalized;
}

function mergedStyleInRange(ranges: TextStyleRange[], start: number, end: number): StylePatch {
  const merged: StylePatch = {};

  for (const range of ranges) {
    if (range.end <= start || range.start >= end) continue;
    if (range.mode !== undefined) merged.mode = range.mode;
    if (range.linksEnabled !== undefined) merged.linksEnabled = range.linksEnabled;
    if (range.lettersTouching !== undefined) merged.lettersTouching = range.lettersTouching;
    if (range.fontSize !== undefined) merged.fontSize = range.fontSize;
    if (range.textAlign !== undefined) merged.textAlign = range.textAlign;
    if (range.textColor !== undefined) merged.textColor = range.textColor;
  }

  return merged;
}

export function applyTextStyleToRange(
  ranges: TextStyleRange[],
  start: number,
  end: number,
  patch: StylePatch
): TextStyleRange[] {
  if (end <= start) return ranges;

  const inherited = mergedStyleInRange(ranges, start, end);

  const next: TextStyleRange[] = [];
  for (const range of ranges) {
    if (range.end <= start || range.start >= end) {
      next.push(range);
      continue;
    }

    if (range.start < start) {
      next.push({ ...range, end: start });
    }

    if (range.end > end) {
      next.push({ ...range, start: end });
    }
  }

  next.push({
    start,
    end,
    mode: patch.mode ?? inherited.mode,
    linksEnabled: patch.linksEnabled ?? inherited.linksEnabled,
    lettersTouching: patch.lettersTouching ?? inherited.lettersTouching,
    fontSize: patch.fontSize ?? inherited.fontSize,
    textAlign: patch.textAlign ?? inherited.textAlign,
    textColor: patch.textColor ?? inherited.textColor,
  });

  return normalizeTextStyleRanges(next);
}

export function stripModeFromRanges(ranges: TextStyleRange[]): TextStyleRange[] {
  return normalizeTextStyleRanges(
    ranges
      .map(({ mode: _mode, ...rest }) => rest)
      .filter(
        (range) =>
          range.linksEnabled !== undefined ||
          range.lettersTouching !== undefined ||
          range.fontSize !== undefined ||
          range.textAlign !== undefined ||
          range.textColor !== undefined
      )
  );
}

/** Apply paragraph alignment even when the paragraph has no visible characters. */
export function applyParagraphAlignToRange(
  ranges: TextStyleRange[],
  paragraphStart: number,
  paragraphEnd: number,
  text: string,
  textAlign: TextAlign
): TextStyleRange[] {
  let applyStart = paragraphStart;
  let applyEnd = paragraphEnd;

  if (applyEnd <= applyStart) {
    if (applyStart < text.length && text[applyStart] === '\n') {
      applyEnd = applyStart + 1;
    } else if (applyStart > 0 && text[applyStart - 1] === '\n') {
      applyStart -= 1;
      applyEnd = applyStart + 1;
    } else {
      return ranges;
    }
  }

  return applyTextStyleToRange(ranges, applyStart, applyEnd, { textAlign });
}

export function rebaseTextStyleRanges(
  ranges: TextStyleRange[],
  previousText: string,
  nextText: string
): TextStyleRange[] {
  if (previousText === nextText) return ranges;

  let prefix = 0;
  while (
    prefix < previousText.length &&
    prefix < nextText.length &&
    previousText[prefix] === nextText[prefix]
  ) {
    prefix += 1;
  }

  let prevSuffix = previousText.length - 1;
  let nextSuffix = nextText.length - 1;
  while (
    prevSuffix >= prefix &&
    nextSuffix >= prefix &&
    previousText[prevSuffix] === nextText[nextSuffix]
  ) {
    prevSuffix -= 1;
    nextSuffix -= 1;
  }

  const removed = prevSuffix - prefix + 1;
  const inserted = nextSuffix - prefix + 1;
  const delta = inserted - removed;

  const rebased = ranges
    .map((range) => {
      if (range.end <= prefix) return { ...range };
      if (range.start >= prefix + removed) {
        return { ...range, start: range.start + delta, end: range.end + delta };
      }

      const newStart = Math.min(range.start, prefix);
      const newEnd = Math.max(prefix, range.end + delta);
      if (newEnd <= newStart) return null;
      return { ...range, start: newStart, end: newEnd };
    })
    .filter((range): range is TextStyleRange => Boolean(range));

  return normalizeTextStyleRanges(rebased);
}
