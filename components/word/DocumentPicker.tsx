'use client';

import React, { useMemo, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { FileText, Loader2, Search, Trash2, X } from 'lucide-react';
import { WorksheetRecord } from '@/lib/handwriting-document';
import { cn } from '@/lib/utils';

interface DocumentPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worksheets: WorksheetRecord[];
  loading: boolean;
  error: string | null;
  currentDocumentId?: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => void;
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export const DocumentPicker: React.FC<DocumentPickerProps> = ({
  open,
  onOpenChange,
  worksheets,
  loading,
  error,
  currentDocumentId,
  onOpen,
  onDelete,
  onRefresh,
}) => {
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return worksheets;
    return worksheets.filter((w) => w.title.toLowerCase().includes(q));
  }, [query, worksheets]);

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;

    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-[1px]" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[1101] flex max-h-[min(80vh,640px)] w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-[#e1dfdd] bg-white shadow-2xl outline-none">
          <div className="flex items-center justify-between border-b border-[#edebe9] px-4 py-3">
            <div>
              <Dialog.Title className="text-[15px] font-semibold text-[#201f1e]">Open Document</Dialog.Title>
              <Dialog.Description className="text-[12px] text-[#605e5c]">
                Choose a saved worksheet to open and edit.
              </Dialog.Description>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex h-8 w-8 items-center justify-center rounded text-[#605e5c] hover:bg-[#f3f2f1]"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="border-b border-[#edebe9] px-4 py-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a8886]" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents..."
                className="h-8 w-full rounded border border-[#e1dfdd] bg-[#faf9f8] pl-8 pr-3 text-[12px] outline-none focus:border-[#185abd]"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-[#605e5c]">
                <Loader2 size={16} className="animate-spin" />
                Loading documents...
              </div>
            ) : error ? (
              <div className="px-3 py-8 text-center">
                <p className="text-[13px] text-red-600">{error}</p>
                <button
                  type="button"
                  onClick={onRefresh}
                  className="mt-3 rounded border border-[#e1dfdd] px-3 py-1.5 text-[12px] hover:bg-[#f3f2f1]"
                >
                  Try again
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-12 text-center text-[13px] text-[#605e5c]">
                {worksheets.length === 0 ? 'No saved documents yet.' : 'No documents match your search.'}
              </div>
            ) : (
              <ul className="space-y-1">
                {filtered.map((worksheet) => {
                  const isCurrent = worksheet.id === currentDocumentId;
                  const isDeleting = deletingId === worksheet.id;

                  return (
                    <li key={worksheet.id}>
                      <div
                        className={cn(
                          'flex items-center gap-2 rounded-md border px-3 py-2 transition-colors',
                          isCurrent
                            ? 'border-[#185abd] bg-[#deecf9]'
                            : 'border-transparent hover:border-[#e1dfdd] hover:bg-[#faf9f8]'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onOpen(worksheet.id)}
                          className="flex min-w-0 flex-1 items-start gap-2 text-left"
                        >
                          <FileText size={16} className="mt-0.5 shrink-0 text-[#185abd]" />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-[#201f1e]">{worksheet.title}</p>
                            <p className="text-[11px] text-[#8a8886]">
                              Updated {formatDate(worksheet.updated_at)}
                              {isCurrent ? ' · Currently open' : ''}
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleDelete(worksheet.id, worksheet.title)}
                          disabled={isDeleting}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#a4262c] hover:bg-[#fde7e9] disabled:opacity-50"
                          title="Delete document"
                          aria-label={`Delete ${worksheet.title}`}
                        >
                          {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
