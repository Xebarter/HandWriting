/** US Letter page at 96 DPI */
export const PAGE_WIDTH = 816;
export const PAGE_HEIGHT = 1056;
export const PAGE_MARGIN = 96;

/** Classic worksheet margin lines — included on canvas for print/export */
export const PAGE_MARGIN_LINE_COLOR = '#d13438';
export const PAGE_MARGIN_LINE_WIDTH = 2;

/** @deprecated Use PAGE_MARGIN_LINE_COLOR */
export const LEFT_MARGIN_LINE_COLOR = PAGE_MARGIN_LINE_COLOR;
/** @deprecated Use PAGE_MARGIN_LINE_WIDTH */
export const LEFT_MARGIN_LINE_WIDTH = PAGE_MARGIN_LINE_WIDTH;

export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72] as const;

export const FONT_FAMILIES = [
  'Playwrite US Modern',
  'Georgia',
  'Times New Roman',
  'Arial',
  'Calibri',
  'Verdana',
] as const;
