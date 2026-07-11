import { HandwritingMode } from './types';
import { formatCanvasFont, RuledFontMetrics } from './font-metrics';
import { drawLetterGuideLines, ruledRowGuide } from './ruled-lines';
import { layoutWorksheetText, PlacedChar, WorksheetTextLayout, WorksheetTextOptions } from './text-line-layout';

export type { WorksheetTextOptions } from './text-line-layout';

function drawGuideLines(
  ctx: CanvasRenderingContext2D,
  x: number,
  baselineY: number,
  metrics: Pick<RuledFontMetrics, 'capAscent' | 'xAscent' | 'ruledHeight'>
) {
  drawLetterGuideLines(
    ctx,
    x,
    ruledRowGuide(baselineY, metrics.capAscent, metrics.xAscent),
    metrics.ruledHeight * 0.75
  );
}

interface StrokePoint {
  x: number;
  y: number;
}

interface GlyphStrokes {
  /** Centerline polylines in raster pixels, relative to the bitmap */
  paths: StrokePoint[][];
  /** Tiny isolated marks (i-dots, periods) rendered as single dots */
  dots: StrokePoint[];
  /** Offset from the pen origin to the bitmap's top-left, in raster pixels */
  originX: number;
  originY: number;
  scale: number;
}

const glyphStrokeCache = new Map<string, GlyphStrokes | null>();

/** Zhang–Suen thinning: reduces the filled glyph to a 1px centerline. */
function thinToSkeleton(grid: Uint8Array, width: number, height: number) {
  const at = (x: number, y: number) =>
    x >= 0 && x < width && y >= 0 && y < height ? grid[y * width + x] : 0;

  let changed = true;
  let guard = 0;

  while (changed && guard < 200) {
    changed = false;
    guard += 1;

    for (let pass = 0; pass < 2; pass += 1) {
      const toClear: number[] = [];

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (!at(x, y)) continue;
          const p2 = at(x, y - 1);
          const p3 = at(x + 1, y - 1);
          const p4 = at(x + 1, y);
          const p5 = at(x + 1, y + 1);
          const p6 = at(x, y + 1);
          const p7 = at(x - 1, y + 1);
          const p8 = at(x - 1, y);
          const p9 = at(x - 1, y - 1);

          const bSum = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (bSum < 2 || bSum > 6) continue;

          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let transitions = 0;
          for (let i = 0; i < 8; i += 1) {
            if (seq[i] === 0 && seq[i + 1] === 1) transitions += 1;
          }
          if (transitions !== 1) continue;

          if (pass === 0) {
            if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue;
          } else {
            if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue;
          }

          toClear.push(y * width + x);
        }
      }

      if (toClear.length > 0) {
        changed = true;
        for (const index of toClear) grid[index] = 0;
      }
    }
  }
}

const NEIGHBOR_OFFSETS = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
] as const;

