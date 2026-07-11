import {
  cacheFontLocally,
  deleteInstalledFont,
  ensureFontInstalled,
  getCachedFont,
  importFontFile,
  installAllSavedFonts,
  installFontToDocument,
  parseFontFromFile,
} from '@/lib/font-manager';
import { ensureSupabaseSession } from '@/lib/supabase/session';
import * as storage from '@/lib/supabase/storage';
import { FontMetadata } from '@/lib/types';
import type { User } from '@supabase/supabase-js';

async function getSessionUser(): Promise<User | null> {
  try {
    return await ensureSupabaseSession();
  } catch (err) {
    console.warn('[fonts] Cloud session unavailable, using local storage:', err);
    return null;
  }
}

function mapDbFont(row: Record<string, unknown>): FontMetadata {
  return {
    id: String(row.id),
    name: String(row.name),
    family: String(row.family || row.name),
    style: (row.style as FontMetadata['style']) || 'normal',
    source: (row.source as FontMetadata['source']) || 'uploaded',
    fileSize: Number(row.file_size) || 0,
    uploadedAt: new Date(String(row.created_at)),
    filePath: String(row.file_path),
  };
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Download font bytes from storage and cache locally when missing */
export async function hydrateFontData(font: FontMetadata): Promise<FontMetadata> {
  const cached = await getCachedFont(font.id);
  if (cached?.data) {
    return cached;
  }

  if (!font.filePath) {
    throw new Error(`Font data not available for "${font.family}"`);
  }

  const buffer = await storage.downloadFont(font.filePath);
  if (!buffer) {
    throw new Error(`Could not download font "${font.family}" from storage`);
  }

  const hydrated: FontMetadata = { ...font, data: buffer };
  await cacheFontLocally(hydrated);
  return hydrated;
}

/** Upload a font file to Supabase storage + user_fonts, then install locally */
export async function importFontToCloud(file: File): Promise<FontMetadata> {
  const user = await getSessionUser();
  if (!user) {
    return importFontFile(file);
  }

  const parsed = await parseFontFromFile(file);

  const uploadResult = await storage.uploadFont(
    parsed.buffer,
    `${Date.now()}-${sanitizeFileName(file.name)}`,
    user.id
  );

  if (!uploadResult) {
    throw new Error('Failed to upload font to storage');
  }

  const dbId = await storage.saveFontMetadata(
    {
      name: parsed.family,
      family: parsed.family,
      style: parsed.style,
      source: 'uploaded',
      fileSize: uploadResult.size,
      filePath: uploadResult.path,
    },
    user.id
  );

  if (!dbId) {
    await storage.deleteFont(uploadResult.path);
    throw new Error('Failed to save font metadata');
  }

  const fontMetadata: FontMetadata = {
    id: dbId,
    name: parsed.family,
    family: parsed.family,
    style: parsed.style,
    source: 'uploaded',
    fileSize: uploadResult.size,
    uploadedAt: new Date(),
    filePath: uploadResult.path,
    data: parsed.buffer,
  };

  await cacheFontLocally(fontMetadata);
  await installFontToDocument(fontMetadata);
  return fontMetadata;
}

/** Load all fonts for the signed-in user from the database */
export async function loadCloudFonts(): Promise<FontMetadata[]> {
  const user = await getSessionUser();
  if (!user) {
    return installAllSavedFonts();
  }

  const rows = await storage.getUserFonts(user.id);
  return rows.map(mapDbFont);
}

/** Install every cloud font into the browser (downloads when needed) */
export async function installCloudFonts(fonts: FontMetadata[]): Promise<FontMetadata[]> {
  const installed: FontMetadata[] = [];

  for (const font of fonts) {
    try {
      const hydrated = await hydrateFontData(font);
      await installFontToDocument(hydrated);
      installed.push(hydrated);
    } catch (err) {
      console.warn(`[fonts] Could not install "${font.family}":`, err);
    }
  }

  await document.fonts.ready;
  return installed;
}

/** Remove a font from storage, database, and local cache */
export async function removeCloudFont(font: FontMetadata): Promise<void> {
  if (font.id.startsWith('local-')) {
    await deleteInstalledFont(font.id);
    return;
  }

  if (font.filePath) {
    await storage.deleteFont(font.filePath);
  }

  await storage.deleteFont_DB(font.id);
  await deleteInstalledFont(font.id);
}

/** One-time migration for fonts saved only in IndexedDB before cloud sync */
export async function migrateLegacyLocalFonts(): Promise<void> {
  const user = await getSessionUser();
  if (!user) {
    return;
  }

  const cachedFonts = await installAllSavedFonts();
  const legacyFonts = cachedFonts.filter((font) => font.id.startsWith('local-') && font.data);

  for (const font of legacyFonts) {
    try {
      const fileName = `${font.family.replace(/\s+/g, '-')}.ttf`;
      const uploadResult = await storage.uploadFont(font.data!, fileName, user.id);
      if (!uploadResult) continue;

      const dbId = await storage.saveFontMetadata(
        {
          name: font.name,
          family: font.family,
          style: font.style,
          source: font.source,
          fileSize: font.fileSize,
          filePath: uploadResult.path,
        },
        user.id
      );

      if (!dbId) continue;

      await deleteInstalledFont(font.id);
      await cacheFontLocally({
        ...font,
        id: dbId,
        filePath: uploadResult.path,
      });
    } catch (err) {
      console.warn(`[fonts] Could not migrate "${font.family}":`, err);
    }
  }
}

export async function ensureFontReady(font: FontMetadata): Promise<void> {
  if (font.data || font.id.startsWith('local-')) {
    await ensureFontInstalled(font);
    return;
  }

  const hydrated = await hydrateFontData(font);
  await ensureFontInstalled(hydrated);
}
