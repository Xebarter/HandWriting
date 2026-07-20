import { PAGE_HEIGHT } from './document-constants';
import { RuledFontMetrics } from './font-metrics';
import { pageContentArea, PageContentArea } from './page-margins';
import { PlacedLine, WorksheetTextLayout } from './text-line-layout';

/** Top + baseline — darkest tier for print */
export const RULED_LINE_STRONG_COLOR = '#0F2D5C';
export const RULED_LINE_STRONG_WIDTH = 1;
/** x-height line — muted and low-contrast vs cap/baseline */
export const RULED_LINE_MID_COLOR = '#9BB8E8';
export const RULED_LINE_MID_WIDTH = 0.75;
export const RULED_LINE_MID_OPACITY = 0.32;

export interface RuledRowGuide {
  topY: number;
  /** x-height line — between cap line and baseline, not the geometric center */
  midY: number;
  baselineY: number;
}

/** Three ruled guides for one text row from measured font metrics. */
export function ruledRowGuide(
  baselineY: number,
  capAscent: number,
  xAscent: number
): RuledRowGuide {
  return {
    topY: baselineY - capAscent,
    midY: baselineY - xAscent,
    baselineY,
  };
}

function strokeHorizontalInArea(
  ctx: CanvasRenderingContext2D,
  y: number,
  area: PageContentArea,
  color: string,
  lineWidth: number,
  opacity = 1
) {
  if (y < area.top || y > area.bottom) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = opacity;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(area.left, y);
  ctx.lineTo(area.right, y);
  ctx.stroke();
  ctx.restore();
}

/** Draw one ruled trio: top + baseline strong, middle faint — clipped to the margin box. */
export function drawRuledRowLines(
  ctx: CanvasRenderingContext2D,
  guide: RuledRowGuide,
  area: PageContentArea
) {
  strokeHorizontalInArea(
    ctx,
    guide.topY,
    area,
    RULED_LINE_STRONG_COLOR,
    RULED_LINE_STRONG_WIDTH
  );

  strokeHorizontalInArea(
    ctx,
    guide.midY,
    area,
    RULED_LINE_MID_COLOR,
    RULED_LINE_MID_WIDTH,
    RULED_LINE_MID_OPACITY
  );

  strokeHorizontalInArea(
    ctx,
    guide.baselineY,
    area,
    RULED_LINE_STRONG_COLOR,
    RULED_LINE_STRONG_WIDTH
  );
}

/** Short local guides beside a single letter (guide-lines / arrow-guides modes). */
export function drawLetterGuideLines(
  ctx: CanvasRenderingContext2D,
  x: number,
  guide: RuledRowGuide,
  span: number
) {
  const lines: Array<{ y: number; faint: boolean }> = [
    { y: guide.topY, faint: false },
    { y: guide.midY, faint: true },
    { y: guide.baselineY, faint: false },
  ];

  for (const line of lines) {
    ctx.save();
    ctx.strokeStyle = line.faint ? RULED_LINE_MID_COLOR : RULED_LINE_STRONG_COLOR;
    ctx.globalAlpha = line.faint ? RULED_LINE_MID_OPACITY : 1;
    ctx.lineWidth = line.faint ? RULED_LINE_MID_WIDTH : RULED_LINE_STRONG_WIDTH;
    ctx.beginPath();
    ctx.moveTo(x - 12, line.y);
    ctx.lineTo(x + span, line.y);
    ctx.stroke();
    ctx.restore();
  }
}

export interface LineRowMetrics {
  capAscent: number;
  xAscent: number;
  lineHeight: number;
}

