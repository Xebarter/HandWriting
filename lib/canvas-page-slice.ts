import { PAGE_HEIGHT, PAGE_WIDTH } from '@/lib/document-constants';

export function getCanvasLogicalSize(canvas: HTMLCanvasElement): { width: number; height: number } {
  const dpr = canvas.width / (canvas.clientWidth || PAGE_WIDTH);
  return {
    width: canvas.width / dpr,
    height: canvas.height / dpr,
  };
}

export function sliceCanvasPage(
  source: HTMLCanvasElement,
  pageIndex: number,
  pageWidth: number = PAGE_WIDTH,
  pageHeight: number = PAGE_HEIGHT
): HTMLCanvasElement {
  const dpr = source.width / pageWidth;
  const sx = 0;
  const sy = pageIndex * pageHeight * dpr;
  const sw = pageWidth * dpr;
  const sh = pageHeight * dpr;

  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;

  const ctx = out.getContext('2d');
  if (!ctx) return source;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sw, sh);
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

export function sliceCanvasPages(
  source: HTMLCanvasElement,
  pageCount: number,
  pageWidth: number = PAGE_WIDTH,
  pageHeight: number = PAGE_HEIGHT
): HTMLCanvasElement[] {
  return Array.from({ length: pageCount }, (_, pageIndex) =>
    sliceCanvasPage(source, pageIndex, pageWidth, pageHeight)
  );
}

export function scaleCanvas(
  source: HTMLCanvasElement,
  dpi: number,
  logicalWidth: number,
  logicalHeight: number
): HTMLCanvasElement {
  const scale = dpi / 96;
  const out = document.createElement('canvas');
  out.width = Math.round(logicalWidth * scale);
  out.height = Math.round(logicalHeight * scale);

  const ctx = out.getContext('2d');
  if (!ctx) return source;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}
