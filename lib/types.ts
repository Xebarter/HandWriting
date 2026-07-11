// Handwriting engine types and interfaces

export type HandwritingMode = 'dotted' | 'outline' | 'solid' | 'guide-lines' | 'arrow-guides';
export type PaperType = 'blank' | 'ruled' | 'grid';

export interface GlyphInfo {
  path: string; // SVG path data
  x: number; // x position
  y: number; // y position
  width: number;
  height: number;
  advance: number; // advance width for text flow
  char: string;
}

export interface LetterPattern {
  glyphInfo: GlyphInfo;
  dots?: DotPattern;
  outline?: OutlinePattern;
  guides?: GuidePattern;
}

export interface DotPattern {
  dots: Array<{ x: number; y: number }>;
  spacing: number;
}

export interface OutlinePattern {
  path: string; // SVG path
  strokeWidth: number;
}

export interface GuidePattern {
  baselinePath: string;
  xHeightPath: string;
  strokeOrder?: number;
  arrowPath?: string;
}

export interface HandwritingEngineOptions {
  fontSize?: number;
  dotSpacing?: number;
  strokeWidth?: number;
  letterSpacing?: number;
  lineHeight?: number;
  mode?: HandwritingMode;
  paperType?: PaperType;
  showGuides?: boolean;
  showStrokeOrder?: boolean;
  enableLigatures?: boolean;
  enableContextualAlternates?: boolean;
}

export interface CanvasRenderOptions extends HandwritingEngineOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  textColor?: string;
  dotColor?: string;
  guideColor?: string;
}

export interface ExportOptions {
  format: 'pdf' | 'png' | 'svg' | 'docx';
  dpi?: number;
  pageSize?: 'A4' | 'letter' | 'custom';
  pageWidth?: number;
  pageHeight?: number;
  filename?: string;
  contentWidthMm?: number;
  contentHeightMm?: number;
  horizontalAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  fullBleed?: boolean;
}

export interface ShapedGlyph {
  codepoint: number;
  cluster: number;
  mask: number;
  infos: Array<{
    codepoint: number;
    cluster: number;
    mask: number;
  }>;
  positions: Array<{
    x_advance: number;
    y_advance: number;
    x_offset: number;
    y_offset: number;
  }>;
}

// Font Management Types
export type FontSource = 'system' | 'uploaded' | 'google';
export type FontStyle = 'normal' | 'italic' | 'bold' | 'bold-italic';

export interface FontMetadata {
  id: string;
  name: string;
  family: string;
  style: FontStyle;
  source: FontSource;
  fileSize: number;
  uploadedAt: Date;
  /** Supabase storage object path */
  filePath?: string;
  data?: ArrayBuffer;
  previewUrl?: string;
}

export interface FontFamily {
  id: string;
  name: string;
  variants: FontMetadata[];
}

// Drawing Types
export interface Point {
  x: number;
  y: number;
  pressure?: number;
  timestamp: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  opacity: number;
  timestamp: number;
  toolType: 'pen' | 'pencil' | 'marker' | 'eraser';
}

export interface ConnectionPoint {
  x: number;
  y: number;
}

export interface LetterConnection {
  id: string;
  fromCharIndex: number;
  toCharIndex: number;
  points: ConnectionPoint[];
  color: string;
  width: number;
  source: 'manual' | 'auto';
  patternStyle?: 'training';
  mode?: HandwritingMode;
}

export interface TextStyleRange {
  start: number;
  end: number;
  mode?: HandwritingMode;
  linksEnabled?: boolean;
  fontSize?: number;
}

export interface LetterBox {
  charIndex: number;
  char: string;
  x: number;
  baselineY: number;
  width: number;
  ascent: number;
  descent: number;
  top: number;
  bottom: number;
  centerX: number;
  lineIndex: number;
  paragraphIndex: number;
  pageIndex?: number;
  /** Point on the glyph ink where an incoming connector should land */
  entryAnchor?: { x: number; y: number };
  /** Point on the glyph ink where an outgoing connector should start */
  exitAnchor?: { x: number; y: number };
}

export interface DrawingContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  strokes: Stroke[];
  undoStack: Stroke[][];
  redoStack: Stroke[][];
  isDrawing: boolean;
  currentStroke: Stroke | null;
}

// Tracing Types
export interface TracingGuide {
  id: string;
  text: string;
  fontSize: number;
  dottedPath: string;
  guidePoints: Point[];
  tolerance: number;
}

export interface TracingResult {
  accuracy: number;
  isCorrect: boolean;
  feedback: string;
}

// Copy Writing Types
export interface CopyExercise {
  id: string;
  text: string;
  lines: string[];
  currentLineIndex: number;
  completed: boolean;
}

export interface CopyMetrics {
  totalLines: number;
  completedLines: number;
  accuracy: number;
  timeSpent: number;
}

// Image Types
export interface ImageAsset {
  id: string;
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  opacity: number;
}

// Layout Types
export type PageTemplate = 'single-line' | 'double-line' | 'triple-line' | 'grid' | 'boxes' | 'blank' | 'custom';
export type PaperSize = 'A4' | 'letter' | 'custom';
export type Orientation = 'portrait' | 'landscape';

export interface LayoutConfig {
  template: PageTemplate;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  lineSpacing: number;
  boxSize?: number;
  paperSize: PaperSize;
  orientation: Orientation;
  backgroundColor: string;
  lineColor: string;
}

export interface WorksheetPage {
  id: string;
  layout: LayoutConfig;
  text?: string;
  font?: FontMetadata;
  fontSize: number;
  images: ImageAsset[];
  drawings: Stroke[];
  pageNumber: number;
}

export interface Worksheet {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  pages: WorksheetPage[];
  metadata: {
    gradeLevel: 'nursery' | 'reception' | 'year1' | 'year2';
    subject?: string;
    tags?: string[];
  };
}

// PDF Export Types
export interface PDFExportConfig {
  fileName: string;
  pageSize: PaperSize;
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  includePageNumbers: boolean;
  watermark?: string;
  dpi: number;
}
