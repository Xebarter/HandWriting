import { PAGE_HEIGHT, PAGE_MARGIN } from '@/lib/document-constants';
import { formatCanvasFont, measureRuledFont, RuledFontMetrics } from '@/lib/font-metrics';
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

function wrapParagraph(
  paragraph: string,
  paragraphStart: number,
  ctx: CanvasRenderingContext2D,
  availableWidth: number,
  fontFamily: string,
  getCharFontSize: (charIndex: number) => number,
  metricsCache: Map<number, RuledFontMetrics>
): string[] {
  const words = paragraph.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  let lineStartOffset = paragraphStart;

  const measureSegment = (segment: string, startOffset: number) => {
    let width = 0;
    for (let index = 0; index < segment.length; index += 1) {
      const charIndex = startOffset + index;
      const metrics = getMetricsForSize(fontFamily, getCharFontSize(charIndex), metricsCache);
      ctx.font = formatCanvasFont(fontFamily, metrics.renderFontSize);
      width += ctx.measureText(segment[index]).width;
    }
    return width;
  };

  for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
    let wordStart = paragraphStart;
    for (let index = 0; index < wordIndex; index += 1) {
      wordStart += words[index].length + 1;
    }

    const word = words[wordIndex];
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const measureStart = currentLine ? lineStartOffset : wordStart;
    const candidateWidth = measureSegment(candidate, measureStart);

    if (candidateWidth <= availableWidth || currentLine === '') {
      if (!currentLine) lineStartOffset = wordStart;
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
      lineStartOffset = wordStart;
    }
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
  } = options;

  const fontFamily = font || 'Playwrite US Modern';
  const metrics = providedMetrics ?? measureRuledFont(fontFamily, fontSize);
  const renderSize = metrics.renderFontSize;
  const ruledHeight = metrics.ruledHeight;
  const lineHeight = metrics.lineHeight;
  const resolveFontSize = getCharFontSize ?? (() => fontSize);
  const metricsCache = new Map<number, RuledFontMetrics>([[fontSize, metrics]]);

  ctx.textBaseline = 'alphabetic';

  const startX = margin;
  let pageIndex = 0;
  let baselineY = margin + ruledHeight;
  const availableWidth = Math.max(maxWidth - margin * 2, 100);
  const paragraphs = text.split('\n');
  const chars: PlacedChar[] = [];
  const placedLines: PlacedLine[] = [];
  let paragraphStart = 0;
  let lineIndex = 0;

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
  };

  for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex++) {
    const paragraph = paragraphs[paragraphIndex];

    if (paragraph === '') {
      ensurePageCapacity();
      placedLines.push({
        start: paragraphStart,
        end: paragraphStart,
        x: alignedLineX(0, startX, availableWidth, textAlign),
        baselineY,
        pageIndex,
        lineIndex,
      });
      baselineY += lineHeight;
      ensurePageCapacity();
      lineIndex += 1;
      paragraphStart += 1;
      continue;
    }

    const lines = wrapParagraph(
      paragraph,
      paragraphStart,
      ctx,
      availableWidth,
      fontFamily,
      resolveFontSize,
      metricsCache
    );
    let consumed = 0;

    for (let wrapIndex = 0; wrapIndex < lines.length; wrapIndex += 1) {
      const line = lines[wrapIndex];
      ensurePageCapacity();

      let lineWidth = 0;
      let lineMaxHeight = lineHeight;
      const lineChars: Array<{
        char: string;
        charIndex: number;
        width: number;
        fontSize: number;
        renderSize: number;
        capAscent: number;
        xAscent: number;
      }> = [];

      for (const char of line) {
        const charIndex = paragraphStart + consumed;
        const charMetrics = getMetricsForSize(fontFamily, resolveFontSize(charIndex), metricsCache);
        ctx.font = formatCanvasFont(fontFamily, charMetrics.renderFontSize);
        const charWidth = ctx.measureText(char).width;
        lineChars.push({
          char,
          charIndex,
          width: charWidth,
          fontSize: resolveFontSize(charIndex),
          renderSize: charMetrics.renderFontSize,
          capAscent: charMetrics.capAscent,
          xAscent: charMetrics.xAscent,
        });
        lineWidth += charWidth;
        lineMaxHeight = Math.max(lineMaxHeight, charMetrics.lineHeight);
        consumed += 1;
      }

      let x = alignedLineX(lineWidth, startX, availableWidth, textAlign);
      const lineX = x;
      const lineStartOffset = paragraphStart + consumed - line.length;

      for (const placedChar of lineChars) {
        chars.push({
          char: placedChar.char,
          charIndex: placedChar.charIndex,
          x,
          baselineY,
          width: placedChar.width,
          lineIndex,
          paragraphIndex,
          pageIndex,
          fontSize: placedChar.fontSize,
          renderSize: placedChar.renderSize,
          capAscent: placedChar.capAscent,
          xAscent: placedChar.xAscent,
        });
        x += placedChar.width;
      }

      placedLines.push({
        start: lineStartOffset,
        end: paragraphStart + consumed,
        x: lineX,
        baselineY,
        pageIndex,
        lineIndex,
      });

      baselineY += lineMaxHeight;
      ensurePageCapacity();
      lineIndex += 1;

      // The space at a wrap point is dropped from the rendered line but still
      // occupies one offset in the source text.
      if (wrapIndex < lines.length - 1) {
        consumed += 1;
      }
    }

    paragraphStart += paragraph.length + 1;
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

  if (clamped >= line.end) {
    const lastChar = [...chars]
      .reverse()
      .find((char) => char.lineIndex === line.lineIndex && char.charIndex < line.end);
    if (lastChar) {
      return { x: lastChar.x + lastChar.width, baselineY: line.baselineY };
    }
    return { x: line.x, baselineY: line.baselineY };
  }

  const atChar = chars.find((char) => char.charIndex === clamped);
  if (atChar) {
    return { x: atChar.x, baselineY: atChar.baselineY };
  }

  return { x: line.x, baselineY: line.baselineY };
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