/** Walk the 1px skeleton into polylines (stroke segments between ends/junctions). */
function traceSkeletonPaths(
  grid: Uint8Array,
  width: number,
  height: number
): { paths: StrokePoint[][]; dots: StrokePoint[] } {
  const at = (x: number, y: number) =>
    x >= 0 && x < width && y >= 0 && y < height ? grid[y * width + x] : 0;

  // A diagonal neighbor only counts as connected when the two orthogonal
  // pixels beside it are empty; otherwise diagonal "staircase" pixels would
  // all look like junctions and fragment every curve.
  const connectedNeighbors = (x: number, y: number): number[] => {
    const result: number[] = [];
    for (const [dx, dy] of NEIGHBOR_OFFSETS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!at(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (at(x + dx, y) || at(x, y + dy))) continue;
      result.push(ny * width + nx);
    }
    return result;
  };

  const degree = new Map<number, number>();
  const skeleton: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!at(x, y)) continue;
      const index = y * width + x;
      skeleton.push(index);
      degree.set(index, connectedNeighbors(x, y).length);
    }
  }

  const paths: StrokePoint[][] = [];
  const dots: StrokePoint[] = [];
  const usedEdges = new Set<string>();
  const edgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  const visitedInWalk = new Set<number>();

  const walk = (start: number, next: number): StrokePoint[] => {
    const points: StrokePoint[] = [
      { x: start % width, y: Math.floor(start / width) },
    ];
    let previous = start;
    let current = next;
    usedEdges.add(edgeKey(previous, current));

    for (;;) {
      const cx = current % width;
      const cy = Math.floor(current / width);
      points.push({ x: cx, y: cy });
      visitedInWalk.add(current);

      if ((degree.get(current) ?? 0) !== 2) break;

      let following = -1;
      for (const candidate of connectedNeighbors(cx, cy)) {
        if (candidate === previous) continue;
        if (usedEdges.has(edgeKey(current, candidate))) continue;
        following = candidate;
        break;
      }
      if (following === -1) break;

      usedEdges.add(edgeKey(current, following));
      previous = current;
      current = following;
    }

    return points;
  };

  // Open strokes start at endpoints (degree 1) and junctions (degree >= 3).
  for (const index of skeleton) {
    const deg = degree.get(index) ?? 0;
    if (deg === 2) continue;
    if (deg === 0) {
      dots.push({ x: index % width, y: Math.floor(index / width) });
      continue;
    }

    const x = index % width;
    const y = Math.floor(index / width);
    for (const neighbor of connectedNeighbors(x, y)) {
      if (usedEdges.has(edgeKey(index, neighbor))) continue;
      paths.push(walk(index, neighbor));
    }
  }

  // Closed loops (o, e interiors) have only degree-2 pixels.
  for (const index of skeleton) {
    if ((degree.get(index) ?? 0) !== 2 || visitedInWalk.has(index)) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    for (const neighbor of connectedNeighbors(x, y)) {
      if (usedEdges.has(edgeKey(index, neighbor))) continue;
      const loop = walk(index, neighbor);
      loop.push({ x, y });
      paths.push(loop);
      break;
    }
  }

  return { paths, dots };
}

