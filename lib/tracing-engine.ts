import { Stroke, Point, TracingGuide, TracingResult } from './types';

const DEFAULT_TOLERANCE = 20; // pixels

// Generate dotted tracing guide from text
export function generateTracingGuide(text: string, fontSize: number): TracingGuide {
  return {
    id: `guide-${Date.now()}`,
    text,
    fontSize,
    dottedPath: generateDottedPath(text, fontSize),
    guidePoints: generateGuidePoints(text, fontSize),
    tolerance: DEFAULT_TOLERANCE,
  };
}

// Generate dotted SVG path for tracing
function generateDottedPath(text: string, fontSize: number): string {
  // Simple representation - in production would use font rendering
  let path = '';
  const letterWidth = fontSize * 0.6;
  let x = 0;
  const y = fontSize;

  for (const char of text) {
    if (char === ' ') {
      x += letterWidth * 0.5;
      continue;
    }

    // Generate simple letter paths
    switch (char.toUpperCase()) {
      case 'A':
        path += `M${x},${y * 1.2} L${x + letterWidth * 0.5},${y * 0.2} L${x + letterWidth},${y * 1.2} M${x + letterWidth * 0.2},${y * 0.7} L${x + letterWidth * 0.8},${y * 0.7}`;
        break;
      case 'B':
        path += `M${x},${y * 0.2} L${x},${y * 1.2} L${x + letterWidth * 0.8},${y * 1.2} Q${x + letterWidth},${y * 0.8} ${x + letterWidth * 0.8},${y * 0.7} L${x},${y * 0.7} M${x + letterWidth * 0.8},${y * 0.7} Q${x + letterWidth},${y * 0.45} ${x + letterWidth * 0.8},${y * 0.2} L${x},${y * 0.2}`;
        break;
      case 'C':
        path += `M${x + letterWidth},${y * 0.2} L${x},${y * 0.2} L${x},${y * 1.2} L${x + letterWidth},${y * 1.2}`;
        break;
      default:
        // Simple vertical line for unknown characters
        path += `M${x},${y * 0.2} L${x},${y * 1.2}`;
    }

    x += letterWidth;
  }

  return path;
}

// Generate guide points from text (used for validation)
function generateGuidePoints(text: string, fontSize: number): Point[] {
  const points: Point[] = [];
  const letterWidth = fontSize * 0.6;
  let x = 0;
  const y = fontSize;
  const dotSpacing = Math.max(3, Math.floor(fontSize * 0.15));

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === ' ') {
      x += letterWidth * 0.5;
      continue;
    }

    // Generate sample points for each letter
    switch (char.toUpperCase()) {
      case 'A':
        addLinePoints(points, x, y * 1.2, x + letterWidth * 0.5, y * 0.2, dotSpacing);
        addLinePoints(points, x + letterWidth * 0.5, y * 0.2, x + letterWidth, y * 1.2, dotSpacing);
        break;
      case 'B':
      case 'C':
      case 'D':
        addLinePoints(points, x, y * 0.2, x, y * 1.2, dotSpacing);
        addLinePoints(points, x, y * 1.2, x + letterWidth, y * 1.2, dotSpacing);
        break;
      default:
        addLinePoints(points, x, y * 0.2, x, y * 1.2, dotSpacing);
    }

    x += letterWidth;
  }

  return points;
}

// Helper: add points along a line
function addLinePoints(
  points: Point[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  spacing: number
): void {
  const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const steps = Math.ceil(distance / spacing);

  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    points.push({
      x: x1 + (x2 - x1) * t,
      y: y1 + (y2 - y1) * t,
      timestamp: Date.now(),
    });
  }
}

// Validate traced path against guide
export function validateTrace(userStroke: Stroke, guide: TracingGuide): TracingResult {
  if (userStroke.points.length === 0) {
    return {
      accuracy: 0,
      isCorrect: false,
      feedback: 'No trace detected',
    };
  }

  const accuracy = calculateAccuracy(userStroke.points, guide.guidePoints, guide.tolerance);

  return {
    accuracy,
    isCorrect: accuracy >= 0.7, // 70% accuracy threshold
    feedback:
      accuracy >= 0.9
        ? 'Excellent! Perfect trace'
        : accuracy >= 0.7
          ? 'Good! Nearly perfect'
          : accuracy >= 0.5
            ? 'Getting there! Keep practicing'
            : 'Try again, follow the guide more carefully',
  };
}

// Calculate accuracy between user path and guide path
export function calculateAccuracy(userPoints: Point[], guidePoints: Point[], tolerance: number = DEFAULT_TOLERANCE): number {
  if (guidePoints.length === 0) return 0;

  let matchedPoints = 0;

  // For each guide point, check if there's a user point nearby
  guidePoints.forEach((guidePoint) => {
    const nearbyUserPoint = userPoints.find((userPoint) => {
      const dist = Math.sqrt((userPoint.x - guidePoint.x) ** 2 + (userPoint.y - guidePoint.y) ** 2);
      return dist <= tolerance;
    });

    if (nearbyUserPoint) {
      matchedPoints++;
    }
  });

  return matchedPoints / guidePoints.length;
}

// Create dotted guide pattern for rendering
export function createGuidedPattern(text: string, fontSize: number, dotSpacing: number = 4): DottedGuidePattern {
  const path = generateDottedPath(text, fontSize);
  const dots = generateDots(text, fontSize, dotSpacing);

  return {
    path,
    dots,
    fontSize,
    text,
  };
}

// Generate dot positions for visual guide
function generateDots(text: string, fontSize: number, spacing: number): Point[] {
  const dots: Point[] = [];
  const letterWidth = fontSize * 0.6;
  let x = 0;
  const y = fontSize;

  for (const char of text) {
    if (char === ' ') {
      x += letterWidth * 0.5;
      continue;
    }

    // Add dots in a grid pattern around letter space
    for (let dx = 0; dx <= letterWidth; dx += spacing) {
      for (let dy = 0; dy <= fontSize; dy += spacing) {
        dots.push({
          x: x + dx,
          y: y - dy,
          timestamp: Date.now(),
        });
      }
    }

    x += letterWidth;
  }

  return dots;
}

// Detection: check if stroke is complete (endpoints near guide)
export function isTraceComplete(userStroke: Stroke, guide: TracingGuide): boolean {
  if (userStroke.points.length < 5) return false;

  const firstPoint = userStroke.points[0];
  const lastPoint = userStroke.points[userStroke.points.length - 1];

  const guideFirst = guide.guidePoints[0];
  const guideLast = guide.guidePoints[guide.guidePoints.length - 1];

  const startDist = Math.sqrt((firstPoint.x - guideFirst.x) ** 2 + (firstPoint.y - guideFirst.y) ** 2);
  const endDist = Math.sqrt((lastPoint.x - guideLast.x) ** 2 + (lastPoint.y - guideLast.y) ** 2);

  return startDist <= guide.tolerance && endDist <= guide.tolerance;
}

// Get difficulty level for guide (1-5)
export function getTracingDifficulty(text: string): 1 | 2 | 3 | 4 | 5 {
  const complexity = text.length + text.split('').filter((c) => /[A-Z]/i.test(c)).length * 2;

  if (complexity <= 2) return 1;
  if (complexity <= 4) return 2;
  if (complexity <= 8) return 3;
  if (complexity <= 12) return 4;
  return 5;
}

interface DottedGuidePattern {
  path: string;
  dots: Point[];
  fontSize: number;
  text: string;
}
