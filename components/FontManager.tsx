'use client';

import React, { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Upload, Trash2, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { FontMetadata } from '@/lib/types';
import { cn } from '@/lib/utils';

interface FontManagerProps {
  fonts: FontMetadata[];
  loading: boolean;
  error: string | null;
  onImport: (file: File) => Promise<FontMetadata>;
  onRemove: (fontId: string) => Promise<void>;
  onRefresh: () => void;
  onFontSelect?: (font: FontMetadata) => void;
  selectedFontId?: string;
  variant?: 'standalone' | 'dropdown';
}

const VALID_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function FontManager({
  fonts,
  loading,
  error,
  onImport,
  onRemove,
  onRefresh,
  onFontSelect,
  selectedFontId,
  variant = 'standalone',
}: FontManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !VALID_EXTENSIONS.includes(fileExtension)) {
      setUploadError('Please upload a valid font file (TTF, OTF, WOFF, or WOFF2)');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setUploadError('Font file must be smaller than 5MB');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const fontMetadata = await onImport(file);
      setUploadSuccess(`"${fontMetadata.family}" installed successfully`);
      onFontSelect?.(fontMetadata);
      event.target.value = '';
      setTimeout(() => setUploadSuccess(null), 4000);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to import font');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fontId: string) => {
    if (!confirm('Remove this font from your library?')) return;

    try {
      await onRemove(fontId);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to remove font');
    }
  };

  return (
    <div
      className={cn(
        variant === 'standalone' && 'rounded-lg border border-gray-200 bg-white p-4',
        variant === 'dropdown' && 'p-3'
      )}
    >
      <div className={cn('flex items-center justify-between', variant === 'dropdown' ? 'mb-3' : 'mb-4')}>
        <h3 className={cn('font-semibold', variant === 'dropdown' ? 'text-sm' : 'text-lg')}>
          Font Library
        </h3>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 transition-colors"
          title="Refresh fonts"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div
        className={cn(
          'mb-4 rounded border-2 border-dashed border-gray-300 bg-gray-50 p-4 transition-colors hover:border-[#185abd]/40',
          variant === 'dropdown' && 'mb-3 p-3'
        )}
      >
        <label className="flex items-center justify-center cursor-pointer">
          <div className="flex flex-col items-center gap-2">
            <Upload size={20} className="text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              {uploading ? 'Installing font...' : 'Import & install font'}
            </span>
            <span className="text-xs text-gray-500 text-center">
              TTF, OTF, WOFF, WOFF2 — max 5MB
            </span>
          </div>
          <input
            type="file"
            accept=".ttf,.otf,.woff,.woff2"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {uploadError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded flex items-start gap-2">
          <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{uploadError}</p>
        </div>
      )}

      {uploadSuccess && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded flex items-start gap-2">
          <Check size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">{uploadSuccess}</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800">
          {error}
        </div>
      )}

      {loading && <div className="text-center py-4 text-gray-500">Loading fonts...</div>}

      {!loading && fonts.length > 0 && (
        <div className={cn('space-y-2 overflow-y-auto', variant === 'dropdown' ? 'max-h-64' : 'max-h-96')}>
          {fonts.map((font) => (
            <div
              key={font.id}
              onClick={() => onFontSelect?.(font)}
              className={`p-3 rounded border cursor-pointer transition-all ${
                selectedFontId === font.id
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate" style={{ fontFamily: font.family }}>
                    {font.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {font.style} · {(font.fileSize / 1024).toFixed(1)} KB
                  </div>
                  <div
                    className="mt-1 text-sm text-gray-600 truncate"
                    style={{ fontFamily: font.family }}
                  >
                    The quick brown fox
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(font.id);
                  }}
                  className="p-1 rounded hover:bg-red-100 text-red-600 transition-colors shrink-0"
                  title="Remove font"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && fonts.length === 0 && (
        <div className={cn('text-center text-gray-500', variant === 'dropdown' ? 'py-4' : 'py-8')}>
          <p className="text-sm">No custom fonts installed</p>
          <p className="text-xs mt-1">Import a font file to use it in your worksheets</p>
        </div>
      )}

      <div className={cn('border-t border-gray-200 pt-3', variant === 'dropdown' ? 'mt-3' : 'mt-4 pt-4')}>
        <p className="text-xs text-gray-600">Installed fonts: {fonts.length}</p>
      </div>
    </div>
  );
}
