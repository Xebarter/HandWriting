'use client';

import React, { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  CircleDot,
  Copy,
  Download,
  Grid3x3,
  Link2,
  Minus,
  PenLine,
  Plus,
  Printer,
  RotateCcw,
  Rows3,
  Type,
} from 'lucide-react';
import { HandwritingMode, PaperType, FontMetadata } from '@/lib/types';
import { FONT_FAMILIES, FONT_SIZES } from '@/lib/document-constants';
import { FontManager } from '@/components/FontManager';
import { RibbonGroup } from './RibbonGroup';
import { RibbonButton, RibbonDivider } from './RibbonButton';
import { cn } from '@/lib/utils';

export type RibbonTab = 'home' | 'export';

export interface FontLibraryProps {
  fonts: FontMetadata[];
  loading: boolean;
  error: string | null;
  onImport: (file: File) => Promise<FontMetadata>;
  onRemove: (fontId: string) => Promise<void>;
  onRefresh: () => void;
}

interface DocumentRibbonProps {
  selectedFont: string;
  selectedFontId?: string;
  installedFonts: FontMetadata[];
  onFontSelect: (font: FontMetadata) => void;
  fontLibrary: FontLibraryProps;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  onFontFamilyChange: (family: string) => void;
  textColor: string;
  onTextColorChange: (color: string) => void;
  textAlign: 'left' | 'center' | 'right';
  onTextAlignChange: (align: 'left' | 'center' | 'right') => void;
  onUppercase: () => void;
  onLowercase: () => void;
  onCapitalize: () => void;
  onSelectAll: () => void;
  mode: HandwritingMode;
  onModeChange: (mode: HandwritingMode) => void;
  dotSpacing: number;
  onDotSpacingChange: (spacing: number) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  paperType: PaperType;
  onPaperTypeChange: (type: PaperType) => void;
  showGuides: boolean;
  onShowGuidesChange: (show: boolean) => void;
  showStrokeOrder: boolean;
  onShowStrokeOrderChange: (show: boolean) => void;
  exportFormat: 'png' | 'pdf' | 'svg';
  onExportFormatChange: (format: 'png' | 'pdf' | 'svg') => void;
  onExport: () => void;
  onCopy: () => void;
  onPrint: () => void;
  onReset: () => void;
  connectMode: boolean;
  onConnectModeChange: (enabled: boolean) => void;
  onAutoConnect: () => void;
  onClearConnections: () => void;
  connectionCount: number;
}

const TABS: { id: RibbonTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'export', label: 'Export & Print' },
];

const MODE_OPTIONS: { id: HandwritingMode; label: string; icon: React.ReactNode }[] = [
  { id: 'solid', label: 'Solid', icon: <Type size={14} /> },
  { id: 'dotted', label: 'Dotted', icon: <CircleDot size={14} /> },
  { id: 'outline', label: 'Outline', icon: <PenLine size={14} /> },
  { id: 'guide-lines', label: 'Guide Lines', icon: <Rows3 size={14} /> },
];

