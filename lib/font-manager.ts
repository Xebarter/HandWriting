import { FontMetadata, FontFamily, FontStyle } from './types';
import { openDB } from 'idb';
import * as opentype from 'opentype.js';
import { waitForFontMeasure } from '@/lib/font-metrics';

const DB_NAME = 'HandwritingFonts';
const STORE_NAME = 'fonts';
const DB_VERSION = 1;

const installedFamilies = new Set<string>();

async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'woff2':
      return 'font/woff2';
    case 'woff':
      return 'font/woff';
    case 'otf':
      return 'font/otf';
    default:
      return 'font/ttf';
  }
}

function parseStyleFromName(name: string): FontStyle {
  const lower = name.toLowerCase();
  if (lower.includes('bold') && lower.includes('italic')) return 'bold-italic';
  if (lower.includes('bold')) return 'bold';
  if (lower.includes('italic')) return 'italic';
  return 'normal';
}

async function parseFontFile(file: File, buffer: ArrayBuffer): Promise<{
  family: string;
  style: FontStyle;
}> {
  let family = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[-_]/g, ' ');
  let style = parseStyleFromName(file.name);

  try {
    const font = await opentype.parse(buffer);
    const names = font.names as Record<string, { en?: string } | undefined>;
    family =
      names.fontFamily?.en ||
      names.preferredFamily?.en ||
      names.fullName?.en ||
      family;
    const subfamily = names.fontSubfamily?.en || '';
    if (subfamily) {
      style = parseStyleFromName(subfamily);
    }
  } catch {
    // Fall back to filename heuristics
  }

  return { family, style };
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/** Register a font with the browser so canvas and the editor can use it */
export async function installFontToDocument(font: FontMetadata): Promise<void> {
  if (typeof document === 'undefined') return;

  const family = font.family;
  const alreadyLoaded = [...document.fonts].some((f) => f.family === family);
  if (installedFamilies.has(family) && alreadyLoaded) return;

  let buffer = font.data;
  if (!buffer && font.filePath && typeof document !== 'undefined') {
    const { downloadFont } = await import('@/lib/supabase/storage');
    buffer = (await downloadFont(font.filePath)) ?? undefined;
  }
  if (!buffer) {
    const db = await initDB();
    const stored = await db.get(STORE_NAME, font.id);
    buffer = stored?.data;
  }

  if (!buffer) {
    throw new Error(`Font data not available for "${family}"`);
  }

  const face = new FontFace(family, buffer, {
    weight: font.style.includes('bold') ? '700' : '400',
    style: font.style.includes('italic') ? 'italic' : 'normal',
  });

  await face.load();
  document.fonts.add(face);
  installedFamilies.add(family);
}

/** Parse font metadata and binary from a file */
export async function parseFontFromFile(file: File): Promise<{
  family: string;
  style: FontStyle;
  buffer: ArrayBuffer;
}> {
  const buffer = await readFileAsArrayBuffer(file);
  const { family, style } = await parseFontFile(file, buffer);
  return { family, style, buffer };
}

/** Persist font bytes in IndexedDB for fast reload */
export async function cacheFontLocally(font: FontMetadata): Promise<void> {
  const db = await initDB();
  await db.put(STORE_NAME, font);

  if (font.data && !font.previewUrl) {
    const blob = new Blob([font.data], { type: getMimeType(font.name) });
    font.previewUrl = URL.createObjectURL(blob);
  }
}

export async function getCachedFont(fontId: string): Promise<FontMetadata | undefined> {
  const db = await initDB();
  return db.get(STORE_NAME, fontId);
}

/** Import a font file: persist locally and install for rendering */
export async function importFontFile(file: File): Promise<FontMetadata> {
  const { family, style, buffer } = await parseFontFromFile(file);

  const fontId = `local-${family.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
  const fontMetadata: FontMetadata = {
    id: fontId,
    name: family,
    family,
    style,
    source: 'uploaded',
    fileSize: buffer.byteLength,
    uploadedAt: new Date(),
    data: buffer,
  };

  await cacheFontLocally(fontMetadata);
  await installFontToDocument(fontMetadata);
  return fontMetadata;
}

export async function getInstalledFonts(): Promise<FontMetadata[]> {
  const db = await initDB();
  const fonts = await db.getAll(STORE_NAME);
  return fonts.sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
}

export async function getInstalledFontFamilies(): Promise<FontFamily[]> {
  const fonts = await getInstalledFonts();
  const families = new Map<string, FontFamily>();

  fonts.forEach((font) => {
    if (!families.has(font.family)) {
      families.set(font.family, {
        id: font.family,
        name: font.family,
        variants: [],
      });
    }
    families.get(font.family)!.variants.push(font);
  });

  return Array.from(families.values());
}

export async function deleteInstalledFont(fontId: string): Promise<void> {
  const db = await initDB();
  const font = await db.get(STORE_NAME, fontId);
  if (font?.previewUrl) {
    URL.revokeObjectURL(font.previewUrl);
  }
  if (font?.family) {
    installedFamilies.delete(font.family);
  }
  await db.delete(STORE_NAME, fontId);
}

/** Load every saved font into document.fonts (call on app start) */
export async function installAllSavedFonts(): Promise<FontMetadata[]> {
  const fonts = await getInstalledFonts();
  await Promise.all(
    fonts.map((font) =>
      installFontToDocument(font).catch((err) => {
        console.warn(`[fonts] Could not install "${font.family}":`, err);
      })
    )
  );
  return fonts;
}

export async function ensureFontInstalled(font: FontMetadata): Promise<void> {
  await installFontToDocument(font);
}

/** Wait until a family is ready for canvas/CSS rendering */
export async function waitForFontFamily(family: string, size = 48): Promise<void> {
  await waitForFontMeasure(family, size);
}

export function getFontFamilyName(fontMetadata: FontMetadata): string {
  return fontMetadata.family;
}

export async function clearAllFonts(): Promise<void> {
  const db = await initDB();
  await db.clear(STORE_NAME);
  installedFamilies.clear();
}

// Legacy aliases
export const uploadFont = importFontFile;
export const deleteFont = deleteInstalledFont;
export const injectFont = installFontToDocument;
