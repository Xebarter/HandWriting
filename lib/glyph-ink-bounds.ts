import { formatCanvasFont } from '@/lib/font-metrics';

export interface GlyphInkExtents {
  /** Distance from the pen origin to the leftmost ink pixel. */
  left: number;
  /** Distance from the pen origin to the rightmost ink pixel. */
  right: number;
  /** X of the first-stroke entry tip relative to the pen origin. */
  entryX: number;
  /** X of the last-stroke exit tip relative to the pen origin. */
  exitX: number;
  /** X of the top-right shoulder (for pointed letters like v, w). */
  topExitX: number;
  /** Font advance width (pen step when not touching). */
  width: number;
}

const inkExtentsCache = new Map<string, GlyphInkExtents>();

function cacheKey(fontFamily: string, renderSize: number, char: string): string {
  return `v4|${fontFamily}|${renderSize}|${char}`;
}

const VERTICAL_WEIGHT = 2;

/**
 * Silhouette entry/exit anchors for touching letters.
 */
function measureStrokeTouchPoints(
  char: string,
  fontFamily: string,
  renderSize: number
): { entryX: number; exitX: number; topExitX: number; left: number; right: number } | null {
  if (typeof document === 'undefined') return null;

  const scale = renderSize < 32 ? 3 : renderSize < 48 ? 2 : 1;
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) return null;

  probe.font = formatCanvasFont(fontFamily, renderSize * scale);
  probe.textBaseline = 'alphabetic';
  const metrics = probe.measureText(char);
  const bboxLeft = metrics.actualBoundingBoxLeft ?? 0;
  const bboxRight = metrics.actualBoundingBoxRight ?? metrics.width;
  const ascent = metrics.actualBoundingBoxAscent ?? renderSize * scale * 0.72;
  const descent = metrics.actualBoundingBoxDescent ?? renderSize * scale * 0.2;
  const pad = 4 * scale;
  const canvasWidth = Math.ceil(bboxLeft + bboxRight + pad * 2);
  const canvasHeight = Math.ceil(ascent + descent + pad * 2);
  if (canvasWidth <= 0 || canvasHeight <= 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.font = formatCanvasFont(fontFamily, renderSize * scale);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';
  const originX = pad + bboxLeft;
  const originY = pad + ascent;
  ctx.fillText(char, originX, originY);

  const data = ctx.getImageData(0, 0, canvasWidth, canvasHeight).data;
  const isInk = (px: number, py: number) => data[(py * canvasWidth + px) * 4 + 3] > 100;

  let minX = canvasWidth;
  let maxX = -1;
  let minY = canvasHeight;
  let maxY = -1;
  for (let py = 0; py < canvasHeight; py += 1) {
    for (let px = 0; px < canvasWidth; px += 1) {
      if (!isInk(px, py)) continue;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
  }

  if (maxY < 0) return null;

  const band = Math.max(2, (maxY - minY) * 0.15);
  const topProfile = new Array<number>(maxX - minX + 1).fill(-1);
  const bottomProfile = new Array<number>(maxX - minX + 1).fill(-1);
  for (let px = minX; px <= maxX; px += 1) {
    for (let py = minY; py <= maxY; py += 1) {
      if (!isInk(px, py)) continue;
      if (topProfile[px - minX] === -1) topProfile[px - minX] = py;
      bottomProfile[px - minX] = py;
    }
  }

  const silhouetteAnchor = (
    profile: number[],
    qualifies: (y: number) => boolean,
    prefer: 'leftmost' | 'rightmost'
  ): number | null => {
    let bestX: number | null = null;
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
        bestX = x;
      }
    }

    return bestX;
  };

  const entryPixelX = silhouetteAnchor(topProfile, (y) => y <= minY + band, 'leftmost');
  const topExitPixelX = silhouetteAnchor(topProfile, (y) => y <= minY + band, 'rightmost');
  const exitPixelX = silhouetteAnchor(bottomProfile, (y) => y >= maxY - band, 'rightmost');

  const toX = (pixelX: number | null, fallback: number) =>
    pixelX === null ? fallback : (pixelX - originX) / scale;

  const left = (originX - minX) / scale;
  const right = (maxX - originX) / scale;

  return {
    entryX: toX(entryPixelX, -left),
    exitX: toX(exitPixelX, right),
    topExitX: toX(topExitPixelX, right),
    left,
    right,
  };
}

export function measureGlyphInkExtents(
  ctx: CanvasRenderingContext2D,
  char: string,
  fontFamily: string,
  renderSize: number
): GlyphInkExtents {
  const key = cacheKey(fontFamily, renderSize, char);
  const cached = inkExtentsCache.get(key);
  if (cached) return cached;

  ctx.font = formatCanvasFont(fontFamily, renderSize);
  ctx.textBaseline = 'alphabetic';
  const metrics = ctx.measureText(char);
  const width = metrics.width;

  let left = metrics.actualBoundingBoxLeft ?? 0;
  let right = metrics.actualBoundingBoxRight ?? width;
  let entryX = -left;
  let exitX = right;
  let topExitX = right;

  const touchPoints = measureStrokeTouchPoints(char, fontFamily, renderSize);
  if (touchPoints) {
    left = touchPoints.left;
    right = touchPoints.right;
    entryX = touchPoints.entryX;
    exitX = touchPoints.exitX;
    topExitX = touchPoints.topExitX;
  }

  const extents: GlyphInkExtents = {
    left: Math.max(0, left),
    right: Math.max(0, right),
    entryX,
    exitX,
    topExitX,
    width,
  };
  inkExtentsCache.set(key, extents);
  return extents;
}

/** Pointed letters (v, w) — bottom exit sits inward; we join at the top shoulder instead. */
function isPointedTouchLetter(extents: GlyphInkExtents): boolean {
  return extents.right > 0 && extents.exitX < extents.right * 0.85;
}

/** Outgoing touch X — pointed letters (v, w) exit at the bottom center, not the outer tip. */
function resolveOutgoingTouchX(extents: GlyphInkExtents): number {
  if (extents.right <= 0) return extents.exitX;
  if (isPointedTouchLetter(extents)) {
    return extents.topExitX;
  }
  return extents.exitX;
}

/** Incoming touch X — fall back to the left silhouette edge when the entry tip sits inward. */
function resolveIncomingTouchX(extents: GlyphInkExtents): number {
  if (extents.left <= 0) return extents.entryX;
  if (extents.entryX > -extents.left * 0.85) {
    return -extents.left;
  }
  return extents.entryX;
}

/**
 * Pen step so the previous letter's last stroke tip meets the next letter's
 * first stroke tip — touching, not overlapping.
 */
export function touchingLetterAdvance(
  prev: GlyphInkExtents,
  next: GlyphInkExtents,
  renderSize: number
): number {
  let advance = resolveOutgoingTouchX(prev) - resolveIncomingTouchX(next);

  // Top-shoulder anchors on v/w sit just inside the ink; nudge apart a hairline.
  if (isPointedTouchLetter(prev) || isPointedTouchLetter(next)) {
    advance += Math.min(Math.max(renderSize * 0.012, 1), 2);
  }

  if (advance > 0) {
    return Math.max(advance, renderSize * 0.05);
  }
  return Math.max(prev.right + next.left, renderSize * 0.05);
}
