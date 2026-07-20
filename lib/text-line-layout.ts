import { PAGE_HEIGHT, PAGE_MARGIN } from '@/lib/document-constants';
import { formatCanvasFont, measureRuledFont, RuledFontMetrics } from '@/lib/font-metrics';
import {
  GlyphInkExtents,
  measureGlyphInkExtents,
  touchingLetterAdvance,
} from '@/lib/glyph-ink-bounds';
import { HandwritingMode } from '@/lib/types';

export interface WorksheetTextOptions {
  text: string;
  mode: HandwritingMode;
  fontSize: number;
  dotSpacing: number;
  strokeWidth: number;
  textColor: string;
  dotColor: string;
  font?: string;
  maxWidth: number;
  textAlign: 'left' | 'center' | 'right';
  margin?: number;
  fontMetrics?: RuledFontMetrics;
  getCharMode?: (charIndex: number) => HandwritingMode;
  getCharFontSize?: (charIndex: number) => number;
  getCharAlign?: (charIndex: number) => 'left' | 'center' | 'right';
  getCharColor?: (charIndex: number) => string;
  /** When true for adjacent connectable letters, pull them so ink edges meet. */
  getCharLettersTouching?: (charIndex: number) => boolean;
}

export interface PlacedChar {
  char: string;
  charIndex: number;
  x: number;
  baselineY: number;
  width: number;
  lineIndex: number;
  paragraphIndex: number;
  pageIndex: number;
  fontSize: number;
  renderSize: number;
  capAscent: number;
  xAscent: number;
}

/** One visual line (wrapped segment or blank paragraph) with its text-offset range. */
export interface PlacedLine {
  /** Text offset of the first character on this line */
  start: number;
  /** Text offset just past the last character on this line */
  end: number;
  /** Left edge x of the line (alignment-aware) */
  x: number;
  baselineY: number;
  pageIndex: number;
  lineIndex: number;
  /** Row height for ruled lines and hit-testing */
  lineSpacing: number;
  /** Tallest cap ascent on this line (for ruled-line drawing) */
  capAscent: number;
  /** Tallest x-height ascent on this line (for ruled-line drawing) */
  xAscent: number;
  /** Whether this line contains characters */
  hasText: boolean;
}

export interface WorksheetTextLayout {
  chars: PlacedChar[];
  lines: PlacedLine[];
  metrics: RuledFontMetrics;
  renderSize: number;
  ruledHeight: number;
  lineHeight: number;
  margin: number;
  fontFamily: string;
}

interface LogicalChar {
  char: string;
  charIndex: number;
  width: number;
  /** Horizontal step to the next character origin (may be tighter than width when touching). */
  advance: number;
  fontSize: number;
  renderSize: number;
  capAscent: number;
  xAscent: number;
  lineHeight: number;
}

function isConnectableLetter(char: string): boolean {
  return /[A-Za-z\u00C0-\u024F]/.test(char);
}

function shouldTouchLetters(
  prevChar: string,
  nextChar: string,
  prevIndex: number,
  nextIndex: number,
  getCharLettersTouching?: (charIndex: number) => boolean
): boolean {
  if (!getCharLettersTouching) return false;
  if (!isConnectableLetter(prevChar) || !isConnectableLetter(nextChar)) return false;
  return getCharLettersTouching(prevIndex) && getCharLettersTouching(nextIndex);
}

interface LogicalLine {
  start: number;
  end: number;
  hasText: boolean;
  contentSpacing: number;
  capAscent: number;
  xAscent: number;
  lineWidth: number;
  paragraphIndex: number;
  paragraphAlign: 'left' | 'center' | 'right';
  lineChars: LogicalChar[];
}

