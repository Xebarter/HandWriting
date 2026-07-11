import { PAGE_MARGIN } from './document-constants';
import { HandwritingMode } from './types';
import { RuledFontMetrics } from './font-metrics';

export interface WorksheetSnapshotOptions {
  sourceCanvas: HTMLCanvasElement;
  width: number;
  height: number;
  text: string;
  mode: HandwritingMode;
  fontSize: number;
  dotSpacing: number;
  strokeWidth: number;
  textColor: string;
  dotColor: string;
  selectedFont: string;
  textAlign: 'left' | 'center' | 'right';
  pageMargin?: number;
  fontMetrics?: RuledFontMetrics;
  /** Target DPI for the output canvas (default 96) */
  dpi?: number;
  getCharMode?: (charIndex: number) => HandwritingMode;
}

/**
 * Builds a complete worksheet image for export/print by compositing the
 * display canvas with solid-mode text (which only lives in the editor overlay).
 */
export async function captureWorksheetCanvas(options: WorksheetSnapshotOptions): Promise<HTMLCanvasElement> {
  const {
    sourceCanvas,
    width,
    height,
    text,
    mode,
    fontSize,
    dotSpacing,
    strokeWidth,
    textColor,
    dotColor,
    selectedFont,
    textAlign,
    pageMargin = PAGE_MARGIN,
    fontMetrics,
    dpi = 96,
  } = options;

  const exportScale = dpi / 96;
  const sourceLogicalHeight = sourceCanvas.height / (sourceCanvas.width / width);
  const outputHeight = Math.max(height, sourceLogicalHeight);
  const outCanvas = document.createElement('canvas');
  outCanvas.width = Math.round(width * exportScale);
  outCanvas.height = Math.round(outputHeight * exportScale);

  const ctx = outCanvas.getContext('2d');
  if (!ctx) return sourceCanvas;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
  ctx.drawImage(sourceCanvas, 0, 0, outCanvas.width, outCanvas.height);

  return outCanvas;
}

/** Convert logical pixel dimensions to millimeters at 96 DPI */
export function logicalPxToMm(px: number): number {
  return (px / 96) * 25.4;
}
