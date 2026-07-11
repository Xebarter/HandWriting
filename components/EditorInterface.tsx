'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AlertCircle, CheckCircle, Copy, Download, FilePlus, FileText, FolderOpen, Loader2, LogOut, Printer, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DocumentRibbon } from '@/components/word/DocumentRibbon';
import { DocumentWorkspace } from '@/components/word/DocumentWorkspace';
import { DocumentPicker } from '@/components/word/DocumentPicker';
import { WordStatusBar } from '@/components/word/WordStatusBar';
import { HandwritingMode, PaperType, FontMetadata, LetterConnection, TextStyleRange } from '@/lib/types';
import { PAGE_WIDTH, PAGE_HEIGHT } from '@/lib/document-constants';
import { captureWorksheetCanvas, logicalPxToMm } from '@/lib/worksheet-snapshot';
import { ExportManager, copyCanvasToClipboard, printCanvas } from '@/lib/export';
import { useInstalledFonts } from '@/lib/hooks/useInstalledFonts';
import { useWorksheets } from '@/lib/hooks/useWorksheets';
import { waitForFontFamily } from '@/lib/font-manager';
import {
  clearFontPreference,
  DEFAULT_FONT_FAMILY,
  getSavedFontPreference,
  saveFontPreference,
} from '@/lib/font-preference';
import {
  applyDocumentToEditor,
  createDefaultEditorState,
  DEFAULT_DOCUMENT_TITLE,
  documentFileName,
  EditorDocumentState,
  serializeDocument,
} from '@/lib/handwriting-document';
import {
  clearWorksheetDraft,
  getSavedWorksheetDraft,
  saveWorksheetDraft,
} from '@/lib/worksheet-draft';
import { createClient } from '@/lib/supabase/client';
import { ensureSupabaseSession } from '@/lib/supabase/session';
import { autoConnectLetters, rebaseConnections, reconcileConnections } from '@/lib/connection-engine';
import { LetterBox } from '@/lib/types';
import { RuledFontMetrics } from '@/lib/font-metrics';
import {
  applyTextStyleToRange,
  getResolvedTextStyle,
  rebaseTextStyleRanges,
} from '@/lib/text-style-ranges';

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export const EditorInterface: React.FC = () => {
  const AUTOSAVE_DELAY_MS = 1200;
  const router = useRouter();
  const [text, setText] = useState('');
  const [mode, setMode] = useState<HandwritingMode>('solid');
  const [fontSize, setFontSize] = useState(48);
  const [dotSpacing, setDotSpacing] = useState(8);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [paperType, setPaperType] = useState<PaperType>('ruled');
  const [showGuides, setShowGuides] = useState(true);
  const [showStrokeOrder, setShowStrokeOrder] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'pdf' | 'svg'>('pdf');
  const [selectedFont, setSelectedFont] = useState(DEFAULT_FONT_FAMILY);
  const [selectedFontId, setSelectedFontId] = useState<string | undefined>();
  const [fontPreferenceRestored, setFontPreferenceRestored] = useState(false);
  const [textColor, setTextColor] = useState('#000000');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [zoom, setZoom] = useState(1);
  const [connections, setConnections] = useState<LetterConnection[]>([]);
  const [textStyleRanges, setTextStyleRanges] = useState<TextStyleRange[]>([]);
  const [connectMode, setConnectMode] = useState(false);
  const [autoLinkEnabled, setAutoLinkEnabled] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState(DEFAULT_DOCUMENT_TITLE);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [activePage, setActivePage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [renderedPageHeight, setRenderedPageHeight] = useState(PAGE_HEIGHT);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const skipDraftRestoreRef = useRef(false);
  const autosaveTimeoutRef = useRef<number | null>(null);
  const autosaveInFlightRef = useRef(false);

  const {
    worksheets,
    loading: worksheetsLoading,
    error: worksheetsError,
    saveDocument,
    loadDocument,
    updateDocument,
    deleteWorksheet,
    refetch: refetchWorksheets,
  } = useWorksheets();

  const {
    fonts: installedFonts,
    importFont,
    removeFont,
    ensureInstalled,
    refresh: refreshFonts,
    loading: fontsLoading,
    error: fontsError,
  } = useInstalledFonts();

  const updateFontSelection = useCallback((family: string, fontId?: string) => {
    setSelectedFont(family);
    setSelectedFontId(fontId);
    saveFontPreference({ family, fontId });
    setIsDirty(true);
  }, []);

  const getEditorState = useCallback(
    (): EditorDocumentState => ({
      title: documentTitle,
      text,
      mode,
      fontSize,
      dotSpacing,
      strokeWidth,
      paperType,
      showGuides,
      showStrokeOrder,
      selectedFont,
      selectedFontId,
      textColor,
      textAlign,
      connections,
      textStyleRanges,
      autoLinkEnabled,
    }),
    [
      documentTitle,
      text,
      mode,
      fontSize,
      dotSpacing,
      strokeWidth,
      paperType,
      showGuides,
      showStrokeOrder,
      selectedFont,
      selectedFontId,
      textColor,
      textAlign,
      connections,
      textStyleRanges,
      autoLinkEnabled,
    ]
  );

  const syncDocumentUrl = useCallback((id: string | null) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (id) {
      url.searchParams.set('doc', id);
    } else {
      url.searchParams.delete('doc');
    }
    window.history.replaceState({}, '', url.toString());
  }, []);

  const applyEditorState = useCallback(
    async (state: EditorDocumentState) => {
      setDocumentTitle(state.title);
      setText(state.text);
      setMode(state.mode);
      setFontSize(state.fontSize);
      setDotSpacing(state.dotSpacing);
      setStrokeWidth(state.strokeWidth);
      setPaperType(state.paperType);
      setShowGuides(state.showGuides);
      setShowStrokeOrder(state.showStrokeOrder);
      setTextColor(state.textColor);
      setTextAlign(state.textAlign);
      setConnections(state.connections);
      setTextStyleRanges(state.textStyleRanges);
      setAutoLinkEnabled(state.autoLinkEnabled);
      setConnectMode(false);

      const custom =
        (state.selectedFontId
          ? installedFonts.find((font) => font.id === state.selectedFontId)
          : undefined) ?? installedFonts.find((font) => font.family === state.selectedFont);

      try {
        if (custom) {
          await ensureInstalled(custom);
        }
        await waitForFontFamily(state.selectedFont, state.fontSize);
        setSelectedFont(state.selectedFont);
        setSelectedFontId(custom?.id ?? state.selectedFontId);
        saveFontPreference({ family: state.selectedFont, fontId: custom?.id ?? state.selectedFontId });
      } catch {
        setSelectedFont(state.selectedFont);
        setSelectedFontId(custom?.id ?? state.selectedFontId);
      }
    },
    [installedFonts, ensureInstalled]
  );

  useEffect(() => {
    if (fontsLoading || fontPreferenceRestored) return;

    const saved = getSavedFontPreference();
    if (!saved) {
      setFontPreferenceRestored(true);
      return;
    }

    let cancelled = false;

    const restoreSavedFont = async () => {
      const custom =
        (saved.fontId ? installedFonts.find((font) => font.id === saved.fontId) : undefined) ??
        installedFonts.find((font) => font.family === saved.family);

      try {
        if (custom) {
          await ensureInstalled(custom);
        }
        await waitForFontFamily(saved.family, fontSize);
        if (!cancelled) {
          updateFontSelection(saved.family, custom?.id);
        }
      } catch {
        if (!cancelled) {
          updateFontSelection(saved.family, custom?.id);
        }
      } finally {
        if (!cancelled) {
          setFontPreferenceRestored(true);
        }
      }
    };

    void restoreSavedFont();

    return () => {
      cancelled = true;
    };
  }, [
    fontsLoading,
    fontPreferenceRestored,
    installedFonts,
    ensureInstalled,
    fontSize,
    updateFontSelection,
  ]);

  useEffect(() => {
    if (skipDraftRestoreRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const docId = params.get('doc');
    if (docId) {
      skipDraftRestoreRef.current = true;
      void (async () => {
        setIsLoadingDocument(true);
        try {
          await ensureSupabaseSession();
          const { record, document } = await loadDocument(docId);
          await applyEditorState(applyDocumentToEditor(document));
          setDocumentId(record.id);
          setDocumentTitle(record.title);
          clearWorksheetDraft();
          setIsDirty(false);
        } catch (err) {
          setExportStatus({
            type: 'error',
            message: err instanceof Error ? err.message : 'Failed to open document.',
          });
        } finally {
          setIsLoadingDocument(false);
        }
      })();
      return;
    }

    const savedDraft = getSavedWorksheetDraft();
    if (savedDraft) {
      setText(savedDraft);
    }
  }, [applyEditorState, loadDocument]);

  const layoutRef = useRef<LetterBox[]>([]);
  const getCharStyle = useCallback(
    (charIndex: number) =>
      getResolvedTextStyle(textStyleRanges, charIndex, {
        mode,
        linksEnabled: autoLinkEnabled,
        fontSize,
      }),
    [textStyleRanges, mode, autoLinkEnabled, fontSize]
  );

  const getCharFontSize = useCallback(
    (charIndex: number) => getCharStyle(charIndex).fontSize,
    [getCharStyle]
  );

  const getCharMode = useCallback(
    (charIndex: number) => getCharStyle(charIndex).mode,
    [getCharStyle]
  );

  const handleLetterLayoutChange = useCallback(
    (layout: LetterBox[], _fontMetrics: RuledFontMetrics) => {
      layoutRef.current = layout;

      if (!text.trim()) {
        setConnections([]);
        return;
      }

      if (!autoLinkEnabled) {
        setConnections((current) => reconcileConnections(current, text, layout));
        return;
      }

      setConnections(
        autoConnectLetters(layout, {
          color: '#9aa0a6',
          width: Math.max(1, strokeWidth),
          getCharStyle,
        })
      );
    },
    [text, strokeWidth, autoLinkEnabled, getCharStyle]
  );

  const handleConnectionsChange = useCallback((next: LetterConnection[]) => {
    setAutoLinkEnabled(false);
    setConnections(next);
    setIsDirty(true);
  }, []);

  const handleAutoConnect = useCallback(() => {
    setAutoLinkEnabled(true);
    if (layoutRef.current.length > 0) {
      const getAutoLinkedCharStyle = (charIndex: number) =>
        getResolvedTextStyle(textStyleRanges, charIndex, {
          mode,
          linksEnabled: true,
          fontSize,
        });

      setConnections(
        autoConnectLetters(layoutRef.current, {
          color: '#9aa0a6',
          width: Math.max(1, strokeWidth),
          getCharStyle: getAutoLinkedCharStyle,
        })
      );
    }
    setConnectMode(false);
    setIsDirty(true);
  }, [mode, strokeWidth, textStyleRanges]);

  const handleClearConnections = useCallback(() => {
    setAutoLinkEnabled(false);
    setConnections([]);
    setIsDirty(true);
  }, []);

  const editorSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const lastSelectionStyleRef = useRef<{ index: number; fontSize: number } | null>(null);
  const editorActionsRef = useRef<{ selectAll: () => void } | null>(null);
  const fontSizeRef = useRef(fontSize);
  fontSizeRef.current = fontSize;

  const handleEditorSelectionChange = useCallback(
    (selection: { start: number; end: number }) => {
      editorSelectionRef.current = selection;
      const index = selection.start;
      const resolved = getResolvedTextStyle(textStyleRanges, index, {
        mode,
        linksEnabled: autoLinkEnabled,
        fontSize: fontSizeRef.current,
      });
      const last = lastSelectionStyleRef.current;
      if (last && last.index === index && last.fontSize === resolved.fontSize) {
        return;
      }
      lastSelectionStyleRef.current = { index, fontSize: resolved.fontSize };
      setFontSize((current) =>
        current === resolved.fontSize ? current : resolved.fontSize
      );
    },
    [autoLinkEnabled, mode, textStyleRanges]
  );

  const handleActivePageChange = useCallback((page: number, total: number) => {
    setActivePage(page);
    setPageCount(total);
  }, []);

  const handleDocumentMetricsChange = useCallback(
    ({ pageCount: totalPages, renderedPageHeight: totalHeight }: { pageCount: number; renderedPageHeight: number }) => {
      setPageCount(totalPages);
      setRenderedPageHeight(totalHeight);
    },
    []
  );

  const registerEditorActions = useCallback(
    (actions: { selectAll: () => void }) => {
      editorActionsRef.current = actions;
    },
    []
  );

  const getEditorSelectionOffsets = useCallback(() => {
    return editorSelectionRef.current;
  }, []);

  const applySelectionTextStyle = useCallback(
    (
      patch: Partial<Pick<TextStyleRange, 'mode' | 'linksEnabled' | 'fontSize'>>,
      onNoSelection: () => void
    ) => {
      const offsets = getEditorSelectionOffsets();
      if (!offsets || offsets.start === offsets.end) {
        onNoSelection();
        return;
      }

      setTextStyleRanges((current) =>
        applyTextStyleToRange(current, offsets.start, offsets.end, patch)
      );
      setIsDirty(true);
    },
    [getEditorSelectionOffsets]
  );

  const modifySelectedText = useCallback(
    (transform: (value: string) => string) => {
      const offsets = getEditorSelectionOffsets();
      if (!offsets) return;

      const currentText = text;
      const selectedText = currentText.slice(offsets.start, offsets.end);
      const updatedText =
        currentText.slice(0, offsets.start) + transform(selectedText) + currentText.slice(offsets.end);
      setTextStyleRanges((current) => rebaseTextStyleRanges(current, currentText, updatedText));
      setConnections((current) => rebaseConnections(current, currentText, updatedText));
      setText(updatedText);
      setIsDirty(true);

      requestAnimationFrame(() => editorRef.current?.focus());
    },
    [getEditorSelectionOffsets, text]
  );

  const handleTextChange = useCallback(
    (nextText: string) => {
      setTextStyleRanges((current) => rebaseTextStyleRanges(current, text, nextText));
      setConnections((current) => rebaseConnections(current, text, nextText));
      saveWorksheetDraft(nextText);
      setText(nextText);
      setIsDirty(true);
    },
    [text]
  );

  const handleTitleChange = useCallback((nextTitle: string) => {
    setDocumentTitle(nextTitle);
    setIsDirty(true);
  }, []);

  const handleOpenDocument = useCallback(
    async (id: string) => {
      if (isDirty && !window.confirm('You have unsaved changes. Open another document anyway?')) {
        return;
      }

      setIsLoadingDocument(true);
      setPickerOpen(false);
      try {
        await ensureSupabaseSession();
        const { record, document } = await loadDocument(id);
        await applyEditorState(applyDocumentToEditor(document));
        setDocumentId(record.id);
        setDocumentTitle(record.title);
        clearWorksheetDraft();
        setIsDirty(false);
        syncDocumentUrl(record.id);
        setExportStatus({ type: 'success', message: `Opened "${record.title}".` });
        setTimeout(() => setExportStatus(null), 2500);
      } catch (err) {
        setExportStatus({
          type: 'error',
          message: err instanceof Error ? err.message : 'Failed to open document.',
        });
      } finally {
        setIsLoadingDocument(false);
      }
    },
    [applyEditorState, isDirty, loadDocument, syncDocumentUrl]
  );

  const handleSaveDocument = useCallback(
    async ({ saveAsNew = false, silent = false }: { saveAsNew?: boolean; silent?: boolean } = {}) => {
      if (autosaveTimeoutRef.current) {
        window.clearTimeout(autosaveTimeoutRef.current);
        autosaveTimeoutRef.current = null;
      }

      setIsSaving(true);
      setSaveIndicator('saving');
      if (!silent) {
        setExportStatus(null);
      }
      try {
        await ensureSupabaseSession();
        const document = serializeDocument(getEditorState());
        const fileName = documentFileName(document.title);

        if (documentId && !saveAsNew) {
          await updateDocument(documentId, document, document.title);
          setDocumentTitle(document.title);
          setIsDirty(false);
          syncDocumentUrl(documentId);
        } else {
          const newId = await saveDocument(document, fileName);
          setDocumentId(newId);
          setDocumentTitle(document.title);
          setIsDirty(false);
          syncDocumentUrl(newId);
        }

        clearWorksheetDraft();
        setSaveIndicator('saved');
        if (!silent) {
          setExportStatus({ type: 'success', message: 'Document saved.' });
          setTimeout(() => setExportStatus(null), 2500);
        }
      } catch (err) {
        setSaveIndicator('error');
        setExportStatus({
          type: 'error',
          message: err instanceof Error ? err.message : 'Failed to save document.',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [documentId, getEditorState, saveDocument, syncDocumentUrl, updateDocument]
  );

  const handleNewDocument = useCallback((force = false) => {
    if (!force && isDirty && !window.confirm('You have unsaved changes. Create a new document anyway?')) {
      return;
    }

    const defaults = createDefaultEditorState();
    setDocumentId(null);
    setDocumentTitle(defaults.title);
    setText(defaults.text);
    setMode(defaults.mode);
    setFontSize(defaults.fontSize);
    setDotSpacing(defaults.dotSpacing);
    setStrokeWidth(defaults.strokeWidth);
    setPaperType(defaults.paperType);
    setShowGuides(defaults.showGuides);
    setShowStrokeOrder(defaults.showStrokeOrder);
    setTextColor(defaults.textColor);
    setTextAlign(defaults.textAlign);
    setSelectedFont(DEFAULT_FONT_FAMILY);
    setSelectedFontId(undefined);
    clearFontPreference();
    clearWorksheetDraft();
    setTextStyleRanges([]);
    setConnections([]);
    setAutoLinkEnabled(false);
    setConnectMode(false);
    setIsDirty(false);
    syncDocumentUrl(null);
    setExportStatus({ type: 'success', message: 'New document created.' });
    setTimeout(() => setExportStatus(null), 2000);
  }, [isDirty, syncDocumentUrl]);

  const handleSignOut = useCallback(async () => {
    if (isDirty && !window.confirm('You have unsaved changes. Sign out anyway?')) {
      return;
    }

    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace('/login');
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }, [isDirty, router]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void handleSaveDocument({ saveAsNew: false, silent: false });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSaveDocument]);

  useEffect(() => {
    if (!isDirty || isLoadingDocument || isSigningOut) {
      return;
    }

    if (autosaveInFlightRef.current) {
      return;
    }

    setSaveIndicator('saving');

    if (autosaveTimeoutRef.current) {
      window.clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = window.setTimeout(() => {
      autosaveInFlightRef.current = true;
      void handleSaveDocument({ silent: true }).finally(() => {
        autosaveInFlightRef.current = false;
      });
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimeoutRef.current) {
        window.clearTimeout(autosaveTimeoutRef.current);
        autosaveTimeoutRef.current = null;
      }
    };
  }, [AUTOSAVE_DELAY_MS, handleSaveDocument, isDirty, isLoadingDocument, isSigningOut]);

  const applyUppercase = useCallback(() => modifySelectedText((v) => v.toUpperCase()), [modifySelectedText]);
  const applyLowercase = useCallback(() => modifySelectedText((v) => v.toLowerCase()), [modifySelectedText]);
  const applyCapitalize = useCallback(
    () => modifySelectedText((v) => v.replace(/\b\w/g, (c) => c.toUpperCase())),
    [modifySelectedText]
  );

  const selectAllPreviewText = useCallback(() => {
    editorActionsRef.current?.selectAll();
    editorRef.current?.focus();
  }, []);

  const handleFontSelect = useCallback(
    async (font: FontMetadata) => {
      await ensureInstalled(font);
      await waitForFontFamily(font.family, fontSize);
      updateFontSelection(font.family, font.id);
    },
    [ensureInstalled, fontSize, updateFontSelection]
  );

  const handleFontFamilyChange = useCallback(
    async (family: string) => {
      const custom = installedFonts.find((f) => f.family === family);
      if (custom) {
        await ensureInstalled(custom);
      }
      await waitForFontFamily(family, fontSize);
      updateFontSelection(family, custom?.id);
    },
    [installedFonts, ensureInstalled, fontSize, updateFontSelection]
  );

  const handleModeChange = useCallback(
    (nextMode: HandwritingMode) => {
      applySelectionTextStyle({ mode: nextMode }, () => {
        setMode(nextMode);
        setIsDirty(true);
      });
    },
    [applySelectionTextStyle]
  );

  const handleFontSizeChange = useCallback(
    (value: number) => {
      applySelectionTextStyle({ fontSize: value }, () => {
        setFontSize(value);
      });
      setFontSize(value);
      setIsDirty(true);
    },
    [applySelectionTextStyle]
  );

  const handleEnableLinks = useCallback(() => {
    const layout = layoutRef.current;
    if (layout.length === 0) return;

    const offsets = getEditorSelectionOffsets();
    // If there's no selection (collapsed or missing), link all adjacent letters.
    if (!offsets || offsets.start === offsets.end) {
      handleAutoConnect();
      return;
    }

    const selectionStart = offsets.start;
    const selectionEnd = offsets.end;

    // Persist "linksEnabled" styling for the selected range (so future actions can
    // respect the user's selection).
    setTextStyleRanges((current) =>
      applyTextStyleToRange(current, selectionStart, selectionEnd, { linksEnabled: true })
    );

    // IMPORTANT: compute connections immediately from the selection offsets so we
    // don't depend on React state updates finishing first.
    const getScopedCharStyle = (charIndex: number) => {
      const resolved = getResolvedTextStyle(textStyleRanges, charIndex, {
        mode,
        linksEnabled: false,
        fontSize,
      });
      return {
        ...resolved,
        linksEnabled: charIndex >= selectionStart && charIndex < selectionEnd,
      };
    };

    setAutoLinkEnabled(false);
    setConnections(
      autoConnectLetters(layout, {
        color: '#9aa0a6',
        width: Math.max(1, strokeWidth),
        getCharStyle: getScopedCharStyle,
      })
    );
    setConnectMode(false);
    setIsDirty(true);
  }, [
    getEditorSelectionOffsets,
    handleAutoConnect,
    mode,
    strokeWidth,
    textStyleRanges,
    fontSize,
  ]);

  const handleDisableLinks = useCallback(() => {
    setAutoLinkEnabled(false);
    setConnections([]);
    setIsDirty(true);

    const offsets = getEditorSelectionOffsets();
    if (offsets && offsets.start !== offsets.end) {
      setTextStyleRanges((current) =>
        applyTextStyleToRange(current, offsets.start, offsets.end, { linksEnabled: false })
      );
    }
  }, [getEditorSelectionOffsets]);

  const getWorksheetSnapshot = useCallback(
    async (dpi: number = 96) => {
      if (!canvasRef.current) return null;
      return captureWorksheetCanvas({
        sourceCanvas: canvasRef.current,
        width: PAGE_WIDTH,
        height: renderedPageHeight,
        text,
        mode,
        fontSize,
        dotSpacing,
        strokeWidth,
        textColor,
        dotColor: '#cccccc',
        selectedFont,
        textAlign,
        dpi,
        getCharMode,
      });
    },
    [
      renderedPageHeight,
      text,
      mode,
      fontSize,
      dotSpacing,
      strokeWidth,
      textColor,
      selectedFont,
      textAlign,
      getCharMode,
    ]
  );

  const handleExport = useCallback(async () => {
    const snapshot = await getWorksheetSnapshot(96);
    if (!snapshot) return;
    try {
      setExportStatus(null);
      const filename = documentFileName(documentTitle).replace('.json', '');

      switch (exportFormat) {
        case 'png':
          ExportManager.exportToPNG(snapshot, `${filename}.png`);
          setExportStatus({ type: 'success', message: 'PNG exported successfully!' });
          break;
        case 'pdf': {
          const printSnapshot = await getWorksheetSnapshot(300);
          if (!printSnapshot) return;
          ExportManager.exportMultiPagePDF(printSnapshot, {
            filename: `${filename}.pdf`,
            pageCount,
            dpi: 300,
          });
          setExportStatus({
            type: 'success',
            message: `PDF exported (${pageCount} page${pageCount === 1 ? '' : 's'}, print-ready).`,
          });
          break;
        }
        case 'svg':
          ExportManager.exportToSVG(snapshot, `${filename}.svg`);
          setExportStatus({ type: 'success', message: 'SVG exported successfully!' });
          break;
      }
      setTimeout(() => setExportStatus(null), 3000);
    } catch {
      setExportStatus({ type: 'error', message: 'Export failed. Please try again.' });
    }
  }, [exportFormat, getWorksheetSnapshot, pageCount, documentTitle]);

  const handleCopy = useCallback(async () => {
    const snapshot = await getWorksheetSnapshot(96);
    if (!snapshot) return;
    const success = await copyCanvasToClipboard(snapshot);
    setExportStatus({
      type: success ? 'success' : 'error',
      message: success ? 'Copied to clipboard!' : 'Failed to copy to clipboard.',
    });
    setTimeout(() => setExportStatus(null), 2000);
  }, [getWorksheetSnapshot]);

  const handlePrint = useCallback(async () => {
    const snapshot = await getWorksheetSnapshot(150);
    if (!snapshot) return;
    printCanvas(snapshot, 'Handwriting Worksheet', {
      widthMm: logicalPxToMm(PAGE_WIDTH),
      heightMm: logicalPxToMm(PAGE_HEIGHT),
      pageCount,
    });
    setExportStatus({
      type: 'success',
      message: `Print dialog opened (${pageCount} page${pageCount === 1 ? '' : 's'}).`,
    });
    setTimeout(() => setExportStatus(null), 2000);
  }, [getWorksheetSnapshot, pageCount]);

  const handleReset = useCallback(() => {
    if (!window.confirm('Reset all settings to defaults? Unsaved changes will be lost.')) {
      return;
    }

    const defaults = createDefaultEditorState();
    setDocumentId(null);
    setDocumentTitle(defaults.title);
    setText(defaults.text);
    setMode(defaults.mode);
    setFontSize(defaults.fontSize);
    setDotSpacing(defaults.dotSpacing);
    setStrokeWidth(defaults.strokeWidth);
    setPaperType(defaults.paperType);
    setShowGuides(defaults.showGuides);
    setShowStrokeOrder(defaults.showStrokeOrder);
    setTextColor(defaults.textColor);
    setTextAlign(defaults.textAlign);
    setSelectedFont(DEFAULT_FONT_FAMILY);
    setSelectedFontId(undefined);
    clearFontPreference();
    clearWorksheetDraft();
    setTextStyleRanges([]);
    setConnections([]);
    setAutoLinkEnabled(false);
    setConnectMode(false);
    setIsDirty(false);
    syncDocumentUrl(null);
    setExportStatus({ type: 'success', message: 'Reset to defaults.' });
    setTimeout(() => setExportStatus(null), 2000);
  }, [syncDocumentUrl]);

  return (
    <div className="word-app flex h-screen flex-col overflow-hidden">
      {/* Title bar with quick access */}
      <header className="word-titlebar flex h-11 shrink-0 items-center justify-between px-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 pr-3">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-white/20">
              <FileText size={15} className="text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[13px] font-semibold text-white">Handwriting</span>
              <span className="text-[10px] text-white/70">Worksheet Generator</span>
            </div>
          </div>

          <div className="hidden h-5 w-px bg-white/20 sm:block" />

          <div className="hidden items-center gap-0.5 sm:flex">
            <button
              type="button"
              onClick={() => handleNewDocument()}
              className="qat-btn"
              title="New document"
              aria-label="New document"
            >
              <FilePlus size={15} />
            </button>
            <button
              type="button"
              onClick={() => {
                void refetchWorksheets();
                setPickerOpen(true);
              }}
              className="qat-btn"
              title="Open document"
              aria-label="Open document"
            >
              <FolderOpen size={15} />
            </button>
            <button
              type="button"
              onClick={() => void handleSaveDocument({ saveAsNew: false, silent: false })}
              disabled={isSaving || isLoadingDocument}
              className="qat-btn disabled:opacity-50"
              title="Save (Ctrl+S)"
              aria-label="Save document"
            >
              {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            </button>

            <div className="mx-1 hidden h-5 w-px bg-white/20 md:block" />

            <button
              type="button"
              onClick={handleExport}
              className="qat-btn"
              title="Export"
              aria-label="Export"
            >
              <Download size={15} />
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="qat-btn"
              title="Copy to clipboard"
              aria-label="Copy to clipboard"
            >
              <Copy size={15} />
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="qat-btn"
              title="Print"
              aria-label="Print"
            >
              <Printer size={15} />
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={isSigningOut}
              className="qat-btn disabled:opacity-50"
              title="Sign out"
              aria-label="Sign out"
            >
              {isSigningOut ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
            </button>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-3">
          <label className="hidden min-w-0 items-center gap-2 md:flex">
            <span className="sr-only">Document name</span>
            <input
              type="text"
              value={documentTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              onBlur={() => {
                if (!documentTitle.trim()) {
                  setDocumentTitle(DEFAULT_DOCUMENT_TITLE);
                }
              }}
              className="max-w-[220px] truncate rounded border border-white/20 bg-white/10 px-2 py-1 text-[12px] text-white outline-none placeholder:text-white/50 focus:border-white/40 focus:bg-white/15"
              placeholder={DEFAULT_DOCUMENT_TITLE}
              aria-label="Document name"
            />
            {saveIndicator === 'saving' && <span className="text-[11px] text-white/60">Saving...</span>}
            {saveIndicator === 'saved' && !isDirty && <span className="text-[11px] text-white/60">Saved</span>}
            {saveIndicator === 'error' && <span className="text-[11px] text-red-200">Save failed</span>}
            {saveIndicator === 'idle' && isDirty && <span className="text-[11px] text-white/60">Unsaved</span>}
          </label>
          {isLoadingDocument && (
            <div className="hidden items-center gap-1.5 text-[11px] text-white/75 md:flex">
              <Loader2 size={12} className="animate-spin" />
              Opening...
            </div>
          )}
          {exportStatus && (
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium ${
                exportStatus.type === 'success'
                  ? 'bg-white/15 text-white'
                  : 'bg-red-500/90 text-white'
              }`}
            >
              {exportStatus.type === 'success' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
              {exportStatus.message}
            </div>
          )}
        </div>
      </header>

      <DocumentRibbon
        selectedFont={selectedFont}
        selectedFontId={selectedFontId}
        installedFonts={installedFonts}
        onFontSelect={handleFontSelect}
        fontSize={fontSize}
        onFontSizeChange={handleFontSizeChange}
        onFontFamilyChange={handleFontFamilyChange}
        textColor={textColor}
        onTextColorChange={(value) => {
          setTextColor(value);
          setIsDirty(true);
        }}
        textAlign={textAlign}
        onTextAlignChange={(value) => {
          setTextAlign(value);
          setIsDirty(true);
        }}
        onUppercase={applyUppercase}
        onLowercase={applyLowercase}
        onCapitalize={applyCapitalize}
        onSelectAll={selectAllPreviewText}
        mode={mode}
        onModeChange={handleModeChange}
        dotSpacing={dotSpacing}
        onDotSpacingChange={(value) => {
          setDotSpacing(value);
          setIsDirty(true);
        }}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={(value) => {
          setStrokeWidth(value);
          setIsDirty(true);
        }}
        paperType={paperType}
        onPaperTypeChange={(value) => {
          setPaperType(value);
          setIsDirty(true);
        }}
        showGuides={showGuides}
        onShowGuidesChange={(value) => {
          setShowGuides(value);
          setIsDirty(true);
        }}
        showStrokeOrder={showStrokeOrder}
        onShowStrokeOrderChange={(value) => {
          setShowStrokeOrder(value);
          setIsDirty(true);
        }}
        exportFormat={exportFormat}
        onExportFormatChange={setExportFormat}
        onExport={handleExport}
        onCopy={handleCopy}
        onPrint={handlePrint}
        onReset={handleReset}
        connectMode={connectMode}
        onConnectModeChange={(value) => {
          setConnectMode(value);
          setIsDirty(true);
        }}
        onAutoConnect={handleEnableLinks}
        onClearConnections={handleDisableLinks}
        connectionCount={connections.length}
        fontLibrary={{
          fonts: installedFonts,
          loading: fontsLoading,
          error: fontsError,
          onImport: importFont,
          onRemove: removeFont,
          onRefresh: refreshFonts,
        }}
      />

      <DocumentWorkspace
        text={text}
        onTextChange={handleTextChange}
        mode={mode}
        fontSize={fontSize}
        dotSpacing={dotSpacing}
        strokeWidth={strokeWidth}
        paperType={paperType}
        showGuides={showGuides}
        showStrokeOrder={showStrokeOrder}
        selectedFont={selectedFont}
        textColor={textColor}
        textAlign={textAlign}
        zoom={zoom}
        canvasRef={canvasRef}
        editorRef={editorRef}
        connections={connections}
        onConnectionsChange={handleConnectionsChange}
        connectMode={connectMode}
        connectionColor={textColor}
        connectionWidth={Math.max(1, strokeWidth)}
        onLetterLayoutChange={handleLetterLayoutChange}
        getCharMode={getCharMode}
        getCharFontSize={getCharFontSize}
        onActivePageChange={handleActivePageChange}
        onDocumentMetricsChange={handleDocumentMetricsChange}
        onSelectionChange={handleEditorSelectionChange}
        registerEditorActions={registerEditorActions}
      />

      <WordStatusBar
        wordCount={countWords(text)}
        charCount={text.length}
        zoom={zoom}
        onZoomChange={setZoom}
        mode={mode}
        activePage={activePage}
        pageCount={pageCount}
      />

      <DocumentPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        worksheets={worksheets}
        loading={worksheetsLoading}
        error={worksheetsError}
        currentDocumentId={documentId}
        onOpen={(id) => void handleOpenDocument(id)}
        onDelete={async (id) => {
          await deleteWorksheet(id);
          if (documentId === id) {
            handleNewDocument(true);
          }
        }}
        onRefresh={() => void refetchWorksheets()}
      />
    </div>
  );
};
