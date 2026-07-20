import { ConnectionPoint, HandwritingMode, LetterBox, LetterConnection } from '@/lib/types';
import { getEntryAnchor, getExitAnchor } from '@/lib/letter-layout';

export interface TrainingRenderOptions {
  mode: HandwritingMode;
  dotSpacing: number;
  dotColor: string;
  strokeColor: string;
  strokeWidth: number;
  preview?: { points: ConnectionPoint[] } | null;
}

function cubicPoint(
  t: number,
  p0: ConnectionPoint,
  p1: ConnectionPoint,
  p2: ConnectionPoint,
  p3: ConnectionPoint
): ConnectionPoint {
  const u = 1 - t;
  return {
    x:
      u * u * u * p0.x +
      3 * u * u * t * p1.x +
      3 * u * t * t * p2.x +
      t * t * t * p3.x,
    y:
      u * u * u * p0.y +
      3 * u * u * t * p1.y +
      3 * u * t * t * p2.y +
      t * t * t * p3.y,
  };
}

/** Classic undercurve used in nursery / lower-primary cursive worksheets */
export function buildTrainingConnectorPath(from: LetterBox, to: LetterBox): ConnectionPoint[] {
  const start = getExitAnchor(from);
  const end = getEntryAnchor(to);
  const gap = Math.max(end.x - start.x, 8);
  const dip = Math.min(from.descent + 6, 12);

  const cp1: ConnectionPoint = {
    x: start.x + gap * 0.3,
    y: start.y + dip,
  };
  const cp2: ConnectionPoint = {
    x: end.x - gap * 0.3,
    y: end.y - Math.min(to.ascent * 0.2, 10),
  };

  const segments = Math.max(16, Math.round(gap / 4));
  const points: ConnectionPoint[] = [];

  for (let i = 0; i <= segments; i++) {
    points.push(cubicPoint(i / segments, start, cp1, cp2, end));
  }

  return points;
}

export function buildTrainingConnection(
  from: LetterBox,
  to: LetterBox,
  color: string,
  width: number,
  source: 'manual' | 'auto'
): LetterConnection {
  return {
    id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fromCharIndex: from.charIndex,
    toCharIndex: to.charIndex,
    points: buildTrainingConnectorPath(from, to),
    color,
    width,
    source,
    patternStyle: 'training',
  };
}

function pathLength(points: ConnectionPoint[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return length;
}

/** Place evenly spaced dots along a connector for tracing practice */
export function sampleTraceDots(points: ConnectionPoint[], spacing: number): ConnectionPoint[] {
  if (points.length < 2 || spacing <= 0) return [];

  const total = pathLength(points);
  if (total === 0) return [];

  const dots: ConnectionPoint[] = [];
  let traveled = spacing * 0.5;
  let segmentStart = 0;

  while (traveled < total && segmentStart < points.length - 1) {
    const a = points[segmentStart];
    const b = points[segmentStart + 1];
    const segmentLength = Math.hypot(b.x - a.x, b.y - a.y);

    if (segmentLength === 0) {
      segmentStart += 1;
      continue;
    }

    if (traveled <= segmentLength) {
      const t = traveled / segmentLength;
      dots.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      });
      traveled += spacing;
      continue;
    }

    traveled -= segmentLength;
    segmentStart += 1;
  }

  return dots;
}

function drawDirectionArrow(
  ctx: CanvasRenderingContext2D,
  from: ConnectionPoint,
  to: ConnectionPoint,
  color: string
) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = 7;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - size * Math.cos(angle - Math.PI / 6),
    to.y - size * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    to.x - size * Math.cos(angle + Math.PI / 6),
    to.y - size * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStartMarker(ctx: CanvasRenderingContext2D, point: ConnectionPoint) {
  ctx.save();
  ctx.fillStyle = '#2e7d32';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawDottedTracePath(
  ctx: CanvasRenderingContext2D,
  points: ConnectionPoint[],
  options: TrainingRenderOptions
) {
  if (points.length < 2) return;

  drawStartMarker(ctx, points[0]);

  const directionTarget = points[Math.min(4, points.length - 1)];
  drawDirectionArrow(ctx, points[0], directionTarget, options.strokeColor);

  const dots = sampleTraceDots(points, options.dotSpacing);
  const dotRadius = Math.max(1.8, options.strokeWidth * 0.45);
  ctx.save();
  ctx.fillStyle = options.dotColor;
  dots.forEach((dot) => {
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawOutlineTracePath(
  ctx: CanvasRenderingContext2D,
  points: ConnectionPoint[],
  options: TrainingRenderOptions
) {
  if (points.length < 2) return;

  drawStartMarker(ctx, points[0]);
  drawDirectionArrow(ctx, points[0], points[Math.min(4, points.length - 1)], options.strokeColor);

  ctx.save();
  ctx.strokeStyle = options.strokeColor;
  ctx.lineWidth = options.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([5, 5]);
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSolidModelPath(
  ctx: CanvasRenderingContext2D,
  points: ConnectionPoint[],
  options: TrainingRenderOptions
) {
  if (points.length < 2) return;

  ctx.save();
  ctx.strokeStyle = options.strokeColor;
  ctx.lineWidth = options.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

export function renderTrainingConnection(
  ctx: CanvasRenderingContext2D,
  points: ConnectionPoint[],
  options: TrainingRenderOptions
) {
  if (options.mode === 'dotted') {
    drawDottedTracePath(ctx, points, options);
    return;
  }

  if (options.mode === 'solid') {
    drawSolidModelPath(ctx, points, options);
    return;
  }

  if (options.mode === 'outline' || options.mode === 'arrow-guides') {
    drawOutlineTracePath(ctx, points, options);
    return;
  }

  drawDottedTracePath(ctx, points, options);
}

export function renderTrainingConnections(
  ctx: CanvasRenderingContext2D,
  connections: LetterConnection[],
  options: TrainingRenderOptions
) {
  connections.forEach((connection) => {
    renderTrainingConnection(ctx, connection.points, {
      ...options,
      mode: connection.mode ?? options.mode,
    });
  });

  if (options.preview?.points && options.preview.points.length > 1) {
    renderTrainingConnection(ctx, options.preview.points, {
      ...options,
    });
  }
}

/** Regenerate professional connector geometry after text reflow */
export function refreshTrainingConnection(
  connection: LetterConnection,
  from: LetterBox,
  to: LetterBox
): LetterConnection {
  return {
    ...connection,
    points: buildTrainingConnectorPath(from, to),
  };
}
