import { formatCanvasFont, measureRuledFont } from '@/lib/font-metrics';
import { LetterBox } from '@/lib/types';
import { WorksheetTextOptions } from '@/lib/text-line-layout';
import { layoutWorksheetText, measureWorksheetLayout } from '@/lib/text-line-layout';

/** Anchor offsets relative to the glyph pen origin (draw x, baseline y). */
interface GlyphInkAnchors {
  entry: { dx: number; dy: number } | null;
  exit: { dx: number; dy: number } | null;
}

const glyphAnchorCache = new Map<string, GlyphInkAnchors>();
const NO_ANCHORS: GlyphInkAnchors = { entry: null, exit: null };

/**
 * Finds where the glyph's actual ink is nearest the top-center and
 * bottom-center, so connectors land on the letter instead of floating in the
 * empty parts of open letters (Y, M, R, ...).
 */
function measureGlyphInkAnchors(
  char: string,
  fontFamily: string,
  renderSize: number
): GlyphInkAnchors {
  if (typeof document === 'undefined') return NO_ANCHORS;

  const scale = renderSize < 32 ? 3 : renderSize < 48 ? 2 : 1;
  const key = `${fontFamily}|${renderSize}|${scale}|${char}`;
  const cached = glyphAnchorCache.get(key);
  if (cached) return cached;

  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) return NO_ANCHORS;
  probe.font = formatCanvasFont(fontFamily, renderSize * scale);
  probe.textBaseline = 'alphabetic';
  const metrics = probe.measureText(char);
  const left = metrics.actualBoundingBoxLeft ?? 0;
  const right = metrics.actualBoundingBoxRight ?? metrics.width;
  const ascent = metrics.actualBoundingBoxAscent ?? renderSize * scale * 0.72;
  const descent = metrics.actualBoundingBoxDescent ?? renderSize * scale * 0.2;
  const pad = 4 * scale;
  const width = Math.ceil(left + right + pad * 2);
  const height = Math.ceil(ascent + descent + pad * 2);
  if (width <= 0 || height <= 0) return NO_ANCHORS;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return NO_ANCHORS;

  ctx.font = formatCanvasFont(fontFamily, renderSize * scale);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';
  const originX = pad + left;
  const originY = pad + ascent;
  ctx.fillText(char, originX, originY);

  const data = ctx.getImageData(0, 0, width, height).data;
  const isInk = (px: number, py: number) => data[(py * width + px) * 4 + 3] > 100;

  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      if (!isInk(px, py)) continue;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
  }

  if (maxY < 0) {
    glyphAnchorCache.set(key, NO_ANCHORS);
    return NO_ANCHORS;
  }

  const band = Math.max(2, (maxY - minY) * 0.15);

  // Silhouette profiles: for each column, the topmost and bottommost ink
  // pixel. Anchors are only ever placed on these outer edges, never on the
  // side of a stroke inside the glyph.
  const topProfile = new Array<number>(maxX - minX + 1).fill(-1);
  const bottomProfile = new Array<number>(maxX - minX + 1).fill(-1);
  for (let px = minX; px <= maxX; px += 1) {
    for (let py = minY; py <= maxY; py += 1) {
      if (!isInk(px, py)) continue;
      if (topProfile[px - minX] === -1) topProfile[px - minX] = py;
      bottomProfile[px - minX] = py;
    }
  }

  // Cursive joins leave a letter at its lower-right and enter the next letter
  // at its upper-left. Among columns whose silhouette reaches the band near
  // the glyph's top (or bottom), score each candidate on both axes: staying
  // close to the true top/bottom is weighted double, drifting left (entry) or
  // right (exit) breaks ties. Corner letters (K, M, Y) resolve to their exact
  // tips; round letters (C, S, O) land on the lower-right / upper-left of the
  // curve instead of sliding onto its side.
  const VERTICAL_WEIGHT = 2;

  const silhouetteAnchor = (
    profile: number[],
    qualifies: (y: number) => boolean,
    prefer: 'leftmost' | 'rightmost'
  ): { x: number; y: number } | null => {
    let best: { x: number; y: number } | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let column = 0; column < profile.length; column += 1) {
      const y = profile[column];
      if (y === -1 || !qualifies(y)) continue;
      const x = column + minX;
      const horizontalCost = prefer === 'leftmost' ? x - minX : maxX - x;
      const verticalCost = prefer === 'leftmost' ? y - minY : maxY - y;
      const score = horizontalCost + VERTICAL_WEIGHT * verticalCost;
      if (score < bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }

    return best;
  };

  const entryPixel = silhouetteAnchor(topProfile, (y) => y <= minY + band, 'leftmost');
  const exitPixel = silhouetteAnchor(bottomProfile, (y) => y >= maxY - band, 'rightmost');

  const toOffset = (pixel: { x: number; y: number } | null) =>
    pixel
      ? { dx: (pixel.x - originX) / scale, dy: (pixel.y - originY) / scale }
      : null;

  const anchors: GlyphInkAnchors = {
    entry: toOffset(entryPixel),
    exit: toOffset(exitPixel),
  };
  glyphAnchorCache.set(key, anchors);
  return anchors;
}

