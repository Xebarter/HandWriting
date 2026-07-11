'use client';

import React, { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { HandwritingCanvas } from '@/components/HandwritingCanvas';
import { HandwritingMode, PaperType, LetterConnection } from '@/lib/types';
import { PAGE_WIDTH, PAGE_MARGIN, PAGE_HEIGHT } from '@/lib/document-constants';
import {
  RULER_INCH_PX,
  PAGE_INCHES_W,
} from '@/lib/text-layout';
import { estimateRuledFont, roundPx, RuledFontMetrics } from '@/lib/font-metrics';
import { useRuledFontMetrics } from '@/lib/hooks/use-ruled-font-metrics';
import { measureLetterLayout } from '@/lib/letter-layout';
import { LetterBox } from '@/lib/types';
import { LetterConnectionLayer } from '@/components/LetterConnectionLayer';
import { ConnectionRenderLayer } from '@/components/ConnectionRenderLayer';
import { cn } from '@/lib/utils';
import {
  getPageIndexFromLogicalY,
  logicalYToVisualY,
  visualDocumentHeight,
  visualPageTop,
  visualYToLogicalY,
} from '@/lib/page-view-layout';
import { computeDocumentMetrics } from '@/lib/document-metrics';
import { getEditorStoredText, setEditorPlainText } from '@/lib/editor-page-sync';
import {
  applyEditorCommand,
  clampRange,
  normalizeEditorText,
  rangeBounds,
  rangesEqual,
  TextRange,
} from '@/lib/editor-input';
import {
  caretPositionFromLayout,
  measureWorksheetLayout,
  WorksheetTextLayout,
} from '@/lib/text-line-layout';
import {
  lineEndOffset,
  lineStartOffset,
  moveVertical,
  wordLeft,
  wordRight,
} from '@/lib/editor-navigation';
import { EditKind, UndoHistory } from '@/lib/undo-history';

type SelectionRect = { left: number; top: number; width: number; height: number };

function getWordBounds(text: string, index: number): { start: number; end: number } {
  const clamped = Math.max(0, Math.min(index, text.length));
  let start = clamped;
  let end = clamped;

  while (start > 0 && /\S/.test(text[start - 1])) start -= 1;
  while (end < text.length && /\S/.test(text[end])) end += 1;

  return { start, end };
}

function getParagraphBounds(text: string, index: number): { start: number; end: number } {
  const clamped = Math.max(0, Math.min(index, text.length));
  const start = text.lastIndexOf('\n', clamped - 1) + 1;
  const nextNewline = text.indexOf('\n', clamped);
  const end = nextNewline === -1 ? text.length : nextNewline;
  return { start, end };
}

export interface EditorSelectionOffsets {
  start: number;
  end: number;
}

export interface EditorActions {
  selectAll: () => void;
}

interface DocumentWorkspaceProps {
  text: string;
  onTextChange: (text: string) => void;
  mode: HandwritingMode;
  fontSize: number;
  dotSpacing: number;
  strokeWidth: number;
  paperType: PaperType;
  showGuides: boolean;
  showStrokeOrder: boolean;
  selectedFont: string;
  textColor: string;
  textAlign: 'left' | 'center' | 'right';
  zoom: number;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  editorRef: React.RefObject<HTMLDivElement | null>;
  connections: LetterConnection[];
  onConnectionsChange: (connections: LetterConnection[]) => void;
  connectMode: boolean;
  connectionColor: string;
  connectionWidth: number;
  onLetterLayoutChange?: (layout: LetterBox[], fontMetrics: RuledFontMetrics) => void;
  getCharMode?: (charIndex: number) => HandwritingMode;
  getCharFontSize?: (charIndex: number) => number;
  onActivePageChange?: (activePage: number, pageCount: number) => void;
  onDocumentMetricsChange?: (metrics: { pageCount: number; renderedPageHeight: number }) => void;
  onSelectionChange?: (selection: EditorSelectionOffsets) => void;
  registerEditorActions?: (actions: EditorActions) => void;
}

export const DocumentWorkspace: React.FC<DocumentWorkspaceProps> = ({
  text,
  onTextChange,
  mode,
  fontSize,
  dotSpacing,
  strokeWidth,
  paperType,
  showGuides,
  showStrokeOrder,
  selectedFont,
  textColor,
  textAlign,
  zoom,
  canvasRef,
  editorRef,
  connections,
  onConnectionsChange,
  connectMode,
  connectionColor,
  connectionWidth,
  onLetterLayoutChange,
  getCharMode,
  getCharFontSize,
  onActivePageChange,
  onDocumentMetricsChange,
  onSelectionChange,
  registerEditorActions,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [selection, setSelection] = useState<TextRange>({ anchor: 0, focus: 0 });
  const [activePage, setActivePage] = useState(1);

  const pageStackRef = useRef<HTMLDivElement>(null);
  const pageSurfaceRef = useRef<HTMLDivElement>(null);
  const pointerDragRef = useRef<{ anchor: number } | null>(null);
  const isComposingRef = useRef(false);
  const preferredXRef = useRef<number | null>(null);
  const historyRef = useRef(new UndoHistory());
  const autoScrollRef = useRef(false);
  const lastCommittedTextRef = useRef(text);
  const textRef = useRef(text);
  const selectionRef = useRef(selection);
  const lastEditKeyRef = useRef<{ key: string; time: number } | null>(null);
  const lastReportedSelectionRef = useRef<{ start: number; end: number } | null>(null);

  textRef.current = text;
  selectionRef.current = selection;

  const ssrFontMetrics = useMemo(
    () => estimateRuledFont(selectedFont, fontSize),
    [selectedFont, fontSize]
  );
  const clientFontMetrics = useRuledFontMetrics(selectedFont, fontSize);
  const fontMetrics = isClient ? clientFontMetrics : ssrFontMetrics;

  useEffect(() => {
    setIsClient(true);
  }, []);

  const layoutOptions = useMemo(
    () => ({
      text,
      mode,
      fontSize,
      dotSpacing,
      strokeWidth,
      textColor,
      dotColor: '#9aa0a6',
      font: selectedFont,
      maxWidth: PAGE_WIDTH,
      textAlign,
      margin: PAGE_MARGIN,
      fontMetrics,
      getCharMode,
      getCharFontSize,
    }),
    [
      text,
      mode,
      fontSize,
      dotSpacing,
      strokeWidth,
      textColor,
      selectedFont,
      textAlign,
      fontMetrics,
      getCharMode,
      getCharFontSize,
    ]
  );

  const letterLayout = useMemo(
    () => (isClient ? measureLetterLayout(layoutOptions) : []),
    [isClient, layoutOptions]
  );

  const worksheetLayout = useMemo<WorksheetTextLayout | null>(
    () => (isClient ? measureWorksheetLayout(layoutOptions) : null),
    [isClient, layoutOptions]
  );

  const isEmpty = !text.trim();
  const documentMetrics = useMemo(
    () => computeDocumentMetrics(text, fontSize, letterLayout),
    [fontSize, letterLayout, text]
  );
  const { pageCount, renderedPageHeight } = documentMetrics;

  const onDocumentMetricsChangeRef = useRef(onDocumentMetricsChange);
  onDocumentMetricsChangeRef.current = onDocumentMetricsChange;

  useEffect(() => {
    onDocumentMetricsChangeRef.current?.(documentMetrics);
  }, [documentMetrics]);

  const onActivePageChangeRef = useRef(onActivePageChange);
  onActivePageChangeRef.current = onActivePageChange;

  useEffect(() => {
    onActivePageChangeRef.current?.(activePage, pageCount);
  }, [activePage, pageCount]);

  const onLetterLayoutChangeRef = useRef(onLetterLayoutChange);
  onLetterLayoutChangeRef.current = onLetterLayoutChange;

  useEffect(() => {
    if (!isClient) return;
    onLetterLayoutChangeRef.current?.(letterLayout, fontMetrics);
  }, [isClient, letterLayout, fontMetrics]);

  useEffect(() => {
    if (!isClient) return;
    editorRef.current?.focus();
  }, [editorRef, isClient]);

  // ------------------------------------------------------------------
  // Selection state is the single source of truth (Google Docs model).
  // ------------------------------------------------------------------

  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  useEffect(() => {
    const { start, end } = rangeBounds(selection);
    const last = lastReportedSelectionRef.current;
    if (last && last.start === start && last.end === end) return;
    lastReportedSelectionRef.current = { start, end };
    onSelectionChangeRef.current?.({ start, end });
  }, [selection]);

  useEffect(() => {
    registerEditorActions?.({
      selectAll: () => {
        historyRef.current.breakCoalescing();
        preferredXRef.current = null;
        setSelection({ anchor: 0, focus: text.length });
      },
    });
  }, [registerEditorActions, text.length]);

  // External text changes (open document, toolbar transforms): clamp the
  // selection and reset the undo history so Ctrl+Z can't cross documents.
  useEffect(() => {
    if (text === lastCommittedTextRef.current) return;
    lastCommittedTextRef.current = text;
    historyRef.current = new UndoHistory();
    preferredXRef.current = null;
    setSelection((current) => clampRange(current, text.length));
  }, [text]);

  // Mirror the text into the capture element (it never owns the content).
  useEffect(() => {
    if (!isClient || isComposingRef.current) return;
    const editor = editorRef.current;
    if (!editor) return;
    if (getEditorStoredText(editor) !== text) {
      setEditorPlainText(editor, text);
    }
  }, [editorRef, isClient, text]);

  // Keep a collapsed DOM caret near the logical caret so IME popups appear
  // in the right place. The DOM selection is never read back.
  useEffect(() => {
    if (!isClient || !isFocused || isComposingRef.current) return;
    const editor = editorRef.current;
    if (!editor || document.activeElement !== editor) return;
    const domSelection = window.getSelection();
    if (!domSelection) return;

    const limit = getEditorStoredText(editor).length;
    let remaining = Math.max(0, Math.min(selection.focus, limit));
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    let lastNode: Node | null = null;

    while (node) {
      const length = node.textContent?.length ?? 0;
      lastNode = node;
      if (remaining <= length) {
        try {
          domSelection.collapse(node, remaining);
        } catch {
          // Ignore: DOM caret is cosmetic only.
        }
        return;
      }
      remaining -= length;
      node = walker.nextNode();
    }

    try {
      if (lastNode) {
        domSelection.collapse(lastNode, lastNode.textContent?.length ?? 0);
      } else {
        domSelection.collapse(editor, 0);
      }
    } catch {
      // Ignore: DOM caret is cosmetic only.
    }
  }, [editorRef, isClient, isFocused, selection.focus, text]);

  // ------------------------------------------------------------------
  // Caret + selection visuals, derived from the layout engine.
  // ------------------------------------------------------------------

  const caretRect = useMemo(() => {
    if (!isClient || !isFocused || connectMode || !worksheetLayout) return null;
    if (selection.anchor !== selection.focus) return null;

    const offset = Math.max(0, Math.min(selection.focus, text.length));
    const position = caretPositionFromLayout(worksheetLayout, offset);
    const atChar = worksheetLayout.chars.find((char) => char.charIndex === offset);
    const prevChar = [...worksheetLayout.chars]
      .reverse()
      .find((char) => char.charIndex < offset);
    const metricsChar = atChar ?? prevChar;
    const capAscent = metricsChar?.capAscent ?? fontMetrics.capAscent;
    const renderFontSize = metricsChar?.renderSize ?? fontMetrics.renderFontSize;
    const top = position.baselineY - capAscent;
    const height = Math.max(renderFontSize, capAscent);

    if (![position.x, top, height].every(Number.isFinite)) return null;
    return { left: position.x, top, height };
  }, [
    connectMode,
    fontMetrics.capAscent,
    fontMetrics.renderFontSize,
    isClient,
    isFocused,
    selection,
    text.length,
    worksheetLayout,
  ]);

  const selectionRects = useMemo((): SelectionRect[] => {
    if (!isClient || selection.anchor === selection.focus) return [];

    const { start, end } = rangeBounds(selection);
    const selected = letterLayout
      .filter((box) => box.charIndex >= start && box.charIndex < end)
      .sort((a, b) => a.charIndex - b.charIndex);

    if (selected.length === 0) return [];

    const lines = new Map<string, LetterBox[]>();
    for (const box of selected) {
      const key = `${box.pageIndex ?? 0}:${box.lineIndex}`;
      const existing = lines.get(key);
      if (existing) {
        existing.push(box);
      } else {
        lines.set(key, [box]);
      }
    }

    return [...lines.values()].map((line) => {
      const first = line[0];
      const last = line[line.length - 1];
      const lineCapAscent = Math.max(...line.map((box) => box.ascent));
      const lineRenderSize = Math.max(...line.map((box) => box.ascent + box.descent));
      return {
        left: first.x,
        top: first.baselineY - lineCapAscent,
        width: Math.max(2, last.x + last.width - first.x),
        height: Math.max(lineRenderSize, lineCapAscent),
      };
    });
  }, [
    isClient,
    letterLayout,
    selection,
  ]);

  const scrollCaretIntoView = useCallback(
    (rect: { left: number; top: number; height: number }) => {
      const workspace = pageStackRef.current?.closest('.word-workspace') as HTMLElement | null;
      const pageStack = pageStackRef.current;
      if (!workspace || !pageStack) return;

      const stackRect = pageStack.getBoundingClientRect();
      const caretTop = stackRect.top + logicalYToVisualY(rect.top, zoom);
      const caretBottom = caretTop + rect.height * zoom;
      const workspaceRect = workspace.getBoundingClientRect();
      const margin = 72;

      if (caretTop < workspaceRect.top + margin) {
        workspace.scrollTop += caretTop - workspaceRect.top - margin;
      } else if (caretBottom > workspaceRect.bottom - margin) {
        workspace.scrollTop += caretBottom - workspaceRect.bottom + margin;
      }
    },
    [zoom]
  );

  // Report the active page and auto-scroll after keyboard-driven moves.
  useEffect(() => {
    if (!isClient || !worksheetLayout) return;

    const offset = Math.max(0, Math.min(selection.focus, text.length));
    const position = caretPositionFromLayout(worksheetLayout, offset);
    const page = getPageIndexFromLogicalY(position.baselineY) + 1;
    setActivePage((current) => (current === page ? current : page));

    if (autoScrollRef.current) {
      autoScrollRef.current = false;
      const atChar = worksheetLayout.chars.find((char) => char.charIndex === offset);
      const prevChar = [...worksheetLayout.chars]
        .reverse()
        .find((char) => char.charIndex < offset);
      const metricsChar = atChar ?? prevChar;
      const capAscent = metricsChar?.capAscent ?? fontMetrics.capAscent;
      const renderFontSize = metricsChar?.renderSize ?? fontMetrics.renderFontSize;
      const top = position.baselineY - capAscent;
      const height = Math.max(renderFontSize, capAscent);
      scrollCaretIntoView({ left: position.x, top, height });
    }
  }, [
    fontMetrics.capAscent,
    fontMetrics.renderFontSize,
    isClient,
    scrollCaretIntoView,
    selection,
    text.length,
    worksheetLayout,
  ]);

  // ------------------------------------------------------------------
  // Editing commands (single path for typing, Enter, deletes, paste).
  // ------------------------------------------------------------------

  const shouldAcceptEdit = useCallback((editKey: string) => {
    const now = Date.now();
    const last = lastEditKeyRef.current;
    if (last && last.key === editKey && now - last.time < 50) {
      return false;
    }
    lastEditKeyRef.current = { key: editKey, time: now };
    return true;
  }, []);

  const commitEdit = useCallback(
    (result: { text: string; range: TextRange }, kind: EditKind) => {
      const currentText = textRef.current;
      const currentSelection = selectionRef.current;
      const nextText = normalizeEditorText(result.text);
      const nextRange = clampRange(result.range, nextText.length);

      historyRef.current.record({ text: currentText, selection: currentSelection }, kind);
      lastCommittedTextRef.current = nextText;
      autoScrollRef.current = true;
      preferredXRef.current = null;
      setSelection((current) => (rangesEqual(current, nextRange) ? current : nextRange));
      if (nextText !== currentText) {
        onTextChange(nextText);
      }
    },
    [onTextChange]
  );

  const runCommand = useCallback(
    (
      command: Parameters<typeof applyEditorCommand>[2],
      kind: EditKind,
      rangeOverride?: TextRange
    ) => {
      const result = applyEditorCommand(
        textRef.current,
        rangeOverride ?? selectionRef.current,
        command
      );
      if (!result) return false;
      commitEdit(result, kind);
      return true;
    },
    [commitEdit]
  );

  const moveSelection = useCallback(
    (anchor: number, focus: number, { autoScroll = true } = {}) => {
      historyRef.current.breakCoalescing();
      preferredXRef.current = null;
      autoScrollRef.current = autoScroll;
      const nextRange = clampRange({ anchor, focus }, textRef.current.length);
      setSelection((current) => (rangesEqual(current, nextRange) ? current : nextRange));
    },
    []
  );

  const doUndo = useCallback(() => {
    const entry = historyRef.current.undo({ text: textRef.current, selection: selectionRef.current });
    if (!entry) return;
    lastCommittedTextRef.current = entry.text;
    autoScrollRef.current = true;
    preferredXRef.current = null;
    const nextRange = clampRange(entry.selection, entry.text.length);
    setSelection((current) => (rangesEqual(current, nextRange) ? current : nextRange));
    if (entry.text !== textRef.current) {
      onTextChange(entry.text);
    }
  }, [onTextChange]);

  const doRedo = useCallback(() => {
    const entry = historyRef.current.redo({ text: textRef.current, selection: selectionRef.current });
    if (!entry) return;
    lastCommittedTextRef.current = entry.text;
    autoScrollRef.current = true;
    preferredXRef.current = null;
    const nextRange = clampRange(entry.selection, entry.text.length);
    setSelection((current) => (rangesEqual(current, nextRange) ? current : nextRange));
    if (entry.text !== textRef.current) {
      onTextChange(entry.text);
    }
  }, [onTextChange]);

  // ------------------------------------------------------------------
  // Keyboard input.
  // ------------------------------------------------------------------

  const handleEditorKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isComposingRef.current) return;

      const key = event.key;
      const ctrl = event.ctrlKey || event.metaKey;
      const shift = event.shiftKey;
      const lower = key.toLowerCase();
      const collapsed = selection.anchor === selection.focus;

      if (ctrl && !shift && lower === 'z') {
        event.preventDefault();
        doUndo();
        return;
      }
      if (ctrl && (lower === 'y' || (shift && lower === 'z'))) {
        event.preventDefault();
        doRedo();
        return;
      }
      if (ctrl && lower === 'a') {
        event.preventDefault();
        historyRef.current.breakCoalescing();
        preferredXRef.current = null;
        setSelection({ anchor: 0, focus: text.length });
        return;
      }
      // Native clipboard events and app-level shortcuts (save, print).
      if (ctrl && ['c', 'x', 'v', 's', 'p'].includes(lower)) return;

      if (key === 'Enter') {
        event.preventDefault();
        runCommand({ type: 'insertParagraph' }, 'paragraph');
        return;
      }

      if (key === 'Backspace') {
        event.preventDefault();
        if (ctrl && collapsed) {
          const boundary = wordLeft(text, selection.focus);
          if (boundary !== selection.focus) {
            runCommand({ type: 'deleteBackward' }, 'other', {
              anchor: boundary,
              focus: selection.focus,
            });
          }
        } else {
          runCommand({ type: 'deleteBackward' }, 'delete');
        }
        return;
      }

      if (key === 'Delete') {
        event.preventDefault();
        if (ctrl && collapsed) {
          const boundary = wordRight(text, selection.focus);
          if (boundary !== selection.focus) {
            runCommand({ type: 'deleteForward' }, 'other', {
              anchor: selection.focus,
              focus: boundary,
            });
          }
        } else {
          runCommand({ type: 'deleteForward' }, 'delete');
        }
        return;
      }

      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        event.preventDefault();
        const direction = key === 'ArrowLeft' ? -1 : 1;
        let target: number;

        if (ctrl) {
          target =
            direction < 0 ? wordLeft(text, selection.focus) : wordRight(text, selection.focus);
        } else if (!shift && !collapsed) {
          const { start, end } = rangeBounds(selection);
          target = direction < 0 ? start : end;
        } else {
          target = selection.focus + direction;
        }

        moveSelection(shift ? selection.anchor : target, target);
        return;
      }

      if (key === 'ArrowUp' || key === 'ArrowDown') {
        event.preventDefault();
        if (!worksheetLayout) return;

        const direction: -1 | 1 = key === 'ArrowUp' ? -1 : 1;
        let from = selection.focus;
        if (!shift && !collapsed) {
          const { start, end } = rangeBounds(selection);
          from = direction < 0 ? start : end;
        }

        const { offset, stickyX } = moveVertical(
          worksheetLayout,
          text.length,
          from,
          direction,
          preferredXRef.current
        );

        historyRef.current.breakCoalescing();
        autoScrollRef.current = true;
        setSelection(
          clampRange({ anchor: shift ? selection.anchor : offset, focus: offset }, text.length)
        );
        preferredXRef.current = stickyX;
        return;
      }

      if (key === 'Home' || key === 'End') {
        event.preventDefault();
        let target: number;
        if (ctrl || !worksheetLayout) {
          target = key === 'Home' ? 0 : text.length;
        } else {
          target =
            key === 'Home'
              ? lineStartOffset(worksheetLayout, selection.focus)
              : lineEndOffset(worksheetLayout, selection.focus);
        }
        moveSelection(shift ? selection.anchor : target, target);
        return;
      }

      if (key === 'Tab') {
        event.preventDefault();
        return;
      }

      // Printable characters: handle directly (Google Docs model). AltGr
      // combos report ctrl+alt and fall through to the beforeinput path.
      if (key.length === 1 && !ctrl && !event.altKey) {
        event.preventDefault();
        runCommand({ type: 'insertText', text: key }, 'typing');
      }
    },
    [doRedo, doUndo, moveSelection, runCommand, selection, text, worksheetLayout]
  );

  // Native beforeinput listener: React's synthetic onBeforeInput is a
  // polyfill whose nativeEvent often lacks inputType, so we bind directly.
  const handleNativeBeforeInput = useCallback(
    (native: InputEvent) => {
      const inputType = native.inputType;

      if (isComposingRef.current || !inputType) return;
      if (inputType.startsWith('insertComposition') || inputType === 'deleteCompositionText') {
        return;
      }

      // Controlled editor: the DOM is never mutated directly.
      native.preventDefault();

      switch (inputType) {
        case 'insertText':
        case 'insertReplacementText': {
          const data =
            native.data ?? native.dataTransfer?.getData('text/plain') ?? '';
          if (data) runCommand({ type: 'insertText', text: data }, 'typing');
          break;
        }
        case 'insertParagraph':
        case 'insertLineBreak':
          runCommand({ type: 'insertParagraph' }, 'paragraph');
          break;
        case 'deleteContentBackward':
          runCommand({ type: 'deleteBackward' }, 'delete');
          break;
        case 'deleteContentForward':
          runCommand({ type: 'deleteForward' }, 'delete');
          break;
        case 'deleteByCut':
          runCommand({ type: 'deleteBackward' }, 'other');
          break;
        case 'insertFromPaste':
        case 'insertFromDrop': {
          const data =
            native.dataTransfer?.getData('text/plain') ?? native.data ?? '';
          if (
            data &&
            shouldAcceptEdit(`paste:${data}:${selectionRef.current.focus}`)
          ) {
            runCommand({ type: 'insertText', text: data }, 'paste');
          }
          break;
        }
        case 'historyUndo':
          doUndo();
          break;
        case 'historyRedo':
          doRedo();
          break;
        default:
          break;
      }
    },
    [doRedo, doUndo, runCommand, shouldAcceptEdit]
  );

  useEffect(() => {
    if (!isClient) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.addEventListener('beforeinput', handleNativeBeforeInput);
    return () => editor.removeEventListener('beforeinput', handleNativeBeforeInput);
  }, [editorRef, handleNativeBeforeInput, isClient]);

  // Safety net: if anything slips past beforeinput (odd IMEs, extensions),
  // restore the mirror so the DOM never diverges from state.
  const handleInput = useCallback(
    (event: React.FormEvent<HTMLDivElement>) => {
      if (isComposingRef.current) return;
      const editor = event.currentTarget;
      if (getEditorStoredText(editor) !== text) {
        setEditorPlainText(editor, text);
      }
    },
    [text]
  );

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(
    (event: React.CompositionEvent<HTMLDivElement>) => {
      isComposingRef.current = false;
      const data = event.data ?? '';

      // The browser inserted the composed text into the DOM directly;
      // restore the mirror, then apply the edit through the command path.
      const editor = editorRef.current;
      if (editor && getEditorStoredText(editor) !== text) {
        setEditorPlainText(editor, text);
      }
      if (data) {
        runCommand({ type: 'insertText', text: data }, 'typing');
      }
    },
    [editorRef, runCommand, text]
  );

  // ------------------------------------------------------------------
  // Clipboard.
  // ------------------------------------------------------------------

  const getSelectedText = useCallback(() => {
    const { start, end } = rangeBounds(selection);
    return text.slice(start, end);
  }, [selection, text]);

  const handleCopy = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      const selected = getSelectedText();
      if (selected) {
        event.clipboardData.setData('text/plain', selected);
      }
    },
    [getSelectedText]
  );

  const handleCut = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      const selected = getSelectedText();
      if (!selected) return;
      event.clipboardData.setData('text/plain', selected);
      runCommand({ type: 'deleteBackward' }, 'other');
    },
    [getSelectedText, runCommand]
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      const pasted = event.clipboardData.getData('text/plain');
      if (
        pasted &&
        shouldAcceptEdit(`paste:${pasted}:${selectionRef.current.focus}`)
      ) {
        runCommand({ type: 'insertText', text: pasted }, 'paste');
      }
    },
    [runCommand, shouldAcceptEdit]
  );

  // ------------------------------------------------------------------
  // Pointer selection (hit-testing against the letter layout).
  // ------------------------------------------------------------------

  const getSelectionOffsetFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      const pageStack = pageStackRef.current;
      if (!pageStack) return null;
      if (letterLayout.length === 0) return 0;

      const stackRect = pageStack.getBoundingClientRect();
      const visualX = clientX - stackRect.left;
      const visualY = clientY - stackRect.top;
      const x = visualX / zoom;
      const y = visualYToLogicalY(visualY, zoom, pageCount);

      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

      const safePageCount = Math.max(1, pageCount);
      const clickedPageIndex = Math.min(
        safePageCount - 1,
        Math.max(0, Math.floor(y / PAGE_HEIGHT))
      );
      const localPageY = y - clickedPageIndex * PAGE_HEIGHT;

      const lines = new Map<string, LetterBox[]>();
      for (const box of letterLayout) {
        const key = `${box.pageIndex ?? 0}:${box.lineIndex}`;
        const existing = lines.get(key);
        if (existing) {
          existing.push(box);
        } else {
          lines.set(key, [box]);
        }
      }

      const orderedLines = [...lines.values()]
        .map((line) => [...line].sort((a, b) => a.charIndex - b.charIndex))
        .sort((a, b) => {
          const aLocalBaseline = a[0].baselineY - (a[0].pageIndex ?? 0) * PAGE_HEIGHT;
          const bLocalBaseline = b[0].baselineY - (b[0].pageIndex ?? 0) * PAGE_HEIGHT;
          if ((a[0].pageIndex ?? 0) !== (b[0].pageIndex ?? 0)) {
            return (a[0].pageIndex ?? 0) - (b[0].pageIndex ?? 0);
          }
          return aLocalBaseline - bLocalBaseline;
        });

      const pageLines = orderedLines.filter(
        (line) => (line[0]?.pageIndex ?? 0) === clickedPageIndex
      );

      if (pageLines.length === 0) {
        const lastBoxBeforePage = [...letterLayout]
          .filter((box) => (box.pageIndex ?? 0) < clickedPageIndex)
          .sort((a, b) => a.charIndex - b.charIndex)
          .at(-1);

        if (lastBoxBeforePage) {
          return lastBoxBeforePage.charIndex + 1;
        }

        const firstBoxAfterPage = [...letterLayout]
          .filter((box) => (box.pageIndex ?? 0) > clickedPageIndex)
          .sort((a, b) => a.charIndex - b.charIndex)
          .at(0);

        if (firstBoxAfterPage) {
          return firstBoxAfterPage.charIndex;
        }

        return text.length;
      }

      const firstPageLine = pageLines[0];
      const lastPageLine = pageLines[pageLines.length - 1];
      const firstPageBaseline =
        firstPageLine[0].baselineY - (firstPageLine[0].pageIndex ?? 0) * PAGE_HEIGHT;
      const lastPageBaseline =
        lastPageLine[0].baselineY - (lastPageLine[0].pageIndex ?? 0) * PAGE_HEIGHT;

      // Header / above first line on this page
      if (localPageY < firstPageBaseline - fontMetrics.lineHeight / 2) {
        return firstPageLine[0].charIndex;
      }

      // Footer past last line: place after last char (start of next page content)
      if (localPageY > lastPageBaseline + fontMetrics.lineHeight / 2) {
        return lastPageLine[lastPageLine.length - 1].charIndex + 1;
      }

      const targetLine = pageLines.reduce<LetterBox[] | null>((closest, line) => {
        if (line.length === 0) return closest;
        if (!closest) return line;
        const lineLocalBaseline =
          line[0].baselineY - (line[0].pageIndex ?? 0) * PAGE_HEIGHT;
        const closestLocalBaseline =
          closest[0].baselineY - (closest[0].pageIndex ?? 0) * PAGE_HEIGHT;
        const currentDistance = Math.abs(lineLocalBaseline - localPageY);
        const closestDistance = Math.abs(closestLocalBaseline - localPageY);
        return currentDistance < closestDistance ? line : closest;
      }, null);

      if (!targetLine || targetLine.length === 0) {
        return lastPageLine[lastPageLine.length - 1].charIndex + 1;
      }

      const firstChar = targetLine[0];
      if (x <= firstChar.x + firstChar.width / 2) {
        return firstChar.charIndex;
      }

      for (let index = 0; index < targetLine.length; index += 1) {
        const char = targetLine[index];
        const midpoint = char.x + char.width / 2;
        if (x <= midpoint) {
          return char.charIndex;
        }
        if (index === targetLine.length - 1) {
          return char.charIndex + 1;
        }
      }

      return text.length;
    },
    [fontMetrics.lineHeight, letterLayout, pageCount, text.length, zoom]
  );

  const handleEditorMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (connectMode) return;

      const offset = getSelectionOffsetFromPoint(event.clientX, event.clientY);
      if (offset === null) return;

      editorRef.current?.focus();
      event.preventDefault();

      historyRef.current.breakCoalescing();
      preferredXRef.current = null;

      if (event.detail >= 3) {
        const { start, end } = getParagraphBounds(text, offset);
        pointerDragRef.current = null;
        setSelection({ anchor: start, focus: end });
        return;
      }

      if (event.detail === 2) {
        const { start, end } = getWordBounds(text, offset);
        pointerDragRef.current = null;
        setSelection({ anchor: start, focus: end });
        return;
      }

      const anchor = event.shiftKey ? selection.anchor : offset;
      pointerDragRef.current = { anchor };
      setSelection({ anchor, focus: offset });
    },
    [connectMode, editorRef, getSelectionOffsetFromPoint, selection.anchor, text]
  );

  const handleDocumentMouseMove = useCallback(
    (event: MouseEvent) => {
      if (connectMode) return;
      const drag = pointerDragRef.current;
      if (!drag) return;

      event.preventDefault();
      const focusOffset = getSelectionOffsetFromPoint(event.clientX, event.clientY);
      if (focusOffset === null) return;

      setSelection({ anchor: drag.anchor, focus: focusOffset });
    },
    [connectMode, getSelectionOffsetFromPoint]
  );

  const handleDocumentMouseUp = useCallback(() => {
    pointerDragRef.current = null;
  }, []);

  useEffect(() => {
    if (!isClient) return;

    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };
  }, [handleDocumentMouseMove, handleDocumentMouseUp, isClient]);

  const handlePageWheel = useCallback((event: React.WheelEvent<HTMLElement>) => {
    if (event.ctrlKey) return;

    const workspace = event.currentTarget.closest('.word-workspace') as HTMLElement | null;
    if (!workspace) return;

    workspace.scrollTop += event.deltaY;
    event.preventDefault();
  }, []);

  // ------------------------------------------------------------------
  // Page chrome (unchanged appearance).
  // ------------------------------------------------------------------

  const scaledWidth = PAGE_WIDTH * zoom;
  const scaledPageHeight = PAGE_HEIGHT * zoom;
  const stackHeight = visualDocumentHeight(pageCount, zoom);
  const inchCount = Math.ceil(PAGE_INCHES_W);

  useEffect(() => {
    if (!isClient || !pageStackRef.current) return;

    const workspace = pageStackRef.current.closest('.word-workspace') as HTMLElement | null;
    if (!workspace) return;

    const updateActivePageFromScroll = () => {
      const stackRect = pageStackRef.current?.getBoundingClientRect();
      if (!stackRect) return;

      const viewportCenter = workspace.getBoundingClientRect().top + workspace.clientHeight / 2;
      let nextActivePage = 1;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        const pageTop = stackRect.top + visualPageTop(pageIndex, zoom);
        const pageCenter = pageTop + scaledPageHeight / 2;
        const distance = Math.abs(viewportCenter - pageCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          nextActivePage = pageIndex + 1;
        }
      }

      setActivePage((current) => (current === nextActivePage ? current : nextActivePage));
    };

    workspace.addEventListener('scroll', updateActivePageFromScroll, { passive: true });
    updateActivePageFromScroll();

    return () => workspace.removeEventListener('scroll', updateActivePageFromScroll);
  }, [isClient, pageCount, scaledPageHeight, zoom]);

  const sharedCanvasProps = {
    text,
    mode,
    fontSize,
    dotSpacing,
    strokeWidth,
    paperType,
    showGuides,
    showStrokeOrder,
    selectedFont,
    fontMetrics,
    textColor,
    textAlign,
    width: PAGE_WIDTH,
    connections,
    getCharMode,
    getCharFontSize,
    bare: true as const,
  };

  const pageIndices = Array.from({ length: pageCount }, (_, index) => index);

  const editorOverlayClassName = cn(
    'word-editor-overlay pointer-events-auto absolute inset-0 overflow-hidden whitespace-pre outline-none',
    isEmpty && 'word-editor-overlay--empty',
    connectMode && 'word-editor-overlay--connect-mode pointer-events-none'
  );

  const editorOverlayStyle: React.CSSProperties = {
    fontSize: `${fontMetrics.renderFontSize}px`,
    fontFamily: `"${selectedFont}", cursive`,
    color: 'transparent',
    caretColor: 'transparent',
    textAlign,
    direction: 'ltr',
    unicodeBidi: 'plaintext',
    lineHeight: `${fontMetrics.lineHeight}px`,
    paddingTop: `${fontMetrics.editorPaddingTop}px`,
    paddingRight: `${PAGE_MARGIN}px`,
    paddingBottom: `${PAGE_MARGIN}px`,
    paddingLeft: `${PAGE_MARGIN}px`,
    boxSizing: 'border-box',
    minHeight: roundPx(renderedPageHeight),
  };

  return (
    <div className="word-workspace flex-1 overflow-auto">
      <div className="word-workspace-inner flex items-start justify-center px-6 py-8 md:px-10 md:py-10">
        <div
          className={cn('word-page-frame', isFocused && 'word-page-frame--focused')}
          style={{ width: scaledWidth }}
        >
          {/* Ruler */}
          <div
            className="word-ruler relative overflow-hidden border border-b-0 border-[#c8c6c4] bg-[#f3f2f1]"
            style={{ height: 24 * zoom, width: scaledWidth }}
            aria-hidden
            onMouseDown={(event) => event.preventDefault()}
          >
            <div
              className="relative origin-top-left"
              style={{ width: PAGE_WIDTH, height: 24, transform: `scale(${zoom})` }}
            >
              {Array.from({ length: inchCount + 1 }).map((_, inch) => (
                <React.Fragment key={inch}>
                  <div
                    className="absolute bottom-0 border-l border-[#8a8886]"
                    style={{ left: inch * RULER_INCH_PX, height: 14 }}
                  />
                  <span
                    className="absolute top-0.5 text-[9px] font-medium tabular-nums text-[#605e5c]"
                    style={{ left: inch * RULER_INCH_PX + 3 }}
                  >
                    {inch}
                  </span>
                  {inch < inchCount &&
                    [0.25, 0.5, 0.75].map((frac) => (
                      <div
                        key={frac}
                        className="absolute bottom-0 border-l border-[#c8c6c4]"
                        style={{
                          left: (inch + frac) * RULER_INCH_PX,
                          height: frac === 0.5 ? 9 : 6,
                        }}
                      />
                    ))}
                </React.Fragment>
              ))}
              <div
                className="absolute bottom-0 top-0 w-0 border-l-2 border-[#d13438]"
                style={{ left: PAGE_MARGIN }}
              />
              <div
                className="absolute bottom-0 top-0 w-0 border-l-2 border-[#d13438]"
                style={{ left: PAGE_WIDTH - PAGE_MARGIN }}
              />
            </div>
          </div>

          {/* Stacked pages (Word print layout) */}
          <div
            ref={pageStackRef}
            className="word-pages-stack relative"
            style={{ width: scaledWidth, height: stackHeight }}
            suppressHydrationWarning
          >
            {pageIndices.map((pageIndex) => (
              <article
                key={pageIndex}
                className={cn(
                  'word-page-sheet',
                  activePage === pageIndex + 1 && isFocused && 'word-page-sheet--active'
                )}
                style={{
                  top: visualPageTop(pageIndex, zoom),
                  width: scaledWidth,
                  height: scaledPageHeight,
                }}
                aria-label={`Page ${pageIndex + 1}`}
              >
                <div
                  className="word-page-viewport overflow-hidden"
                  style={{ width: scaledWidth, height: scaledPageHeight }}
                >
                  <div
                    className="word-page-content origin-top-left"
                    style={{
                      width: PAGE_WIDTH,
                      height: renderedPageHeight,
                      transform: `scale(${zoom})`,
                    }}
                  >
                    {isClient && (
                      <>
                        <HandwritingCanvas
                          {...sharedCanvasProps}
                          height={renderedPageHeight}
                          clipPageIndex={pageIndex}
                        />
                        <ConnectionRenderLayer
                          width={PAGE_WIDTH}
                          height={renderedPageHeight}
                          clipPageIndex={pageIndex}
                          connections={connections}
                          mode={mode}
                          dotSpacing={dotSpacing}
                          dotColor="#9aa0a6"
                          strokeColor={connectionColor}
                          strokeWidth={connectionWidth}
                        />
                        {connectMode && (
                          <LetterConnectionLayer
                            width={PAGE_WIDTH}
                            height={renderedPageHeight}
                            clipPageIndex={pageIndex}
                            layout={letterLayout}
                            connections={connections}
                            onConnectionsChange={onConnectionsChange}
                            active={connectMode}
                            connectionColor={connectionColor}
                            connectionWidth={connectionWidth}
                            mode={mode}
                            dotSpacing={dotSpacing}
                            dotColor="#9aa0a6"
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}

            {isClient && (
              <div className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-hidden opacity-0" aria-hidden>
                <HandwritingCanvas
                  ref={canvasRef}
                  {...sharedCanvasProps}
                  height={renderedPageHeight}
                />
              </div>
            )}

            {/* Text interaction layer (single document, gap-aware caret) */}
            <div
              className="word-page-interaction pointer-events-none absolute inset-0 z-20"
              suppressHydrationWarning
            >
              <div
                ref={pageSurfaceRef}
                className="pointer-events-none absolute left-0 top-0 z-10 origin-top-left"
                style={{
                  width: PAGE_WIDTH,
                  height: renderedPageHeight,
                  transform: `scale(${zoom})`,
                }}
                suppressHydrationWarning
              >
                {isClient ? (
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    spellCheck
                    tabIndex={0}
                    dir="ltr"
                    onInput={handleInput}
                    onCompositionStart={handleCompositionStart}
                    onCompositionEnd={handleCompositionEnd}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onMouseDown={handleEditorMouseDown}
                    onKeyDown={handleEditorKeyDown}
                    onCopy={handleCopy}
                    onCut={handleCut}
                    onPaste={handlePaste}
                    onWheel={handlePageWheel}
                    className={editorOverlayClassName}
                    style={editorOverlayStyle}
                    data-placeholder="Start typing..."
                  />
                ) : (
                  <div
                    className={editorOverlayClassName}
                    style={editorOverlayStyle}
                    data-placeholder="Start typing..."
                    aria-hidden
                  />
                )}
              </div>

              {isClient &&
                !connectMode &&
                selectionRects.map((rect, index) => (
                  <div
                    key={`selection-${index}`}
                    className="word-editor-selection pointer-events-none absolute z-[24]"
                    style={{
                      left: rect.left * zoom,
                      top: logicalYToVisualY(rect.top, zoom),
                      width: rect.width * zoom,
                      height: rect.height * zoom,
                      backgroundColor: 'rgba(24, 90, 189, 0.28)',
                    }}
                    aria-hidden
                  />
                ))}

              {isClient && caretRect && selectionRects.length === 0 && (
                <div
                  key={`caret-${Math.round(caretRect.left * 100)}-${Math.round(caretRect.top * 100)}`}
                  className="word-editor-caret pointer-events-none absolute z-[25]"
                  style={{
                    left: caretRect.left * zoom,
                    top: logicalYToVisualY(caretRect.top, zoom),
                    width: 1,
                    height: caretRect.height * zoom,
                    backgroundColor: textColor,
                  }}
                  aria-hidden
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
