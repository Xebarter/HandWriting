import { PAGE_HEIGHT, PAGE_MARGIN, PAGE_WIDTH } from './document-constants';

/** Distance between baselines — one ruled row per line */
export function getLineHeight(fontSize: number): number {
  return fontSize;
}

/** @deprecated Enter now advances one ruled row; kept for compatibility */
export function getEnterGap(fontSize: number): number {
  return 0;
}

/** Height of one ruled trio (top line → baseline) */
export function getRuledRowHeight(fontSize: number): number {
  return fontSize;
}

export function getFirstBaseline(fontSize: number, margin: number = PAGE_MARGIN): number {
  return margin + fontSize;
}

/** How many ruled rows are needed to cover a given page height */
export function ruledRowsForHeight(
  height: number,
  fontSize: number,
  margin: number = PAGE_MARGIN
): number {
  const lineHeight = getLineHeight(fontSize);
  const firstBaseline = getFirstBaseline(fontSize, margin);
  if (height <= firstBaseline) return 1;
  return Math.ceil((height - firstBaseline) / lineHeight) + 1;
}

/** Rough line count for page height — mirrors canvas wrap logic */
export function estimateLineCount(
  text: string,
  fontSize: number,
  availableWidth: number
): number {
  if (!text) return 1;

  const avgCharWidth = fontSize * 0.48;
  let totalLines = 0;

  for (const paragraph of text.split('\n')) {
    if (paragraph === '') {
      totalLines += 1;
      continue;
    }

    const words = paragraph.split(' ');
    let lineLen = 0;
    let lines = 1;

    for (const word of words) {
      const wordWidth = word.length * avgCharWidth;
      const gap = lineLen > 0 ? avgCharWidth : 0;
      if (lineLen + gap + wordWidth > availableWidth && lineLen > 0) {
        lines += 1;
        lineLen = wordWidth;
      } else {
        lineLen += gap + wordWidth;
      }
    }

    totalLines += lines;
  }

  return Math.max(totalLines, 1);
}

/** Page height snapped so ruled lines fill edge-to-edge with no gaps */
export function calculatePageHeight(text: string, fontSize: number): number {
  const lineHeight = getLineHeight(fontSize);
  const firstBaseline = getFirstBaseline(fontSize);
  const availableWidth = PAGE_WIDTH - PAGE_MARGIN * 2;
  const textLines = estimateLineCount(text, fontSize, availableWidth);

  const rowsForText = Math.max(textLines, 1);
  const rowsPerPage = ruledRowsForHeight(PAGE_HEIGHT, fontSize);
  const pages = Math.max(1, Math.ceil(rowsForText / rowsPerPage));

  return pages * PAGE_HEIGHT;
}

export const RULER_INCH_PX = 96;
export const PAGE_INCHES_W = PAGE_WIDTH / RULER_INCH_PX;
export const PAGE_INCHES_H = PAGE_HEIGHT / RULER_INCH_PX;
