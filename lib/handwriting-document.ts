import { DEFAULT_FONT_SIZE } from '@/lib/document-constants';
import { DEFAULT_FONT_FAMILY } from '@/lib/font-preference';
import {
  HandwritingMode,
  LetterConnection,
  PaperType,
  TextStyleRange,
} from '@/lib/types';

export const DOCUMENT_VERSION = 1 as const;
export const DEFAULT_DOCUMENT_TITLE = 'Untitled Document';

export interface HandwritingDocument {
  version: typeof DOCUMENT_VERSION;
  title: string;
  text: string;
  mode: HandwritingMode;
  fontSize: number;
  dotSpacing: number;
  strokeWidth: number;
  paperType: PaperType;
  showGuides: boolean;
  showStrokeOrder: boolean;
  selectedFont: string;
  selectedFontId?: string;
  textColor: string;
  textAlign: 'left' | 'center' | 'right';
  connections: LetterConnection[];
  textStyleRanges: TextStyleRange[];
  autoLinkEnabled: boolean;
}

export interface EditorDocumentState {
  title: string;
  text: string;
  mode: HandwritingMode;
  fontSize: number;
  dotSpacing: number;
  strokeWidth: number;
  paperType: PaperType;
  showGuides: boolean;
  showStrokeOrder: boolean;
  selectedFont: string;
  selectedFontId?: string;
  textColor: string;
  textAlign: 'left' | 'center' | 'right';
  connections: LetterConnection[];
  textStyleRanges: TextStyleRange[];
  autoLinkEnabled: boolean;
}

export interface WorksheetRecord {
  id: string;
  title: string;
  file_path: string | null;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export function createDefaultEditorState(): EditorDocumentState {
  return {
    title: DEFAULT_DOCUMENT_TITLE,
    text: '',
    mode: 'solid',
    fontSize: DEFAULT_FONT_SIZE,
    dotSpacing: 8,
    strokeWidth: 2,
    paperType: 'ruled',
    showGuides: true,
    showStrokeOrder: false,
    selectedFont: DEFAULT_FONT_FAMILY,
    selectedFontId: undefined,
    textColor: '#000000',
    textAlign: 'left',
    connections: [],
    textStyleRanges: [],
    autoLinkEnabled: false,
  };
}

export function serializeDocument(state: EditorDocumentState): HandwritingDocument {
  return {
    version: DOCUMENT_VERSION,
    title: state.title.trim() || DEFAULT_DOCUMENT_TITLE,
    text: state.text,
    mode: state.mode,
    fontSize: state.fontSize,
    dotSpacing: state.dotSpacing,
    strokeWidth: state.strokeWidth,
    paperType: state.paperType,
    showGuides: state.showGuides,
    showStrokeOrder: state.showStrokeOrder,
    selectedFont: state.selectedFont,
    selectedFontId: state.selectedFontId,
    textColor: state.textColor,
    textAlign: state.textAlign,
    connections: state.connections,
    textStyleRanges: state.textStyleRanges,
    autoLinkEnabled: state.autoLinkEnabled,
  };
}

export function deserializeDocument(raw: unknown): HandwritingDocument | null {
  if (!raw || typeof raw !== 'object') return null;

  const data = raw as Partial<HandwritingDocument>;

  if (data.version !== DOCUMENT_VERSION) return null;

  return {
    version: DOCUMENT_VERSION,
    title: typeof data.title === 'string' ? data.title : DEFAULT_DOCUMENT_TITLE,
    text: typeof data.text === 'string' ? data.text : '',
    mode: (data.mode as HandwritingMode) ?? 'solid',
    fontSize: typeof data.fontSize === 'number' ? data.fontSize : DEFAULT_FONT_SIZE,
    dotSpacing: typeof data.dotSpacing === 'number' ? data.dotSpacing : 8,
    strokeWidth: typeof data.strokeWidth === 'number' ? data.strokeWidth : 2,
    paperType: (data.paperType as PaperType) ?? 'ruled',
    showGuides: data.showGuides !== false,
    showStrokeOrder: Boolean(data.showStrokeOrder),
    selectedFont: typeof data.selectedFont === 'string' ? data.selectedFont : DEFAULT_FONT_FAMILY,
    selectedFontId: typeof data.selectedFontId === 'string' ? data.selectedFontId : undefined,
    textColor: typeof data.textColor === 'string' ? data.textColor : '#000000',
    textAlign: data.textAlign === 'center' || data.textAlign === 'right' ? data.textAlign : 'left',
    connections: Array.isArray(data.connections) ? data.connections : [],
    textStyleRanges: Array.isArray(data.textStyleRanges) ? data.textStyleRanges : [],
    autoLinkEnabled: Boolean(data.autoLinkEnabled),
  };
}

export function applyDocumentToEditor(document: HandwritingDocument): EditorDocumentState {
  return {
    title: document.title,
    text: document.text,
    mode: document.mode,
    fontSize: document.fontSize,
    dotSpacing: document.dotSpacing,
    strokeWidth: document.strokeWidth,
    paperType: document.paperType,
    showGuides: document.showGuides,
    showStrokeOrder: document.showStrokeOrder,
    selectedFont: document.selectedFont,
    selectedFontId: document.selectedFontId,
    textColor: document.textColor,
    textAlign: document.textAlign,
    connections: document.connections,
    textStyleRanges: document.textStyleRanges,
    autoLinkEnabled: document.autoLinkEnabled,
  };
}

export function documentFileName(title: string): string {
  const safe = title.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
  return `${safe || 'worksheet'}.json`;
}
