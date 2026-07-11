import { PAGE_HEIGHT, PAGE_MARGIN_LINE_COLOR, PAGE_MARGIN_LINE_WIDTH } from './document-constants';

export interface PageContentArea {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Writable rectangle inside the four red margin lines on one page. */
export function pageContentArea(
  pageTop: number,
  pageBottom: number,
  width: number,
  margin: number
): PageContentArea {
  return {
    left: margin,
    right: width - margin,
    top: pageTop + margin,
    bottom: pageBottom - margin,
  };
}

/** Draw red left and right margin lines for every page on the canvas. */
export function drawPageMarginLines(
  ctx: CanvasRenderingContext2D,
  width: number,
  canvasHeight: number,
  margin: number
) {
  const pageCount = Math.max(1, Math.ceil(canvasHeight / PAGE_HEIGHT));

  ctx.save();
  ctx.strokeStyle = PAGE_MARGIN_LINE_COLOR;
  ctx.lineWidth = PAGE_MARGIN_LINE_WIDTH;
  ctx.setLineDash([]);

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageTop = pageIndex * PAGE_HEIGHT;
    const pageBottom = Math.min(canvasHeight, pageTop + PAGE_HEIGHT);
    const area = pageContentArea(pageTop, pageBottom, width, margin);

    ctx.beginPath();
    ctx.moveTo(area.left, area.top);
    ctx.lineTo(area.left, area.bottom);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(area.right, area.top);
    ctx.lineTo(area.right, area.bottom);
    ctx.stroke();
  }

  ctx.restore();
}
