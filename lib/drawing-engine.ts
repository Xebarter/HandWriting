import { Stroke, Point, DrawingContext } from './types';

const STROKE_SMOOTHING = 0.3;
const MIN_DISTANCE = 2;

function generateStrokeId(): string {
  return `stroke-${Date.now()}-${Math.random()}`;
}

// Calculate distance between two points
function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Smooth point between two points
function smoothPoint(p1: Point, p2: Point, factor: number = STROKE_SMOOTHING): Point {
  return {
    x: p1.x + (p2.x - p1.x) * factor,
    y: p1.y + (p2.y - p1.y) * factor,
    pressure: (p1.pressure || 1 + (p2.pressure || 1)) / 2,
    timestamp: p2.timestamp,
  };
}

// Initialize drawing context
export function initializeCanvas(canvas: HTMLCanvasElement): DrawingContext {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  return {
    canvas,
    ctx,
    strokes: [],
    undoStack: [],
    redoStack: [],
    isDrawing: false,
    currentStroke: null,
  };
}

// Start a new stroke
export function startStroke(
  context: DrawingContext,
  x: number,
  y: number,
  color: string = '#000000',
  width: number = 2,
  toolType: 'pen' | 'pencil' | 'marker' | 'eraser' = 'pen'
): void {
  context.isDrawing = true;
  context.currentStroke = {
    id: generateStrokeId(),
    points: [{ x, y, pressure: 1, timestamp: Date.now() }],
    color,
    width,
    opacity: toolType === 'eraser' ? 0 : 1,
    timestamp: Date.now(),
    toolType,
  };

  // Clear redo stack when starting new stroke
  context.redoStack = [];
}

// Add point to current stroke
export function addStrokePoint(
  context: DrawingContext,
  x: number,
  y: number,
  pressure: number = 1
): void {
  if (!context.isDrawing || !context.currentStroke) return;

  const lastPoint = context.currentStroke.points[context.currentStroke.points.length - 1];

  // Only add point if it's far enough from the last point
  if (distance(lastPoint, { x, y, pressure, timestamp: Date.now() }) < MIN_DISTANCE) {
    return;
  }

  const newPoint: Point = { x, y, pressure, timestamp: Date.now() };
  context.currentStroke.points.push(newPoint);

  // Render point
  renderStroke(context, context.currentStroke);
}

// End current stroke
export function endStroke(context: DrawingContext): Stroke | null {
  if (!context.isDrawing || !context.currentStroke) return null;

  context.isDrawing = false;
  const stroke = context.currentStroke;

  // Save stroke to history
  context.strokes.push(stroke);
  context.undoStack.push([...context.strokes]);

  context.currentStroke = null;
  return stroke;
}

// Render a single stroke to canvas
function renderStroke(context: DrawingContext, stroke: Stroke): void {
  const { ctx, canvas } = context;
  const points = stroke.points;

  if (points.length < 2) return;

  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = stroke.opacity;

  // Special handling for eraser
  if (stroke.toolType === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  ctx.stroke();
  ctx.restore();
}

// Render all strokes
export function redrawCanvas(context: DrawingContext): void {
  const { ctx, canvas } = context;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  context.strokes.forEach((stroke) => {
    renderStroke(context, stroke);
  });
}

// Clear canvas
export function clearCanvas(context: DrawingContext): void {
  context.ctx.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.strokes = [];
  context.undoStack = [];
  context.redoStack = [];
  context.currentStroke = null;
}

// Undo last stroke
export function undo(context: DrawingContext): void {
  if (context.strokes.length === 0) return;

  const currentState = [...context.strokes];
  context.redoStack.push(currentState);

  context.strokes.pop();
  redrawCanvas(context);
}

// Redo last stroke
export function redo(context: DrawingContext): void {
  if (context.redoStack.length === 0) return;

  const nextState = context.redoStack.pop();
  if (nextState) {
    context.undoStack.push([...context.strokes]);
    context.strokes = nextState;
    redrawCanvas(context);
  }
}

// Export strokes as SVG paths
export function exportStrokesAsSVG(context: DrawingContext): string {
  const { canvas } = context;
  
  let svg = `<svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect width="100%" height="100%" fill="white"/>`;

  context.strokes.forEach((stroke) => {
    if (stroke.toolType === 'eraser') return; // Skip eraser strokes

    const pathData = pointsToPath(stroke.points);
    svg += `<path d="${pathData}" stroke="${stroke.color}" stroke-width="${stroke.width}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${stroke.opacity}"/>`;
  });

  svg += '</svg>';
  return svg;
}

// Convert points to SVG path data
function pointsToPath(points: Point[]): string {
  if (points.length === 0) return '';

  let path = `M${points[0].x},${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    path += ` L${points[i].x},${points[i].y}`;
  }

  return path;
}

// Import strokes from SVG or JSON
export function importStrokes(context: DrawingContext, strokesData: Stroke[]): void {
  context.strokes = strokesData;
  context.undoStack = [[...context.strokes]];
  context.redoStack = [];
  redrawCanvas(context);
}

// Get canvas as blob (for export)
export function canvasToBlob(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg' = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to convert canvas to blob'));
    }, type);
  });
}

// Get canvas image data
export function getCanvasImageData(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// Detect strokes (get bounding box of all strokes)
export function getStrokesBoundingBox(context: DrawingContext): { x: number; y: number; width: number; height: number } | null {
  if (context.strokes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  context.strokes.forEach((stroke) => {
    stroke.points.forEach((point) => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// Count strokes
export function getStrokeCount(context: DrawingContext): number {
  return context.strokes.length;
}

// Get canvas state as JSON (for saving)
export function serializeCanvas(context: DrawingContext): string {
  return JSON.stringify({
    strokes: context.strokes,
    width: context.canvas.width,
    height: context.canvas.height,
  });
}

// Load canvas state from JSON
export function deserializeCanvas(context: DrawingContext, json: string): void {
  const data = JSON.parse(json);
  context.strokes = data.strokes;
  redrawCanvas(context);
}