/** Per-row cap / x-height metrics from layout (inherits above for empty rows). */
export function lineRowMetrics(
  layout: WorksheetTextLayout,
  line: PlacedLine
): LineRowMetrics {
  if (line.lineSpacing > 0 && line.capAscent > 0 && line.xAscent > 0) {
    return {
      capAscent: line.capAscent,
      xAscent: line.xAscent,
      lineHeight: line.lineSpacing,
    };
  }

  const lineChars = layout.chars.filter((char) => char.lineIndex === line.lineIndex);

  if (lineChars.length === 0) {
    return {
      capAscent: layout.metrics.capAscent,
      xAscent: layout.metrics.xAscent,
      lineHeight: layout.lineHeight,
    };
  }

  let capAscent = 0;
  let xAscent = 0;
  let lineHeight = 0;

  for (const char of lineChars) {
    capAscent = Math.max(capAscent, char.capAscent);
    xAscent = Math.max(xAscent, char.xAscent);
    lineHeight = Math.max(lineHeight, char.fontSize);
  }

  return { capAscent, xAscent, lineHeight };
}

/**
 * Metrics for empty ruled rows below the last line of text. Spacing follows the
 * rhythm of lines above on the page; it only grows when the last line has text
 * larger than the document default.
 */
export function trailingRowMetrics(
  linesOnPage: PlacedLine[],
  layout: WorksheetTextLayout
): LineRowMetrics {
  const lastLine = linesOnPage[linesOnPage.length - 1];
  const lastRow = lineRowMetrics(layout, lastLine);

  let referenceSpacing = layout.lineHeight;
  if (linesOnPage.length >= 2) {
    const prevLine = linesOnPage[linesOnPage.length - 2];
    referenceSpacing = lastLine.baselineY - prevLine.baselineY;
  }

  const spacing = Math.max(referenceSpacing, lastRow.lineHeight);

  if (lastRow.lineHeight > layout.lineHeight) {
    return {
      capAscent: lastRow.capAscent,
      xAscent: lastRow.xAscent,
      lineHeight: spacing,
    };
  }

  return {
    capAscent: layout.metrics.capAscent,
    xAscent: layout.metrics.xAscent,
    lineHeight: spacing,
  };
}

/**
 * Draw ruled rows aligned to laid-out text. Each row's middle line sits at
 * x-height (dynamic per line); top and baseline stay strong, middle stays faint.
 */
export function drawRuledLinesFromLayout(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layout: WorksheetTextLayout,
  fallbackMetrics: RuledFontMetrics
) {
  const pageCount = Math.max(1, Math.ceil(height / PAGE_HEIGHT));
  const margin = layout.margin;
  const fallbackCap = fallbackMetrics.capAscent;
  const fallbackX = fallbackMetrics.xAscent;
  const fallbackRowHeight = fallbackMetrics.ruledHeight;
  const fallbackLineHeight = fallbackMetrics.lineHeight;

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageTop = pageIndex * PAGE_HEIGHT;
    const pageBottom = Math.min(height, pageTop + PAGE_HEIGHT);
    const area = pageContentArea(pageTop, pageBottom, width, margin);
    const linesOnPage = layout.lines
      .filter((line) => line.pageIndex === pageIndex)
      .sort((a, b) => a.baselineY - b.baselineY);

    for (const line of linesOnPage) {
      const row = lineRowMetrics(layout, line);
      const guide = ruledRowGuide(line.baselineY, row.capAscent, row.xAscent);
      if (guide.topY > area.bottom) continue;
      drawRuledRowLines(ctx, guide, area);
    }

    if (linesOnPage.length === 0) {
      for (
        let baselineY = area.top + fallbackRowHeight;
        baselineY <= area.bottom;
        baselineY += fallbackLineHeight
      ) {
        const guide = ruledRowGuide(baselineY, fallbackCap, fallbackX);
        if (guide.topY < area.top) continue;
        drawRuledRowLines(ctx, guide, area);
      }
      continue;
    }

    const lastLine = linesOnPage[linesOnPage.length - 1];
    const trailingRow = trailingRowMetrics(linesOnPage, layout);
    for (
      let baselineY = lastLine.baselineY + trailingRow.lineHeight;
      baselineY <= area.bottom;
      baselineY += trailingRow.lineHeight
    ) {
      const guide = ruledRowGuide(baselineY, trailingRow.capAscent, trailingRow.xAscent);
      if (guide.topY < area.top) continue;
      drawRuledRowLines(ctx, guide, area);
    }
  }
}
