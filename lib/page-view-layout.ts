import { PAGE_HEIGHT } from '@/lib/document-constants';

/** Visual gap between stacked pages in print layout (Word-style). */
export const PAGE_GAP = 20;

export function visualPageTop(pageIndex: number, zoom: number): number {
  return pageIndex * (PAGE_HEIGHT * zoom + PAGE_GAP * zoom);
}

export function visualDocumentHeight(pageCount: number, zoom: number): number {
  const safeCount = Math.max(1, pageCount);
  return safeCount * PAGE_HEIGHT * zoom + (safeCount - 1) * PAGE_GAP * zoom;
}

export function logicalYToVisualY(logicalY: number, zoom: number): number {
  const pageIndex = Math.max(0, Math.floor(logicalY / PAGE_HEIGHT));
  const localY = logicalY - pageIndex * PAGE_HEIGHT;
  return visualPageTop(pageIndex, zoom) + localY * zoom;
}

export function visualYToLogicalY(visualY: number, zoom: number, pageCount: number): number {
  if (visualY <= 0) return 0;

  const safeCount = Math.max(1, pageCount);
  let remaining = visualY;

  for (let pageIndex = 0; pageIndex < safeCount; pageIndex += 1) {
    const pageBand = PAGE_HEIGHT * zoom;
    const isLastPage = pageIndex === safeCount - 1;

    if (remaining <= pageBand || isLastPage) {
      return pageIndex * PAGE_HEIGHT + remaining / zoom;
    }

    remaining -= pageBand;
    remaining -= PAGE_GAP * zoom;
  }

  return safeCount * PAGE_HEIGHT;
}

export function getPageIndexFromLogicalY(logicalY: number): number {
  return Math.max(0, Math.floor(logicalY / PAGE_HEIGHT));
}

export function getPageIndexFromVisualY(visualY: number, zoom: number, pageCount: number): number {
  return getPageIndexFromLogicalY(visualYToLogicalY(visualY, zoom, pageCount));
}
