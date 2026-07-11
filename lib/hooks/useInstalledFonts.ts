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
import { FontMetadata } from '@/lib/types';

export function useInstalledFonts() {
  const [fonts, setFonts] = useState<FontMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      await migrateLegacyLocalFonts();
      const cloudFonts = await loadCloudFonts();
      const installed = await installCloudFonts(cloudFonts);
      setFonts(installed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fonts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const importFont = useCallback(
    async (file: File) => {
      const metadata = await importFontToCloud(file);
      await refresh();
      return metadata;
    },
    [refresh]
  );

  const removeFont = useCallback(
    async (fontId: string) => {
      const font = fonts.find((item) => item.id === fontId);
      if (!font) {
        throw new Error('Font not found');
      }
      await removeCloudFont(font);
      await refresh();
    },
    [fonts, refresh]
  );

  const ensureInstalled = useCallback(async (font: FontMetadata) => {
    await ensureFontReady(font);
  }, []);

  return {
    fonts,
    loading,
    error,
    importFont,
    removeFont,
    ensureInstalled,
    refresh,
  };
}
