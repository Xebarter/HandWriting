import { LayoutConfig, PageTemplate, PaperSize, Orientation } from './types';

// Paper dimensions in pixels (at 96 DPI)
const PAPER_SIZES: Record<PaperSize, { width: number; height: number }> = {
  A4: { width: 794, height: 1123 },
  letter: { width: 816, height: 1056 },
  custom: { width: 800, height: 1000 },
};

// Default margin in pixels
const DEFAULT_MARGIN = 40;
const DEFAULT_LINE_SPACING = 30;

// Create layout configuration with defaults
export function createLayoutConfig(
  template: PageTemplate = 'single-line',
  paperSize: PaperSize = 'A4',
  orientation: Orientation = 'portrait'
): LayoutConfig {
  return {
    template,
    marginTop: DEFAULT_MARGIN,
    marginBottom: DEFAULT_MARGIN,
    marginLeft: DEFAULT_MARGIN,
    marginRight: DEFAULT_MARGIN,
    lineSpacing: DEFAULT_LINE_SPACING,
    boxSize: 60,
    paperSize,
    orientation,
    backgroundColor: '#ffffff',
    lineColor: '#d3d3d3',
  };
}

// Get paper dimensions
export function getPaperDimensions(
  paperSize: PaperSize,
  orientation: Orientation
): { width: number; height: number } {
  const dim = PAPER_SIZES[paperSize];

  if (orientation === 'landscape') {
    return { width: dim.height, height: dim.width };
  }

  return dim;
}

// Render layout on canvas
export function renderLayout(
  ctx: CanvasRenderingContext2D,
  config: LayoutConfig,
  canvasWidth: number,
  canvasHeight: number
): void {
  // Fill background
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const drawableWidth = canvasWidth - config.marginLeft - config.marginRight;
  const startY = config.marginTop;

  ctx.strokeStyle = config.lineColor;
  ctx.lineWidth = 1;

  switch (config.template) {
    case 'single-line':
      drawSingleLine(ctx, startY, config, canvasWidth);
      break;
    case 'double-line':
      drawDoubleLines(ctx, startY, config, canvasWidth, 2);
      break;
    case 'triple-line':
      drawDoubleLines(ctx, startY, config, canvasWidth, 3);
      break;
    case 'grid':
      drawGrid(ctx, config, canvasWidth, canvasHeight);
      break;
    case 'boxes':
      drawBoxes(ctx, config, canvasWidth, canvasHeight);
      break;
    case 'blank':
      // No lines
      break;
  }

  // Draw margins as subtle guides
  if (false) {
    // Disabled for final output
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.1)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(config.marginLeft, config.marginTop, drawableWidth, canvasHeight - config.marginTop - config.marginBottom);
  }
}

// Draw single line
function drawSingleLine(ctx: CanvasRenderingContext2D, startY: number, config: LayoutConfig, canvasWidth: number): void {
  ctx.beginPath();
  ctx.moveTo(config.marginLeft, startY);
  ctx.lineTo(canvasWidth - config.marginRight, startY);
  ctx.stroke();
}

// Draw multiple horizontal lines
function drawDoubleLines(
  ctx: CanvasRenderingContext2D,
  startY: number,
  config: LayoutConfig,
  canvasWidth: number,
  numLines: number
): void {
  for (let i = 0; i < numLines; i++) {
    const y = startY + i * config.lineSpacing;
    ctx.beginPath();
    ctx.moveTo(config.marginLeft, y);
    ctx.lineTo(canvasWidth - config.marginRight, y);
    ctx.stroke();
  }
}

// Draw grid pattern
function drawGrid(
  ctx: CanvasRenderingContext2D,
  config: LayoutConfig,
  canvasWidth: number,
  canvasHeight: number
): void {
  const gridSize = config.lineSpacing;

  ctx.strokeStyle = config.lineColor;
  ctx.lineWidth = 0.5;

  // Horizontal lines
  for (let y = config.marginTop; y <= canvasHeight - config.marginBottom; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(config.marginLeft, y);
    ctx.lineTo(canvasWidth - config.marginRight, y);
    ctx.stroke();
  }

  // Vertical lines
  for (let x = config.marginLeft; x <= canvasWidth - config.marginRight; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, config.marginTop);
    ctx.lineTo(x, canvasHeight - config.marginBottom);
    ctx.stroke();
  }
}

