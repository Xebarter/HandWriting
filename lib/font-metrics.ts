import { PAGE_MARGIN } from '@/lib/document-constants';
import { getLineHeight } from './text-layout';

export interface RuledFontMetrics {
  /** CSS/canvas font size scaled so capitals fill the ruled row height */
  renderFontSize: number;
  /** Distance from baseline to top of capital letters */
  capAscent: number;
  /** Distance from baseline to top of lowercase "x" */
  xAscent: number;
  /** Ruled row height (top line → baseline) */
  ruledHeight: number;
  /** Distance between baselines */
  lineHeight: number;
  /** Editor padding-top to align first baseline with ruled lines */
  editorPaddingTop: number;
}

/** Round px values so SSR/client style strings stay stable */
export function roundPx(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatFamily(fontFamily: string): string {
  return `"${fontFamily}", cursive`;
}

/** Wait until a font family is available for measurement */
export async function waitForFontMeasure(fontFamily: string, size = 48): Promise<void> {
  if (typeof document === 'undefined') return;
  try {
    await document.fonts.load(`${size}px ${formatFamily(fontFamily)}`);
    await document.fonts.ready;
  } catch {
    // Continue with fallback metrics
  }
}

function createMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  return canvas.getContext('2d');
}

function measureCapAscent(
  ctx: CanvasRenderingContext2D,
  fontFamily: string,
  size: number
): number {
  ctx.font = `${size}px ${formatFamily(fontFamily)}`;
  const sample = ctx.measureText('H');
  return sample.actualBoundingBoxAscent || size * 0.72;
}

/**
 * Scale font size so capital "H" ascent equals the ruled row height.
 */
function computeRenderFontSize(
  ctx: CanvasRenderingContext2D,
  fontFamily: string,
  ruledHeight: number,
  sampleSize = 48
): number {
  const capAscentBase = measureCapAscent(ctx, fontFamily, sampleSize);
  if (capAscentBase <= 0) return ruledHeight * 1.35;

  let renderFontSize = sampleSize * (ruledHeight / capAscentBase);
  ctx.font = `${renderFontSize}px ${formatFamily(fontFamily)}`;

  let ascent = measureCapAscent(ctx, fontFamily, renderFontSize);
  if (ascent > 0 && Math.abs(ascent - ruledHeight) > 0.25) {
    renderFontSize *= ruledHeight / ascent;
  }

  return renderFontSize;
}

/**
 * Measure where the first line's cap-top and baseline fall inside a line box,
 * matching the editor's font-size and line-height.
 */
function measureEditorLineOffsets(
  fontFamily: string,
  renderFontSize: number,
  lineHeight: number
): { capTop: number; baseline: number } {
  if (typeof document === 'undefined') {
    const fallbackAscent = renderFontSize * 0.72;
    const halfLeading = (lineHeight - renderFontSize) / 2;
    return {
      capTop: halfLeading,
      baseline: halfLeading + fallbackAscent,
    };
  }

  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    'visibility:hidden',
    'margin:0',
    'padding:0',
    'border:0',
    `font-size:${renderFontSize}px`,
    `font-family:${formatFamily(fontFamily)}`,
    `line-height:${lineHeight}px`,
  ].join(';');

  const line = document.createElement('div');
  line.style.margin = '0';
  line.style.padding = '0';
  line.textContent = 'H';
  container.appendChild(line);
  document.body.appendChild(container);

  const containerTop = container.getBoundingClientRect().top;
  const letterTop = line.getBoundingClientRect().top;
  const capTop = letterTop - containerTop;

  const ctx = createMeasureContext();
  const ascent = ctx
    ? measureCapAscent(ctx, fontFamily, renderFontSize)
    : renderFontSize * 0.72;

  document.body.removeChild(container);

  return {
    capTop: roundPx(capTop),
    baseline: roundPx(capTop + ascent),
  };
}

function buildMeasuredMetrics(
  fontFamily: string,
  ruledHeight: number,
  renderFontSize: number,
  capAscent: number,
  xAscent: number,
  lineHeight: number
): RuledFontMetrics {
  const { baseline } = measureEditorLineOffsets(fontFamily, renderFontSize, lineHeight);
  const editorPaddingTop = PAGE_MARGIN + ruledHeight - baseline;

  return {
    renderFontSize: roundPx(renderFontSize),
    capAscent: roundPx(capAscent),
    xAscent: roundPx(xAscent),
    ruledHeight,
    lineHeight: roundPx(lineHeight),
    editorPaddingTop: roundPx(editorPaddingTop),
  };
}

/**
 * Deterministic font metrics for SSR and the first client render (no DOM/canvas).
 */
