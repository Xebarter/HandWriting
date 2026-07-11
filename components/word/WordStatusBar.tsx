'use client';

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { HandwritingMode } from '@/lib/types';

interface WordStatusBarProps {
  wordCount: number;
  charCount: number;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  mode: HandwritingMode;
  activePage?: number;
  pageCount?: number;
}

const MODE_LABELS: Record<HandwritingMode, string> = {
  dotted: 'Dotted',
  outline: 'Outline',
  solid: 'Solid',
  'guide-lines': 'Guide Lines',
  'arrow-guides': 'Arrow Guides',
};

export const WordStatusBar: React.FC<WordStatusBarProps> = ({
  wordCount,
  charCount,
  zoom,
  onZoomChange,
  mode,
  activePage = 1,
  pageCount = 1,
}) => {
  const zoomPercent = Math.round(zoom * 100);

  const adjustZoom = (delta: number) => {
    const next = Math.min(Math.max(zoom + delta, 0.5), 2);
    onZoomChange(Math.round(next * 100) / 100);
  };

  return (
    <footer className="word-statusbar flex h-7 shrink-0 items-center justify-between border-t border-[#e1dfdd] bg-[#faf9f8] px-4 text-[11px] text-[#605e5c]">
      <div className="flex items-center gap-5">
        <span className="tabular-nums">
          Page {activePage} of {pageCount}
        </span>
        <span className="hidden h-3.5 w-px bg-[#e1dfdd] sm:block" />
        <span className="hidden sm:inline">{MODE_LABELS[mode]} mode</span>
      </div>

      <div className="flex items-center gap-5">
        <span className="hidden tabular-nums md:inline">
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </span>
        <span className="hidden tabular-nums lg:inline">{charCount} characters</span>

        <div className="flex items-center gap-1.5 rounded border border-[#e1dfdd] bg-white px-1.5 py-0.5">
          <button
            type="button"
            onClick={() => adjustZoom(-0.1)}
            className="rounded p-0.5 text-[#323130] transition-colors hover:bg-[#f3f2f1]"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <Minus size={11} />
          </button>
          <input
            type="range"
            min={50}
            max={200}
            step={10}
            value={zoomPercent}
            onChange={(e) => onZoomChange(Number(e.target.value) / 100)}
            className="word-range w-24"
            aria-label="Zoom level"
          />
          <button
            type="button"
            onClick={() => adjustZoom(0.1)}
            className="rounded p-0.5 text-[#323130] transition-colors hover:bg-[#f3f2f1]"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <Plus size={11} />
          </button>
          <span className="w-9 text-right tabular-nums font-medium text-[#323130]">{zoomPercent}%</span>
        </div>
      </div>
    </footer>
  );
};