function wrapParagraph(
  paragraph: string,
  paragraphStart: number,
  ctx: CanvasRenderingContext2D,
  availableWidth: number,
  fontFamily: string,
  getCharFontSize: (charIndex: number) => number,
  metricsCache: Map<number, RuledFontMetrics>,
  getCharLettersTouching?: (charIndex: number) => boolean
): string[] {
  const lines: string[] = [];
  let currentLine = '';
  let lineStartOffset = paragraphStart;

  const measureSegment = (segment: string, startOffset: number) => {
    if (segment.length === 0) return 0;

    let originX = 0;
    let prevBounds: GlyphInkExtents | null = null;
    let prevRenderSize = 0;
    let prevChar = '';
    let prevIndex = -1;
    let lastWidth = 0;

    for (let index = 0; index < segment.length; index += 1) {
      const charIndex = startOffset + index;
      const char = segment[index];
      const charMetrics = getMetricsForSize(fontFamily, getCharFontSize(charIndex), metricsCache);
      const renderSize = charMetrics.renderFontSize;
      const bounds = measureGlyphInkExtents(ctx, char, fontFamily, renderSize);

      if (index > 0 && prevBounds) {
        if (shouldTouchLetters(prevChar, char, prevIndex, charIndex, getCharLettersTouching)) {
          originX += touchingLetterAdvance(prevBounds, bounds, prevRenderSize);
        } else {
          originX += prevBounds.width;
        }
      }

      lastWidth = bounds.width;
      prevBounds = bounds;
      prevRenderSize = renderSize;
      prevChar = char;
      prevIndex = charIndex;
    }

    return originX + lastWidth;
  };

  for (let index = 0; index < paragraph.length; index += 1) {
    const char = paragraph[index];
    const candidate = currentLine + char;
    const measureStart = currentLine ? lineStartOffset : paragraphStart + index;
    const candidateWidth = measureSegment(candidate, measureStart);

    if (candidateWidth <= availableWidth || currentLine === '') {
      if (!currentLine) {
        lineStartOffset = paragraphStart + index;
      }
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = char;
    lineStartOffset = paragraphStart + index;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function getMetricsForSize(
  fontFamily: string,
  fontSize: number,
  cache: Map<number, RuledFontMetrics>
): RuledFontMetrics {
  let metrics = cache.get(fontSize);
  if (!metrics) {
    metrics = measureRuledFont(fontFamily, fontSize);
    cache.set(fontSize, metrics);
  }
  return metrics;
}

function alignedLineX(
  lineWidth: number,
  startX: number,
  availableWidth: number,
  textAlign: 'left' | 'center' | 'right'
): number {
  if (textAlign === 'center') {
    return startX + (availableWidth - lineWidth) / 2;
  }
  if (textAlign === 'right') {
    return startX + availableWidth - lineWidth;
  }
  return startX;
}

/**
 * Place a line baseline so its ruled cap line does not cross above the previous
 * line's baseline. Large letters on the current row need this clearance.
 */
function resolveLineBaseline(
  cursorY: number,
  lineCapAscent: number,
  startPageIndex: number,
  margin: number,
  ruledHeight: number,
  previousBaseline: number | null
): { baselineY: number; pageIndex: number } {
  const pageTop = (page: number) => page * PAGE_HEIGHT;
  const maxBaselineForPage = (page: number) => pageTop(page) + PAGE_HEIGHT - margin;
  const firstBaselineForPage = (page: number) => pageTop(page) + margin + ruledHeight;

  let page = startPageIndex;
  let minY = pageTop(page) + margin + lineCapAscent;
  if (previousBaseline !== null && previousBaseline >= pageTop(page)) {
    minY = Math.max(minY, previousBaseline + lineCapAscent);
  }

  let y = Math.max(cursorY, minY);
  while (y > maxBaselineForPage(page)) {
    page += 1;
    y = firstBaselineForPage(page);
    minY = pageTop(page) + margin + lineCapAscent;
    y = Math.max(y, minY);
  }

  return { baselineY: y, pageIndex: page };
}

function textRowSpacing(contentSpacing: number, defaultLineHeight: number): number {
  return Math.max(contentSpacing, defaultLineHeight);
}

/** Walk back to the nearest line with text and return its row spacing. */
function inheritedSpacingFrom(
  logicalLines: LogicalLine[],
  fromIndex: number,
  defaultLineHeight: number
): number {
  for (let index = fromIndex; index >= 0; index -= 1) {
    const line = logicalLines[index];
    if (line.hasText) {
      return textRowSpacing(line.contentSpacing, defaultLineHeight);
    }
  }
  return defaultLineHeight;
}

/** Walk back to the nearest line with text and return its ruled metrics. */
function inheritedMetricsFrom(
  logicalLines: LogicalLine[],
  fromIndex: number,
  defaultMetrics: RuledFontMetrics,
  defaultLineHeight: number
): { lineSpacing: number; capAscent: number; xAscent: number } {
  for (let index = fromIndex; index >= 0; index -= 1) {
    const line = logicalLines[index];
    if (line.hasText) {
      return {
        lineSpacing: textRowSpacing(line.contentSpacing, defaultLineHeight),
        capAscent: line.capAscent,
        xAscent: line.xAscent,
      };
    }
  }
  return {
    lineSpacing: defaultLineHeight,
    capAscent: defaultMetrics.capAscent,
    xAscent: defaultMetrics.xAscent,
  };
}

function gapToLine(
  logicalLines: LogicalLine[],
  lineIndex: number,
  defaultLineHeight: number
): number {
  const logical = logicalLines[lineIndex];
  if (logical.hasText) {
    return textRowSpacing(logical.contentSpacing, defaultLineHeight);
  }
  return inheritedSpacingFrom(logicalLines, lineIndex - 1, defaultLineHeight);
}

function rowMetricsForLine(
  logicalLines: LogicalLine[],
  lineIndex: number,
  defaultMetrics: RuledFontMetrics,
  defaultLineHeight: number
): { lineSpacing: number; capAscent: number; xAscent: number } {
  const logical = logicalLines[lineIndex];
  if (logical.hasText) {
    return {
      lineSpacing: textRowSpacing(logical.contentSpacing, defaultLineHeight),
      capAscent: logical.capAscent,
      xAscent: logical.xAscent,
    };
  }
  return inheritedMetricsFrom(logicalLines, lineIndex - 1, defaultMetrics, defaultLineHeight);
}

function collectLogicalLines(
  ctx: CanvasRenderingContext2D,
  options: {
    text: string;
    fontSize: number;
    fontFamily: string;
    maxWidth: number;
    textAlign: 'left' | 'center' | 'right';
    margin: number;
    metrics: RuledFontMetrics;
    resolveFontSize: (charIndex: number) => number;
    resolveCharAlign: (charIndex: number) => 'left' | 'center' | 'right';
    metricsCache: Map<number, RuledFontMetrics>;
    getCharLettersTouching?: (charIndex: number) => boolean;
  }
): LogicalLine[] {
  const {
    text,
    fontSize,
    fontFamily,
    maxWidth,
    textAlign,
    margin,
    metrics,
    resolveFontSize,
    resolveCharAlign,
    metricsCache,
    getCharLettersTouching,
  } = options;

  const availableWidth = Math.max(maxWidth - margin * 2, 100);
  const paragraphs = text.split('\n');
  const logicalLines: LogicalLine[] = [];
  let paragraphStart = 0;

  for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex += 1) {
    const paragraph = paragraphs[paragraphIndex];
    const paragraphAlign = resolveCharAlign(paragraphStart);

    if (paragraph === '') {
      logicalLines.push({
        start: paragraphStart,
        end: paragraphStart,
        hasText: false,
        contentSpacing: 0,
        capAscent: 0,
        xAscent: 0,
        lineWidth: 0,
        paragraphIndex,
        paragraphAlign,
        lineChars: [],
      });
      paragraphStart += 1;
      continue;
    }

    const wrappedLines = wrapParagraph(
      paragraph,
      paragraphStart,
      ctx,
      availableWidth,
      fontFamily,
      resolveFontSize,
      metricsCache,
      getCharLettersTouching
    );
    let consumed = 0;

    for (const line of wrappedLines) {
      let lineWidth = 0;
      let contentSpacing = 0;
      let capAscent = 0;
      let xAscent = 0;
      const lineChars: LogicalChar[] = [];
      let prevBounds: GlyphInkExtents | null = null;
      let prevRenderSize = 0;

      for (let lineCharIndex = 0; lineCharIndex < line.length; lineCharIndex += 1) {
        const char = line[lineCharIndex];
        const charIndex = paragraphStart + consumed;
        const charMetrics = getMetricsForSize(fontFamily, resolveFontSize(charIndex), metricsCache);
        const renderSize = charMetrics.renderFontSize;
        const bounds = measureGlyphInkExtents(ctx, char, fontFamily, renderSize);
        const charWidth = bounds.width;

        // Advance is finalized when we know the next char; default to full width.
        let advance = charWidth;
        if (lineCharIndex > 0 && prevBounds) {
          const prev = lineChars[lineCharIndex - 1];
          if (
            shouldTouchLetters(
              prev.char,
              char,
              prev.charIndex,
              charIndex,
              getCharLettersTouching
            )
          ) {
            prev.advance = touchingLetterAdvance(prevBounds, bounds, prevRenderSize);
          }
        }

        lineChars.push({
          char,
          charIndex,
          width: charWidth,
          advance,
          fontSize: resolveFontSize(charIndex),
          renderSize,
          capAscent: charMetrics.capAscent,
          xAscent: charMetrics.xAscent,
          lineHeight: charMetrics.lineHeight,
        });
        contentSpacing = Math.max(contentSpacing, charMetrics.lineHeight);
        capAscent = Math.max(capAscent, charMetrics.capAscent);
        xAscent = Math.max(xAscent, charMetrics.xAscent);
        prevBounds = bounds;
        prevRenderSize = renderSize;
        consumed += 1;
      }

      if (lineChars.length > 0) {
        let originX = 0;
        for (let i = 0; i < lineChars.length - 1; i += 1) {
          originX += lineChars[i].advance;
        }
        lineWidth = originX + lineChars[lineChars.length - 1].width;
      }

      const lineStartOffset = paragraphStart + consumed - line.length;
      logicalLines.push({
        start: lineStartOffset,
        end: paragraphStart + consumed,
        hasText: true,
        contentSpacing,
        capAscent: capAscent > 0 ? capAscent : metrics.capAscent,
        xAscent: xAscent > 0 ? xAscent : metrics.xAscent,
        lineWidth,
        paragraphIndex,
        paragraphAlign,
        lineChars,
      });
    }

    paragraphStart += paragraph.length + 1;
  }

  return logicalLines;
}

/** Single source of truth for worksheet text positions — shared by canvas + cursive links */
export function layoutWorksheetText(
  ctx: CanvasRenderingContext2D,
  options: WorksheetTextOptions
): WorksheetTextLayout {
  const {
    text,
    fontSize,
    font,
    maxWidth,
    textAlign,
    margin = PAGE_MARGIN,
    fontMetrics: providedMetrics,
    getCharFontSize,
    getCharAlign,
    getCharLettersTouching,
  } = options;

  const fontFamily = font || 'Playwrite US Modern';
  const metrics = providedMetrics ?? measureRuledFont(fontFamily, fontSize);
  const renderSize = metrics.renderFontSize;
  const ruledHeight = metrics.ruledHeight;
  const lineHeight = metrics.lineHeight;
  const resolveFontSize = getCharFontSize ?? (() => fontSize);
  const resolveCharAlign = getCharAlign ?? (() => textAlign);
  const metricsCache = new Map<number, RuledFontMetrics>([[fontSize, metrics]]);

  ctx.textBaseline = 'alphabetic';

  const startX = margin;
  const logicalLines = collectLogicalLines(ctx, {
    text,
    fontSize,
    fontFamily,
    maxWidth,
    textAlign,
    margin,
    metrics,
    resolveFontSize,
    resolveCharAlign,
    metricsCache,
    getCharLettersTouching,
  });

  const chars: PlacedChar[] = [];
  const placedLines: PlacedLine[] = [];
  let pageIndex = 0;
  let baselineY = margin + ruledHeight;
  let previousLineBaseline: number | null = null;

  const maxBaselineForPage = (currentPageIndex: number) =>
    currentPageIndex * PAGE_HEIGHT + PAGE_HEIGHT - margin;
  const firstBaselineForPage = (currentPageIndex: number) =>
    currentPageIndex * PAGE_HEIGHT + margin + ruledHeight;
  const ensurePageCapacity = () => {
    if (baselineY <= maxBaselineForPage(pageIndex)) {
      return;
    }
    pageIndex += 1;
    baselineY = firstBaselineForPage(pageIndex);
    previousLineBaseline = null;
  };

  for (let lineIndex = 0; lineIndex < logicalLines.length; lineIndex += 1) {
    const logical = logicalLines[lineIndex];
    const rowMetrics = rowMetricsForLine(logicalLines, lineIndex, metrics, lineHeight);
    const lineCapAscent = rowMetrics.capAscent;

    ensurePageCapacity();

    if (lineIndex > 0) {
      const gap = gapToLine(logicalLines, lineIndex, lineHeight);
      const resolved = resolveLineBaseline(
        baselineY + gap,
        lineCapAscent,
        pageIndex,
        margin,
        ruledHeight,
        previousLineBaseline
      );
      baselineY = resolved.baselineY;
      pageIndex = resolved.pageIndex;
    } else {
      const resolved = resolveLineBaseline(
        baselineY,
        lineCapAscent,
        pageIndex,
        margin,
        ruledHeight,
        previousLineBaseline
      );
      baselineY = resolved.baselineY;
      pageIndex = resolved.pageIndex;
    }

    const lineX = alignedLineX(
      logical.lineWidth,
      startX,
      Math.max(maxWidth - margin * 2, 100),
      logical.paragraphAlign
    );

    let x = lineX;
    for (const placedChar of logical.lineChars) {
      chars.push({
        char: placedChar.char,
        charIndex: placedChar.charIndex,
        x,
        baselineY,
        width: placedChar.width,
        lineIndex,
        paragraphIndex: logical.paragraphIndex,
        pageIndex,
        fontSize: placedChar.fontSize,
        renderSize: placedChar.renderSize,
        capAscent: placedChar.capAscent,
        xAscent: placedChar.xAscent,
      });
      x += placedChar.advance;
    }

    placedLines.push({
      start: logical.start,
      end: logical.end,
      x: lineX,
      baselineY,
      pageIndex,
      lineIndex,
      lineSpacing: rowMetrics.lineSpacing,
      capAscent: rowMetrics.capAscent,
      xAscent: rowMetrics.xAscent,
      hasText: logical.hasText,
    });

    previousLineBaseline = baselineY;
    ensurePageCapacity();
  }

  return {
    chars,
    lines: placedLines,
    metrics,
    renderSize,
    ruledHeight,
    lineHeight,
    margin,
    fontFamily,
  };
}

export function createLayoutContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  return document.createElement('canvas').getContext('2d');
}

export function measureWorksheetLayout(options: WorksheetTextOptions): WorksheetTextLayout | null {
  const ctx = createLayoutContext();
  if (!ctx) return null;
  return layoutWorksheetText(ctx, options);
}

export interface CaretPosition {
  x: number;
  baselineY: number;
}

export function lineSpacingForIndex(
  layout: WorksheetTextLayout,
  lineIndex: number
): number {
  const line = layout.lines.find((entry) => entry.lineIndex === lineIndex);
  return line?.lineSpacing ?? layout.lineHeight;
}

/** Index into layout.lines of the visual line containing the given text offset. */
export function lineIndexForOffset(layout: WorksheetTextLayout, offset: number): number {
  const { lines } = layout;
  if (lines.length === 0) return 0;

  for (let index = 0; index < lines.length; index += 1) {
    if (offset <= lines[index].end) {
      return index;
    }
  }

  return lines.length - 1;
}

/** Caret position for any plain-text offset, computed from an existing layout. */
export function caretPositionFromLayout(
  layout: WorksheetTextLayout,
  offset: number
): CaretPosition {
  const { lines, chars, margin, metrics } = layout;
  const firstBaseline = margin + metrics.ruledHeight;

  if (lines.length === 0) {
    return { x: margin, baselineY: firstBaseline };
  }

  const lineIdx = lineIndexForOffset(layout, offset);
  const line = lines[lineIdx];
  const clamped = Math.max(line.start, Math.min(offset, line.end));
  const lineChars = chars
    .filter(
      (char) =>
        char.lineIndex === line.lineIndex &&
        char.charIndex >= line.start &&
        char.charIndex < line.end
    )
    .sort((a, b) => a.charIndex - b.charIndex);

  if (clamped >= line.end) {
    const lastChar = lineChars[lineChars.length - 1];
    if (lastChar) {
      return { x: lastChar.x + lastChar.width, baselineY: line.baselineY };
    }
    return { x: line.x, baselineY: line.baselineY };
  }

  const atChar = lineChars.find((char) => char.charIndex === clamped);
  if (atChar) {
    return { x: atChar.x, baselineY: line.baselineY };
  }

  const previousChar = [...lineChars].reverse().find((char) => char.charIndex < clamped);
  if (previousChar) {
    return { x: previousChar.x + previousChar.width, baselineY: line.baselineY };
  }

  return { x: line.x, baselineY: line.baselineY };
}

/**
 * Find the layout line at a page-local y. Uses cap-ascent bands so clicks on the
 * upper half of a row (e.g. just before the first letter) stay on that line.
 */
export function lineForLocalPageY(
  lines: PlacedLine[],
  localPageY: number,
  pageIndex: number,
  fallbackCapAscent: number
): PlacedLine | null {
  if (lines.length === 0) return null;

  const sorted = [...lines].sort((a, b) => a.baselineY - b.baselineY);

  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const line = sorted[index];
    const capAscent = line.capAscent > 0 ? line.capAscent : fallbackCapAscent;
    const localBaseline = line.baselineY - pageIndex * PAGE_HEIGHT;
    if (localPageY >= localBaseline - capAscent) {
      return line;
    }
  }

  return sorted[0];
}