function measureLetterBox(
  ctx: CanvasRenderingContext2D,
  char: string,
  x: number,
  baselineY: number,
  charIndex: number,
  lineIndex: number,
  paragraphIndex: number,
  width: number,
  pageIndex: number,
  fontFamily: string,
  renderSize: number
): LetterBox {
  const metrics = ctx.measureText(char);
  const ascent = metrics.actualBoundingBoxAscent || width * 0.8;
  const descent = metrics.actualBoundingBoxDescent || width * 0.2;
  const top = baselineY - ascent;
  const bottom = baselineY + descent;

  const inkAnchors = isConnectableLetter(char)
    ? measureGlyphInkAnchors(char, fontFamily, renderSize)
    : NO_ANCHORS;

  return {
    charIndex,
    char,
    x,
    baselineY,
    width,
    ascent,
    descent,
    top,
    bottom,
    centerX: x + width / 2,
    lineIndex,
    paragraphIndex,
    pageIndex,
    entryAnchor: inkAnchors.entry
      ? { x: x + inkAnchors.entry.dx, y: baselineY + inkAnchors.entry.dy }
      : undefined,
    exitAnchor: inkAnchors.exit
      ? { x: x + inkAnchors.exit.dx, y: baselineY + inkAnchors.exit.dy }
      : undefined,
  };
}

export function getExitAnchor(box: LetterBox): { x: number; y: number } {
  return box.exitAnchor ?? { x: box.centerX, y: box.bottom };
}

export function getEntryAnchor(box: LetterBox): { x: number; y: number } {
  return box.entryAnchor ?? { x: box.centerX, y: box.top };
}

export function isConnectableLetter(char: string): boolean {
  return /[A-Za-z\u00C0-\u024F]/.test(char);
}

export function computeLetterLayout(
  ctx: CanvasRenderingContext2D,
  options: WorksheetTextOptions
): LetterBox[] {
  const layout = layoutWorksheetText(ctx, options);

  return layout.chars.map((placed) =>
    measureLetterBox(
      ctx,
      placed.char,
      placed.x,
      placed.baselineY,
      placed.charIndex,
      placed.lineIndex,
      placed.paragraphIndex,
      placed.width,
      placed.pageIndex,
      layout.fontFamily,
      placed.renderSize
    )
  );
}

export function measureLetterLayout(options: WorksheetTextOptions): LetterBox[] {
  const layout = measureWorksheetLayout(options);
  if (!layout) return [];

  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return [];

  const fontFamily = options.font || 'Playwrite US Modern';
  const defaultMetrics = options.fontMetrics ?? measureRuledFont(fontFamily, options.fontSize);
  ctx.textBaseline = 'alphabetic';

  return layout.chars.map((placed) => {
    ctx.font = formatCanvasFont(fontFamily, placed.renderSize);
    return measureLetterBox(
      ctx,
      placed.char,
      placed.x,
      placed.baselineY,
      placed.charIndex,
      placed.lineIndex,
      placed.paragraphIndex,
      placed.width,
      placed.pageIndex,
      fontFamily,
      placed.renderSize
    );
  });
}
