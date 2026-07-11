'use client';

import React, { useState } from 'react';
import { Trash2, RotateCcw, Undo2, Redo2, Pipette } from 'lucide-react';

interface DrawingToolbarProps {
  onClear?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onColorChange?: (color: string) => void;
  onWidthChange?: (width: number) => void;
  onToolChange?: (tool: 'pen' | 'pencil' | 'marker' | 'eraser') => void;
  currentColor?: string;
  currentWidth?: number;
  currentTool?: 'pen' | 'pencil' | 'marker' | 'eraser';
  canUndo?: boolean;
  canRedo?: boolean;
}

const COLORS = ['#000000', '#FF0000', '#00AA00', '#0000FF', '#FFAA00', '#AA00FF'];
const WIDTHS = [1, 2, 3, 5, 8, 12];
const TOOLS = ['pen', 'pencil', 'marker', 'eraser'] as const;

export function DrawingToolbar({
  onClear,
  onUndo,
  onRedo,
  onColorChange,
  onWidthChange,
  onToolChange,
  currentColor = '#000000',
  currentWidth = 3,
  currentTool = 'pen',
  canUndo = false,
  canRedo = false,
}: DrawingToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Tool Selection */}
        <div className="flex gap-2 border-r border-gray-200 pr-4">
          {TOOLS.map((tool) => (
            <button
              key={tool}
              onClick={() => onToolChange?.(tool)}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                currentTool === tool
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={`${tool.charAt(0).toUpperCase()}${tool.slice(1)} tool`}
            >
              {tool === 'pen' && '✏️'}
              {tool === 'pencil' && '📝'}
              {tool === 'marker' && '🖍️'}
              {tool === 'eraser' && '🧹'}
            </button>
          ))}
        </div>

        {/* Color Picker */}
        <div className="flex gap-2 border-r border-gray-200 pr-4 items-center">
          <label className="text-sm font-medium text-gray-700">Color:</label>
          <div className="flex gap-1 flex-wrap">
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => {
                  onColorChange?.(color);
                  setShowColorPicker(false);
                }}
                className={`w-6 h-6 rounded border-2 transition-transform hover:scale-110 ${
                  currentColor === color ? 'border-gray-400 ring-2 ring-gray-300' : 'border-gray-300'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
            <input
              type="color"
              value={currentColor}
              onChange={(e) => onColorChange?.(e.target.value)}
              className="w-6 h-6 cursor-pointer"
              title="Custom color"
            />
          </div>
        </div>

        {/* Width Selector */}
        <div className="flex gap-2 border-r border-gray-200 pr-4 items-center">
          <label className="text-sm font-medium text-gray-700">Width:</label>
          <div className="flex gap-2">
            {WIDTHS.map((width) => (
              <button
                key={width}
                onClick={() => onWidthChange?.(width)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  currentWidth === width
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={`Width: ${width}px`}
              >
                {width}
              </button>
            ))}
          </div>
        </div>

        {/* Drawing Width Slider */}
        <div className="flex gap-2 border-r border-gray-200 pr-4 items-center">
          <input
            type="range"
            min="1"
            max="20"
            value={currentWidth}
            onChange={(e) => onWidthChange?.(parseInt(e.target.value))}
            className="w-24"
            title="Adjust stroke width"
          />
          <span className="text-xs text-gray-600 w-6">{currentWidth}px</span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={20} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={20} />
          </button>
          <button
            onClick={onClear}
            className="p-2 rounded hover:bg-red-100 text-red-600 transition-colors"
            title="Clear canvas"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
