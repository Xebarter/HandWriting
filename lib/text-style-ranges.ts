import { HandwritingMode, TextStyleRange } from '@/lib/types';

export interface ResolvedTextStyle {
  mode: HandwritingMode;
  linksEnabled: boolean;
  fontSize: number;
}

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
      fontSize: range.fontSize ?? resolved.fontSize,
    };
  }

  return resolved;
}

function sameStyle(a: TextStyleRange, b: TextStyleRange): boolean {
  return (
    a.mode === b.mode &&
    a.linksEnabled === b.linksEnabled &&
    a.fontSize === b.fontSize
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

export function applyTextStyleToRange(
  ranges: TextStyleRange[],
  start: number,
  end: number,
  patch: Partial<Pick<TextStyleRange, 'mode' | 'linksEnabled' | 'fontSize'>>
): TextStyleRange[] {
  if (end <= start) return ranges;

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
    mode: patch.mode,
    linksEnabled: patch.linksEnabled,
    fontSize: patch.fontSize,
  });

  return normalizeTextStyleRanges(next);
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
