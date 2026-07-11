import { PAGE_HEIGHT } from '@/lib/document-constants';
import { calculatePageHeight } from '@/lib/text-layout';
import { LetterBox } from '@/lib/types';

export interface DocumentMetrics {
  pageCount: number;
  renderedPageHeight: number;
}

export function layoutPageCount(letterLayout: LetterBox[]): number {
  if (letterLayout.length === 0) return 1;
  const maxPage = letterLayout.reduce((currentMax, box) => {
    const safePageIndex =
      typeof box.pageIndex === 'number' && Number.isFinite(box.pageIndex) ? box.pageIndex : 0;
    return Math.max(currentMax, safePageIndex);
  }, 0);
  return maxPage + 1;
}

export function computeDocumentMetrics(
  text: string,
  fontSize: number,
  letterLayout: LetterBox[]
): DocumentMetrics {
  const fromLayout = layoutPageCount(letterLayout);
  const estimatedHeight = calculatePageHeight(text, fontSize);
  const estimatedPages = Number.isFinite(estimatedHeight / PAGE_HEIGHT)
    ? Math.ceil(estimatedHeight / PAGE_HEIGHT)
    : 1;
  const pageCount = Math.max(1, estimatedPages, fromLayout);
  return {
    pageCount,
    renderedPageHeight: Math.max(PAGE_HEIGHT, pageCount * PAGE_HEIGHT),
  };
}