export const DocumentRibbon: React.FC<DocumentRibbonProps> = (props) => {
  const [activeTab, setActiveTab] = useState<RibbonTab>('home');
  const [fontPopoverOpen, setFontPopoverOpen] = useState(false);
  const fontSizeOptions = props.fontSize > FONT_SIZES[FONT_SIZES.length - 1]
    ? [...FONT_SIZES, props.fontSize].sort((a, b) => a - b)
    : FONT_SIZES;

  const adjustFontSize = (delta: number) => {
    const current = props.fontSize;
    const idx = FONT_SIZES.findIndex((s) => s >= current);
    if (delta > 0 && current >= FONT_SIZES[FONT_SIZES.length - 1]) {
      props.onFontSizeChange(current + 8);
      return;
    }

    if (delta < 0 && current > FONT_SIZES[FONT_SIZES.length - 1]) {
      props.onFontSizeChange(Math.max(FONT_SIZES[FONT_SIZES.length - 1], current - 8));
      return;
    }

    const base = idx === -1 ? FONT_SIZES.length - 1 : idx;
    const next = FONT_SIZES[Math.min(Math.max(base + delta, 0), FONT_SIZES.length - 1)];
    props.onFontSizeChange(next);
  };

  return (
    <div className="word-ribbon shrink-0 bg-white">
      <div className="flex items-end gap-0 border-b border-[#e1dfdd] bg-[#faf9f8] px-2 pt-0.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              '-mb-px rounded-t px-3 py-1 text-[12px] font-medium transition-colors',
              activeTab === tab.id
                ? 'ribbon-tab-active text-[#185abd]'
                : 'text-[#323130] hover:bg-[#edebe9]'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="ribbon-panel flex h-[58px] items-stretch overflow-x-auto">
        {activeTab === 'home' && (
          <>
            <RibbonGroup label="Font">
              <select
                value={props.selectedFont}
                onChange={(e) => props.onFontFamilyChange(e.target.value)}
                className="word-select h-7 w-[140px] shrink-0 text-[11px]"
                aria-label="Font family"
              >
                <optgroup label="Built-in">
                  {FONT_FAMILIES.map((f) => (
                    <option key={f} value={f} style={{ fontFamily: f }}>
                      {f}
                    </option>
                  ))}
                </optgroup>
                {props.installedFonts.length > 0 && (
                  <optgroup label="My Fonts">
                    {props.installedFonts.map((f) => (
                      <option key={f.id} value={f.family} style={{ fontFamily: f.family }}>
                        {f.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {props.selectedFont &&
                  !FONT_FAMILIES.includes(props.selectedFont as (typeof FONT_FAMILIES)[number]) &&
                  !props.installedFonts.some((f) => f.family === props.selectedFont) && (
                    <option value={props.selectedFont}>{props.selectedFont}</option>
                  )}
              </select>

              <Popover.Root open={fontPopoverOpen} onOpenChange={setFontPopoverOpen}>
                <Popover.Trigger
                  className={cn(
                    'word-select flex h-7 w-7 shrink-0 items-center justify-center text-sm',
                    'data-popup-open:border-[#185abd] data-popup-open:bg-[#deecf9] data-popup-open:text-[#185abd]'
                  )}
                  title="Import fonts"
                >
                  +
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner
                    className="z-[1000]"
                    side="bottom"
                    align="start"
                    sideOffset={6}
                    collisionPadding={12}
                  >
                    <Popover.Popup className="w-80 overflow-hidden rounded-md border border-[#e1dfdd] bg-white shadow-2xl outline-none">
                      <FontManager
                        variant="dropdown"
                        fonts={props.fontLibrary.fonts}
                        loading={props.fontLibrary.loading}
                        error={props.fontLibrary.error}
                        onImport={props.fontLibrary.onImport}
                        onRemove={props.fontLibrary.onRemove}
                        onRefresh={props.fontLibrary.onRefresh}
                        onFontSelect={(font) => {
                          props.onFontSelect(font);
                          setFontPopoverOpen(false);
                        }}
                        selectedFontId={props.selectedFontId}
                      />
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>

              <RibbonDivider />

              <RibbonButton icon={<Minus size={12} />} onClick={() => adjustFontSize(-1)} title="Decrease font size" className="w-7 px-0" />
              <select
                value={props.fontSize}
                onChange={(e) => props.onFontSizeChange(Number(e.target.value))}
                className="word-select h-7 w-11 shrink-0 text-center text-[11px]"
                aria-label="Font size"
              >
                {fontSizeOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <RibbonButton icon={<Plus size={12} />} onClick={() => adjustFontSize(1)} title="Increase font size" className="w-7 px-0" />

              <input
                type="color"
                value={props.textColor}
                onChange={(e) => props.onTextColorChange(e.target.value)}
                className="h-7 w-7 shrink-0 cursor-pointer rounded border border-[#e1dfdd] bg-white p-0.5"
                aria-label="Text color"
                title="Font color"
              />
            </RibbonGroup>

            <RibbonGroup label="Paragraph">
              <div className="ribbon-cluster flex items-center rounded-sm border border-[#e1dfdd] bg-[#faf9f8] p-px">
                <RibbonButton
                  icon={<AlignLeft size={14} />}
                  active={props.textAlign === 'left'}
                  onClick={() => props.onTextAlignChange('left')}
                  title="Align left"
                  className="h-7 w-7 px-0"
                />
                <RibbonButton
                  icon={<AlignCenter size={14} />}
                  active={props.textAlign === 'center'}
                  onClick={() => props.onTextAlignChange('center')}
                  title="Align center"
                  className="h-7 w-7 px-0"
                />
                <RibbonButton
                  icon={<AlignRight size={14} />}
                  active={props.textAlign === 'right'}
                  onClick={() => props.onTextAlignChange('right')}
                  title="Align right"
                  className="h-7 w-7 px-0"
                />
              </div>
            </RibbonGroup>

            <RibbonGroup label="Editing">
              <div className="ribbon-cluster flex items-center rounded-sm border border-[#e1dfdd] bg-[#faf9f8] p-px">
                <RibbonButton label="Aa" onClick={props.onCapitalize} title="Capitalize" className="h-7 w-7 px-0 text-[10px]" />
                <RibbonButton label="AA" onClick={props.onUppercase} title="UPPERCASE" className="h-7 w-7 px-0 text-[10px]" />
                <RibbonButton label="aa" onClick={props.onLowercase} title="lowercase" className="h-7 w-7 px-0 text-[10px]" />
              </div>

              <RibbonDivider />

              <RibbonButton
                icon={<Type size={14} />}
                label="Select All"
                onClick={props.onSelectAll}
                compact
              />
            </RibbonGroup>

            <RibbonGroup label="Worksheet Style">
              <div className="ribbon-cluster flex items-center rounded-sm border border-[#e1dfdd] bg-[#faf9f8] p-px">
                {MODE_OPTIONS.map((m) => (
                  <RibbonButton
                    key={m.id}
                    icon={m.icon}
                    label={m.label}
                    active={props.mode === m.id}
                    onClick={() => props.onModeChange(m.id)}
                    compact
                    className="h-7"
                  />
                ))}
              </div>

              {props.mode === 'dotted' && (
                <>
                  <RibbonDivider />
                  <input
                    type="range"
                    min={4}
                    max={16}
                    value={props.dotSpacing}
                    onChange={(e) => props.onDotSpacingChange(Number(e.target.value))}
                    className="word-range w-16"
                    aria-label="Dot spacing"
                    title={`Dot spacing: ${props.dotSpacing}px`}
                  />
                </>
              )}
              {props.mode === 'outline' && (
                <>
                  <RibbonDivider />
                  <input
                    type="range"
                    min={1}
                    max={6}
                    value={props.strokeWidth}
                    onChange={(e) => props.onStrokeWidthChange(Number(e.target.value))}
                    className="word-range w-16"
                    aria-label="Stroke width"
                    title={`Stroke width: ${props.strokeWidth}px`}
                  />
                </>
              )}
            </RibbonGroup>

            <RibbonGroup label="Cursive Links">
              <RibbonButton
                icon={<Link2 size={14} />}
                label="Link"
                active={props.connectMode}
                onClick={() => props.onConnectModeChange(!props.connectMode)}
                title="Draw cursive training links between letters"
                compact
              />
              <RibbonButton
                label="Auto Link"
                onClick={props.onAutoConnect}
                onMouseDown={(e) => e.preventDefault()}
                title="Create tracing links for all adjacent letters"
                compact
              />
              <RibbonButton
                label="Clear"
                onClick={props.onClearConnections}
                title="Remove all cursive links"
                compact
                disabled={props.connectionCount === 0}
              />
            </RibbonGroup>

            <RibbonGroup label="Paper" className="border-r-0">
              <div className="ribbon-cluster flex items-center rounded-sm border border-[#e1dfdd] bg-[#faf9f8] p-px">
                {(['blank', 'ruled', 'grid'] as PaperType[]).map((p) => (
                  <RibbonButton
                    key={p}
                    label={p.charAt(0).toUpperCase() + p.slice(1)}
                    active={props.paperType === p}
                    onClick={() => props.onPaperTypeChange(p)}
                    icon={<Grid3x3 size={11} />}
                    compact
                    className="h-7"
                  />
                ))}
              </div>

              <RibbonDivider />

              <label className="ribbon-checkbox-inline" title="Show guide lines">
                <input
                  type="checkbox"
                  checked={props.showGuides}
                  onChange={(e) => props.onShowGuidesChange(e.target.checked)}
                />
                <span>Guide Lines</span>
              </label>
              <label className="ribbon-checkbox-inline" title="Show stroke order">
                <input
                  type="checkbox"
                  checked={props.showStrokeOrder}
                  onChange={(e) => props.onShowStrokeOrderChange(e.target.checked)}
                />
                <span>Stroke Order</span>
              </label>
            </RibbonGroup>
          </>
        )}

        {activeTab === 'export' && (
          <>
            <RibbonGroup label="File Format">
              <div className="ribbon-cluster flex items-center rounded-sm border border-[#e1dfdd] bg-[#faf9f8] p-px">
                {(['pdf', 'png', 'svg'] as const).map((fmt) => (
                  <RibbonButton
                    key={fmt}
                    label={fmt.toUpperCase()}
                    active={props.exportFormat === fmt}
                    onClick={() => props.onExportFormatChange(fmt)}
                    compact
                    className="h-7 min-w-[40px]"
                  />
                ))}
              </div>
              <RibbonDivider />
              <p className="max-w-[140px] text-[10px] leading-snug text-[#605e5c]">
                PDF exports at 300 DPI for print-ready worksheets.
              </p>
            </RibbonGroup>

            <RibbonGroup label="Export">
              <RibbonButton
                icon={<Download size={16} />}
                label="Export File"
                onClick={props.onExport}
                accent="success"
                compact
              />
              <RibbonButton
                icon={<Copy size={16} />}
                label="Copy Image"
                onClick={props.onCopy}
                compact
              />
            </RibbonGroup>

            <RibbonGroup label="Print">
              <RibbonButton
                icon={<Printer size={16} />}
                label="Print"
                onClick={props.onPrint}
                compact
              />
            </RibbonGroup>

            <RibbonGroup label="Document" className="border-r-0">
              <RibbonButton
                icon={<RotateCcw size={15} />}
                label="Reset Defaults"
                onClick={props.onReset}
                accent="danger"
                compact
              />
            </RibbonGroup>
          </>
        )}
      </div>
    </div>
  );
};
