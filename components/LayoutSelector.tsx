'use client';

import React, { useState } from 'react';
import { LayoutConfig, PageTemplate } from '@/lib/types';
import { createLayoutConfig, setTemplate, getTemplateDescription } from '@/lib/layout-engine';

interface LayoutSelectorProps {
  onLayoutChange?: (config: LayoutConfig) => void;
  currentTemplate?: PageTemplate;
}

const TEMPLATES: Array<{ type: PageTemplate; label: string; icon: string }> = [
  { type: 'single-line', label: 'Single Line', icon: '📄' },
  { type: 'double-line', label: 'Double Line', icon: '📋' },
  { type: 'triple-line', label: 'Triple Line', icon: '📑' },
  { type: 'grid', label: 'Grid', icon: '📊' },
  { type: 'boxes', label: 'Boxes', icon: '▭' },
  { type: 'blank', label: 'Blank', icon: '⬜' },
];

export function LayoutSelector({ onLayoutChange, currentTemplate = 'single-line' }: LayoutSelectorProps) {
  const [layout, setLayout] = useState<LayoutConfig>(createLayoutConfig(currentTemplate));
  const [showAdvanced, setShowAdvanced] = useState(false);

  function handleTemplateChange(template: PageTemplate) {
    const newLayout = createLayoutConfig(template);
    setLayout(newLayout);
    onLayoutChange?.(newLayout);
  }

  function handleMarginChange(
    side: 'top' | 'bottom' | 'left' | 'right',
    value: number
  ) {
    const marginKey = `margin${side.charAt(0).toUpperCase()}${side.slice(1)}` as
      | 'marginTop'
      | 'marginBottom'
      | 'marginLeft'
      | 'marginRight';
    const newLayout: LayoutConfig = { ...layout, [marginKey]: value };
    setLayout(newLayout);
    onLayoutChange?.(newLayout);
  }

  function handleLineSpacingChange(value: number) {
    const newLayout = { ...layout, lineSpacing: value };
    setLayout(newLayout);
    onLayoutChange?.(newLayout);
  }

  function handleBoxSizeChange(value: number) {
    const newLayout = { ...layout, boxSize: value };
    setLayout(newLayout);
    onLayoutChange?.(newLayout);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-semibold text-lg mb-4">Page Layout</h3>

      {/* Template Grid */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {TEMPLATES.map((template) => (
          <button
            key={template.type}
            onClick={() => handleTemplateChange(template.type)}
            className={`p-3 rounded border-2 transition-all text-center ${
              layout.template === template.type
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
            title={getTemplateDescription(template.type)}
          >
            <div className="text-xl mb-1">{template.icon}</div>
            <div className="text-xs font-medium">{template.label}</div>
          </button>
        ))}
      </div>

      {/* Quick Settings */}
      <div className="space-y-4 mb-4 pb-4 border-b border-gray-200">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Line Spacing: {layout.lineSpacing}px
          </label>
          <input
            type="range"
            min="10"
            max="60"
            value={layout.lineSpacing}
            onChange={(e) => handleLineSpacingChange(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        {layout.template === 'boxes' && (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Box Size: {layout.boxSize}px
            </label>
            <input
              type="range"
              min="30"
              max="120"
              value={layout.boxSize || 60}
              onChange={(e) => handleBoxSizeChange(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        )}
      </div>

      {/* Advanced Settings */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-sm font-medium text-blue-600 hover:text-blue-700 mb-4"
      >
        {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
      </button>

      {showAdvanced && (
        <div className="space-y-4 p-4 bg-gray-50 rounded">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">
                Top: {layout.marginTop}px
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={layout.marginTop}
                onChange={(e) => handleMarginChange('top', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">
                Bottom: {layout.marginBottom}px
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={layout.marginBottom}
                onChange={(e) => handleMarginChange('bottom', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">
                Left: {layout.marginLeft}px
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={layout.marginLeft}
                onChange={(e) => handleMarginChange('left', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">
                Right: {layout.marginRight}px
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={layout.marginRight}
                onChange={(e) => handleMarginChange('right', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          {/* Paper Size */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-2">Paper Size</label>
            <select
              value={layout.paperSize}
              onChange={(e) => {
                const newLayout = {
                  ...layout,
                  paperSize: e.target.value as 'A4' | 'letter',
                };
                setLayout(newLayout);
                onLayoutChange?.(newLayout);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            >
              <option value="A4">A4</option>
              <option value="letter">Letter</option>
            </select>
          </div>

          {/* Orientation */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-2">Orientation</label>
            <div className="flex gap-2">
              {(['portrait', 'landscape'] as const).map((orientation) => (
                <button
                  key={orientation}
                  onClick={() => {
                    const newLayout = { ...layout, orientation };
                    setLayout(newLayout);
                    onLayoutChange?.(newLayout);
                  }}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    layout.orientation === orientation
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {orientation.charAt(0).toUpperCase()}
                  {orientation.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