function pathPixelLength(points: StrokePoint[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return length;
}

/**
 * Extracts the glyph's stroke centerlines by rasterizing, thinning to a
 * skeleton, and tracing it into polylines. Cached per font/size/char.
 */
function extractGlyphStrokes(
  char: string,
  fontFamily: string,
  renderSize: number
): GlyphStrokes | null {
  if (typeof document === 'undefined') return null;

  const scale = renderSize < 48 ? 3 : 2;
  const key = `${fontFamily}|${renderSize}|${scale}|${char}`;
  const cached = glyphStrokeCache.get(key);
  if (cached !== undefined) return cached;

  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) return null;
  probe.font = formatCanvasFont(fontFamily, renderSize * scale);
  probe.textBaseline = 'alphabetic';
  const metrics = probe.measureText(char);
  const left = metrics.actualBoundingBoxLeft ?? 0;
  const right = metrics.actualBoundingBoxRight ?? metrics.width;
  const ascent = metrics.actualBoundingBoxAscent ?? renderSize * scale * 0.72;
  const descent = metrics.actualBoundingBoxDescent ?? renderSize * scale * 0.2;
  const pad = Math.ceil(2 * scale);
  const width = Math.ceil(left + right + pad * 2);
  const height = Math.ceil(ascent + descent + pad * 2);
  if (width <= 0 || height <= 0) {
    glyphStrokeCache.set(key, null);
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.font = formatCanvasFont(fontFamily, renderSize * scale);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';
  const originX = pad + left;
  const originY = pad + ascent;
  ctx.fillText(char, originX, originY);

  const data = ctx.getImageData(0, 0, width, height).data;
  const grid = new Uint8Array(width * height);
  let inkCount = 0;
  for (let i = 0; i < grid.length; i += 1) {
    if (data[i * 4 + 3] > 100) {
      grid[i] = 1;
      inkCount += 1;
    }
  }
  if (inkCount === 0) {
    glyphStrokeCache.set(key, null);
    return null;
  }

  thinToSkeleton(grid, width, height);
  const { paths, dots } = traceSkeletonPaths(grid, width, height);

  // Drop skeletonization spurs (tiny twigs at joints); keep real short marks.
  const spurLimit = renderSize * scale * 0.08;
  const kept = paths.filter(
    (path) => path.length >= 2 && pathPixelLength(path) >= spurLimit
  );
  for (const path of paths) {
    if (path.length >= 2 && pathPixelLength(path) < spurLimit) continue;
    if (path.length === 1) dots.push(path[0]);
  }

  const strokes: GlyphStrokes = { paths: kept, dots, originX, originY, scale };
  glyphStrokeCache.set(key, strokes);
  return strokes;
}

/** Cumulative arc length at every vertex of a polyline. */
function cumulativeArcLengths(path: StrokePoint[]): number[] {
  const cum = new Array<number>(path.length);
  cum[0] = 0;
  for (let i = 1; i < path.length; i += 1) {
    cum[i] =
      cum[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  }
  return cum;
}

function pointAtArc(path: StrokePoint[], cum: number[], s: number): StrokePoint {
  const total = cum[cum.length - 1];
  const clamped = Math.max(0, Math.min(s, total));
  let low = 0;
  while (low < cum.length - 1 && cum[low + 1] < clamped) low += 1;
  const segment = cum[low + 1] - cum[low];
  const t = segment > 0 ? (clamped - cum[low]) / segment : 0;
  return {
    x: path[low].x + (path[low + 1].x - path[low].x) * t,
    y: path[low].y + (path[low + 1].y - path[low].y) * t,
  };
}

/** Sub-polyline between two arc positions (inclusive of lerped endpoints). */
function subPath(
  path: StrokePoint[],
  cum: number[],
  s0: number,
  s1: number
): StrokePoint[] {
  const points: StrokePoint[] = [pointAtArc(path, cum, s0)];
  for (let i = 0; i < path.length; i += 1) {
    if (cum[i] > s0 && cum[i] < s1) points.push(path[i]);
  }
  points.push(pointAtArc(path, cum, s1));
  return points;
}

/** Arc positions of sharp direction changes (letter corners). */
function detectCornerArcs(
  path: StrokePoint[],
  cum: number[],
  window: number,
  minSeparation: number
): number[] {
  const total = cum[cum.length - 1];
  const candidates: Array<{ s: number; angle: number }> = [];

  for (let i = 1; i < path.length - 1; i += 1) {
    const s = cum[i];
    if (s < window || s > total - window) continue;
    const before = pointAtArc(path, cum, s - window);
    const after = pointAtArc(path, cum, s + window);
    const v1x = path[i].x - before.x;
    const v1y = path[i].y - before.y;
    const v2x = after.x - path[i].x;
    const v2y = after.y - path[i].y;
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    if (len1 === 0 || len2 === 0) continue;
    const cos = (v1x * v2x + v1y * v2y) / (len1 * len2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
    if (angle > Math.PI / 4) candidates.push({ s, angle });
  }

  // Non-max suppression: keep the sharpest candidate in each cluster.
  candidates.sort((a, b) => b.angle - a.angle);
  const corners: number[] = [];
  for (const candidate of candidates) {
    if (corners.every((s) => Math.abs(s - candidate.s) >= minSeparation)) {
      corners.push(candidate.s);
    }
  }
  return corners.sort((a, b) => a - b);
}

/**
 * Dash intervals along a stroke: one dash anchored at each end (or centered
 * on each corner), the space between filled with evenly re-spaced dashes so
 * the letter's shape is always preserved.
 */
function buildDashIntervals(
  total: number,
  anchors: number[],
  dashLength: number,
  gapLength: number,
  closed: boolean
): Array<[number, number]> {
  if (total <= dashLength * 1.6) {
    return [[0, total]];
  }

  const half = dashLength / 2;
  const intervals: Array<[number, number]> = [];

  // Dash centered on each anchor, clamped to the stroke.
  const anchorIntervals: Array<[number, number]> = anchors.map((s) => {
    const start = Math.max(0, Math.min(s - half, total - dashLength));
    return [start, start + dashLength];
  });

  // Merge overlaps.
  anchorIntervals.sort((a, b) => a[0] - b[0]);
  for (const interval of anchorIntervals) {
    const last = intervals[intervals.length - 1];
    if (last && interval[0] <= last[1] + gapLength * 0.5) {
      last[1] = Math.max(last[1], interval[1]);
    } else {
      intervals.push([interval[0], interval[1]]);
    }
  }

  // Fill the span between consecutive anchor dashes with evenly spaced ones.
  const filled: Array<[number, number]> = [];
  const spans: Array<[number, number]> = [];
  for (let i = 0; i < intervals.length; i += 1) {
    filled.push(intervals[i]);
    const nextStart =
      i + 1 < intervals.length
        ? intervals[i + 1][0]
        : closed
          ? intervals[0][0] + total
          : undefined;
    if (nextStart !== undefined) spans.push([intervals[i][1], nextStart]);
  }

  for (const [from, to] of spans) {
    const space = to - from;
    const count = Math.floor((space - gapLength) / (dashLength + gapLength));
    if (count < 1) continue;
    const period = space / (count + 1);
    for (let k = 1; k <= count; k += 1) {
      const center = from + k * period;
      const start = (center - half + total) % total;
      const rawEnd = start + dashLength;
      if (rawEnd <= total) {
        filled.push([start, rawEnd]);
      } else {
        filled.push([start, total], [0, rawEnd - total]);
      }
    }
  }

  return filled;
}

interface GlyphDashSegments {
  segments: StrokePoint[][];
  dots: StrokePoint[];
  originX: number;
  originY: number;
  scale: number;
}

const glyphDashCache = new Map<string, GlyphDashSegments | null>();

/** Dash segments (raster px) for a glyph, anchored at stroke ends and corners. */
function getGlyphDashSegments(
  char: string,
  fontFamily: string,
  renderSize: number,
  dotSpacing: number
): GlyphDashSegments | null {
  const strokes = extractGlyphStrokes(char, fontFamily, renderSize);
  if (!strokes) return null;

  const { paths, dots, originX, originY, scale } = strokes;
  const dashLength = Math.max(3.5, dotSpacing * (renderSize / 48) * 0.75) * scale;
  const gapLength = Math.max(2.2 * scale, dashLength * 0.6);

  const key = `${fontFamily}|${renderSize}|${scale}|${dashLength.toFixed(1)}|${gapLength.toFixed(1)}|${char}`;
  const cached = glyphDashCache.get(key);
  if (cached !== undefined) return cached;

  const cornerWindow = Math.max(2 * scale, dashLength * 0.35);
  const segments: StrokePoint[][] = [];

  for (const path of paths) {
    if (path.length < 2) continue;
    const cum = cumulativeArcLengths(path);
    const total = cum[cum.length - 1];
    if (total <= 0) continue;

    const closed =
      path[0].x === path[path.length - 1].x && path[0].y === path[path.length - 1].y;
    const corners = detectCornerArcs(path, cum, cornerWindow, dashLength);
    // Open strokes always get a dash at both extreme ends.
    const anchors =
      closed && corners.length > 0 ? corners : closed ? [0] : [0, total, ...corners];

    for (const [s0, s1] of buildDashIntervals(total, anchors, dashLength, gapLength, closed)) {
      segments.push(subPath(path, cum, s0, Math.min(s1, total)));
    }
  }

  const result: GlyphDashSegments = { segments, dots, originX, originY, scale };
  glyphDashCache.set(key, result);
  return result;
}

/**
 * Professional tracing look: dashes that follow the letter's stroke
 * centerline, with a dash guaranteed at every stroke end and corner so the
 * letter keeps its shape.
 */
function drawCharDashes(
  ctx: CanvasRenderingContext2D,
  placed: PlacedChar,
  renderSize: number,
  dotSpacing: number,
  dotColor: string,
  fontFamily: string
) {
  const glyph = getGlyphDashSegments(placed.char, fontFamily, renderSize, dotSpacing);
  if (!glyph) return;

  const { segments, dots, originX, originY, scale } = glyph;
  const strokeWidth = Math.max(1.6, renderSize * 0.05);

  const toX = (px: number) => placed.x + (px - originX) / scale;
  const toY = (py: number) => placed.baselineY + (py - originY) / scale;

  ctx.save();
  ctx.strokeStyle = dotColor;
  ctx.fillStyle = dotColor;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const segment of segments) {
    ctx.beginPath();
    ctx.moveTo(toX(segment[0].x), toY(segment[0].y));
    for (let i = 1; i < segment.length; i += 1) {
      ctx.lineTo(toX(segment[i].x), toY(segment[i].y));
    }
    ctx.stroke();
  }

  for (const dot of dots) {
    ctx.beginPath();
    ctx.arc(toX(dot.x), toY(dot.y), strokeWidth * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawPlacedChar(
  ctx: CanvasRenderingContext2D,
  placed: PlacedChar,
  layout: WorksheetTextLayout,
  mode: HandwritingMode,
  options: WorksheetTextOptions
) {
  const { ruledHeight, fontFamily } = layout;
  const { dotSpacing, strokeWidth, textColor, dotColor } = options;
  const renderSize = placed.renderSize;

  ctx.font = formatCanvasFont(fontFamily, renderSize);

  if (mode === 'dotted') {
    drawCharDashes(ctx, placed, renderSize, dotSpacing, dotColor, fontFamily);
    return;
  }

  if (mode === 'outline') {
    ctx.strokeStyle = textColor;
    ctx.lineWidth = strokeWidth;
    ctx.strokeText(placed.char, placed.x, placed.baselineY);
    return;
  }

  if (mode === 'solid') {
    ctx.fillStyle = textColor;
    ctx.fillText(placed.char, placed.x, placed.baselineY);
    return;
  }

  if (mode === 'guide-lines') {
    drawGuideLines(ctx, placed.x, placed.baselineY, {
      capAscent: placed.capAscent,
      xAscent: placed.xAscent,
      ruledHeight,
    });
    ctx.fillStyle = textColor;
    ctx.globalAlpha = 0.3;
    ctx.fillText(placed.char, placed.x, placed.baselineY);
    ctx.globalAlpha = 1;
    return;
  }

  if (mode === 'arrow-guides') {
    drawGuideLines(ctx, placed.x, placed.baselineY, {
      capAscent: placed.capAscent,
      xAscent: placed.xAscent,
      ruledHeight,
    });
    ctx.fillStyle = textColor;
    ctx.globalAlpha = 0.2;
    ctx.fillText(placed.char, placed.x, placed.baselineY);
    ctx.globalAlpha = 1;
  }
}

/**
 * Renders worksheet text onto a canvas context (logical coordinates).
 */
export function drawWorksheetText(
  ctx: CanvasRenderingContext2D,
  options: WorksheetTextOptions
): WorksheetTextLayout {
  const layout = layoutWorksheetText(ctx, options);

  for (const placed of layout.chars) {
    const charMode = options.getCharMode?.(placed.charIndex) ?? options.mode;
    drawPlacedChar(ctx, placed, layout, charMode, options);
  }

  return layout;
}