// Draw practice boxes
function drawBoxes(
  ctx: CanvasRenderingContext2D,
  config: LayoutConfig,
  canvasWidth: number,
  canvasHeight: number
): void {
  const boxSize = config.boxSize || 60;
  const hSpacing = boxSize + 10;
  const vSpacing = boxSize + 10;

  ctx.strokeStyle = config.lineColor;
  ctx.lineWidth = 1;

  for (let y = config.marginTop; y <= canvasHeight - config.marginBottom - boxSize; y += vSpacing) {
    for (let x = config.marginLeft; x <= canvasWidth - config.marginRight - boxSize; x += hSpacing) {
      ctx.strokeRect(x, y, boxSize, boxSize);
    }
  }
}

// Calculate how many pages needed for content
export function calculatePagesNeeded(
  contentHeight: number,
  config: LayoutConfig,
  paperSize: PaperSize,
  orientation: Orientation
): number {
  const paper = getPaperDimensions(paperSize, orientation);
  const usableHeight = paper.height - config.marginTop - config.marginBottom;

  return Math.ceil(contentHeight / usableHeight);
}

// Get layout preview as canvas
export function getLayoutPreview(config: LayoutConfig, scale: number = 0.2): HTMLCanvasElement {
  const paper = getPaperDimensions(config.paperSize, config.orientation);
  const previewWidth = paper.width * scale;
  const previewHeight = paper.height * scale;

  const canvas = document.createElement('canvas');
  canvas.width = previewWidth;
  canvas.height = previewHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  ctx.scale(scale, scale);
  renderLayout(ctx, config, paper.width, paper.height);

  return canvas;
}

// Update margins
export function setMargins(
  config: LayoutConfig,
  top?: number,
  right?: number,
  bottom?: number,
  left?: number
): void {
  if (top !== undefined) config.marginTop = top;
  if (right !== undefined) config.marginRight = right;
  if (bottom !== undefined) config.marginBottom = bottom;
  if (left !== undefined) config.marginLeft = left;
}

// Update line spacing
export function setLineSpacing(config: LayoutConfig, spacing: number): void {
  config.lineSpacing = Math.max(10, spacing);
}

// Update template
export function setTemplate(config: LayoutConfig, template: PageTemplate): void {
  config.template = template;

  // Adjust defaults based on template
  switch (template) {
    case 'single-line':
      config.lineSpacing = 50;
      break;
    case 'double-line':
    case 'triple-line':
      config.lineSpacing = 30;
      break;
    case 'grid':
      config.lineSpacing = 20;
      break;
    case 'boxes':
      config.boxSize = 60;
      break;
  }
}

// Validate layout configuration
export function validateLayoutConfig(config: LayoutConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.marginTop < 0 || config.marginTop > 200) {
    errors.push('Invalid top margin');
  }
  if (config.marginBottom < 0 || config.marginBottom > 200) {
    errors.push('Invalid bottom margin');
  }
  if (config.marginLeft < 0 || config.marginLeft > 200) {
    errors.push('Invalid left margin');
  }
  if (config.marginRight < 0 || config.marginRight > 200) {
    errors.push('Invalid right margin');
  }
  if (config.lineSpacing < 10 || config.lineSpacing > 100) {
    errors.push('Invalid line spacing');
  }

  return { valid: errors.length === 0, errors };
}

// Get template description
export function getTemplateDescription(template: PageTemplate): string {
  const descriptions: Record<PageTemplate, string> = {
    'single-line': 'Single horizontal line for basic handwriting practice',
    'double-line': 'Double lines to guide letter heights',
    'triple-line': 'Triple lines for multi-line writing practice',
    grid: 'Grid pattern for precise spacing and alignment',
    boxes: 'Individual boxes for practicing letters and numbers',
    blank: 'Blank page for free drawing',
    custom: 'Custom layout configuration',
  };

  return descriptions[template] || 'Unknown template';
}

// Create custom layout
export function createCustomLayout(
  paperSize: PaperSize,
  orientation: Orientation,
  marginTop: number,
  marginBottom: number,
  marginLeft: number,
  marginRight: number,
  lineSpacing: number
): LayoutConfig {
  const config = createLayoutConfig('custom', paperSize, orientation);

  setMargins(config, marginTop, marginRight, marginBottom, marginLeft);
  setLineSpacing(config, lineSpacing);

  return config;
}

// Export layout as JSON
export function serializeLayout(config: LayoutConfig): string {
  return JSON.stringify(config);
}

// Import layout from JSON
export function deserializeLayout(json: string): LayoutConfig {
  return JSON.parse(json);
}