/** Pick the text offset on a line whose caret x is nearest to a click x. */
export function closestOffsetOnLine(
  layout: WorksheetTextLayout,
  line: PlacedLine,
  clickX: number
): number {
  if (line.hasText) {
    const firstChar = layout.chars
      .filter((char) => char.lineIndex === line.lineIndex)
      .sort((a, b) => a.charIndex - b.charIndex)[0];

    if (firstChar) {
      const firstCaretX = caretPositionFromLayout(layout, firstChar.charIndex).x;
      if (clickX <= firstCaretX) {
        return line.start;
      }
    }
  }

  const offsets = new Set<number>([line.start, line.end]);

  for (const char of layout.chars) {
    if (char.lineIndex !== line.lineIndex) continue;
    offsets.add(char.charIndex);
    offsets.add(char.charIndex + 1);
  }

  let bestOffset = line.start;
  let bestDistance = Infinity;

  for (const offset of offsets) {
    const position = caretPositionFromLayout(layout, offset);
    const distance = Math.abs(position.x - clickX);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestOffset = offset;
    }
  }

  return bestOffset;
}

/** Caret position for any plain-text offset, matching layoutWorksheetText exactly. */
export function getCaretPositionForOffset(
  text: string,
  offset: number,
  options: WorksheetTextOptions
): CaretPosition | null {
  const normalized = text.replace(/\r\n/g, '\n');
  const layout = measureWorksheetLayout({ ...options, text: normalized });
  if (!layout) return null;

  const clamped = Math.max(0, Math.min(offset, normalized.length));
  return caretPositionFromLayout(layout, clamped);
}
