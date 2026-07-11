'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ensureFontReady,
  importFontToCloud,
  installCloudFonts,
  loadCloudFonts,
  migrateLegacyLocalFonts,
  removeCloudFont,
} from '@/lib/font-service';
import { getFontDownloadUrl } from '@/lib/supabase/storage';
import { FontMetadata } from '@/lib/types';

export function useFonts() {
  const [fonts, setFonts] = useState<FontMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFonts = useCallback(async () => {
    try {
      setLoading(true);
      await migrateLegacyLocalFonts();
      const cloudFonts = await loadCloudFonts();
      const installed = await installCloudFonts(cloudFonts);
      setFonts(installed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch fonts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFonts();
  }, [fetchFonts]);

  const uploadFont = useCallback(
    async (file: File) => {
      try {
        const fontMetadata = await importFontToCloud(file);
        await fetchFonts();
        return fontMetadata;
      } catch (err) {
        throw err;
      }
    },
    [fetchFonts]
  );

  const deleteFont = useCallback(
    async (fontId: string) => {
      try {
        const font = fonts.find((item) => item.id === fontId);
        if (!font) {
          throw new Error('Font not found');
        }
        await removeCloudFont(font);
        await fetchFonts();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to delete font';
        setError(errorMsg);
        throw err;
      }
    },
    [fonts, fetchFonts]
  );

  const getFontUrl = useCallback((filePath: string) => getFontDownloadUrl(filePath), []);

  return {
    fonts,
    loading,
    error,
    uploadFont,
    deleteFont,
    getFontUrl,
    refetch: fetchFonts,
    ensureInstalled: ensureFontReady,
  };
}
