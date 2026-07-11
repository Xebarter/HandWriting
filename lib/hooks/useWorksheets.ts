'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  HandwritingDocument,
  WorksheetRecord,
  deserializeDocument,
} from '@/lib/handwriting-document';

export function useWorksheets() {
  const [worksheets, setWorksheets] = useState<WorksheetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorksheets = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/worksheets', { method: 'GET' });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to fetch worksheets');
      }

      const data = await response.json();
      setWorksheets(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch worksheets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWorksheets();
  }, [fetchWorksheets]);

  const saveDocument = async (document: HandwritingDocument, fileName: string) => {
    try {
      const response = await fetch('/api/worksheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document, fileName }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save worksheet');
      }

      await fetchWorksheets();
      return payload.id as string;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save worksheet';
      setError(errorMsg);
      throw err;
    }
  };

  const loadDocument = async (
    worksheetId: string,
  ): Promise<{ record: WorksheetRecord; document: HandwritingDocument }> => {
    try {
      const response = await fetch(`/api/worksheets/${worksheetId}`, { method: 'GET' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load worksheet');
      }

      const document = deserializeDocument(payload.document);
      if (!document) {
        throw new Error('Worksheet file is invalid or unsupported');
      }

      return {
        record: {
          id: payload.id,
          title: payload.title,
          file_path: payload.file_path,
          created_at: payload.created_at,
          updated_at: payload.updated_at,
          metadata: payload.metadata,
        },
        document,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load worksheet';
      setError(errorMsg);
      throw err;
    }
  };

  const updateDocument = async (
    worksheetId: string,
    document: HandwritingDocument,
    title?: string,
  ) => {
    try {
      const response = await fetch(`/api/worksheets/${worksheetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document, title: title ?? document.title }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update worksheet');
      }

      await fetchWorksheets();
      return payload.worksheet as WorksheetRecord;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update worksheet';
      setError(errorMsg);
      throw err;
    }
  };

  const deleteWorksheet = async (worksheetId: string) => {
    try {
      const response = await fetch(`/api/worksheets/${worksheetId}`, {
        method: 'DELETE',
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to delete worksheet');
      }

      await fetchWorksheets();
      return payload.deletedId as string;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete worksheet';
      setError(errorMsg);
      throw err;
    }
  };

  return {
    worksheets,
    loading,
    error,
    saveDocument,
    loadDocument,
    updateDocument,
    deleteWorksheet,
    refetch: fetchWorksheets,
  };
}