export function estimateRuledFont(
  _fontFamily: string,
  ruledHeight: number,
  sampleSize = 48
): RuledFontMetrics {
  const lineHeight = getLineHeight(ruledHeight);
  const capAscentBase = sampleSize * 0.72;
  const renderFontSize = sampleSize * (ruledHeight / capAscentBase);
  const capAscent = ruledHeight;
  const xAscent = ruledHeight * 0.5;
  const halfLeading = (lineHeight - renderFontSize) / 2;
  const editorPaddingTop = PAGE_MARGIN + ruledHeight - halfLeading - capAscent;

  return {
    renderFontSize: roundPx(renderFontSize),
    capAscent: roundPx(capAscent),
    xAscent: roundPx(xAscent),
    ruledHeight,
    lineHeight: roundPx(lineHeight),
    editorPaddingTop: roundPx(editorPaddingTop),
  };
}

/**
 * Measure font metrics after the family is loaded (canvas + DOM).
 */
export async function measureRuledFontAsync(
  fontFamily: string,
  ruledHeight: number,
  sampleSize = 48
): Promise<RuledFontMetrics> {
  if (typeof document === 'undefined') {
    return estimateRuledFont(fontFamily, ruledHeight, sampleSize);
  }

  await waitForFontMeasure(fontFamily, sampleSize);

  const ctx = createMeasureContext();
  if (!ctx) return estimateRuledFont(fontFamily, ruledHeight, sampleSize);

  const lineHeight = getLineHeight(ruledHeight);
  const renderFontSize = computeRenderFontSize(ctx, fontFamily, ruledHeight, sampleSize);

  ctx.font = `${renderFontSize}px ${formatFamily(fontFamily)}`;
  const capM = ctx.measureText('H');
  const xM = ctx.measureText('x');
  const capAscent = capM.actualBoundingBoxAscent || ruledHeight;
  const xAscent = xM.actualBoundingBoxAscent || ruledHeight * 0.5;

  return buildMeasuredMetrics(fontFamily, ruledHeight, renderFontSize, capAscent, xAscent, lineHeight);
}

/**
 * Synchronous measure — only accurate if the font is already loaded.
 */
export function measureRuledFont(
  fontFamily: string,
  ruledHeight: number,
  sampleSize = 48
): RuledFontMetrics {
  if (typeof document === 'undefined') {
    return estimateRuledFont(fontFamily, ruledHeight, sampleSize);
  }

  const ctx = createMeasureContext();
  if (!ctx) return estimateRuledFont(fontFamily, ruledHeight, sampleSize);

  const lineHeight = getLineHeight(ruledHeight);
  const renderFontSize = computeRenderFontSize(ctx, fontFamily, ruledHeight, sampleSize);

  ctx.font = `${renderFontSize}px ${formatFamily(fontFamily)}`;
  const capM = ctx.measureText('H');
  const xM = ctx.measureText('x');
  const capAscent = capM.actualBoundingBoxAscent || ruledHeight;
  const xAscent = xM.actualBoundingBoxAscent || ruledHeight * 0.5;

  return buildMeasuredMetrics(fontFamily, ruledHeight, renderFontSize, capAscent, xAscent, lineHeight);
}

export function formatCanvasFont(fontFamily: string, size: number): string {
  return `${size}px ${formatFamily(fontFamily)}`;
}

/** Punctuation that should rest on the ruled baseline, not descend through it. */
const BASELINE_SNAP_CHARS = new Set([
  '|',
  '/',
  '\\',
  '!',
  '?',
  '+',
  '-',
  '=',
  '<',
  '>',
  '[',
  ']',
  '{',
  '}',
]);

/**
 * Adjust draw Y so tall punctuation sits on the ruled baseline instead of
 * crossing it (common with "|" in handwriting fonts).
 */
export function ruledCharDrawY(
  ctx: CanvasRenderingContext2D,
  char: string,
  baselineY: number,
  fontFamily: string,
  renderSize: number
): number {
  if (!BASELINE_SNAP_CHARS.has(char)) return baselineY;

  ctx.font = formatCanvasFont(fontFamily, renderSize);
  ctx.textBaseline = 'alphabetic';
  const descent = ctx.measureText(char).actualBoundingBoxDescent ?? 0;
  return descent > 0.25 ? baselineY - descent : baselineY;
}

/** Dash/centerline width used when drawing letter traces (dotted mode). */
export function letterInkStrokeWidth(renderSize: number): number {
  return Math.max(1.6, renderSize * 0.05);
}

/** Cursive link stroke width — scales gently with letter size, close to letter ink weight. */
export function connectionStrokeWidthForRenderSize(renderSize: number): number {
  return roundPx(Math.max(1.5, letterInkStrokeWidth(renderSize) * 1.05));
}
