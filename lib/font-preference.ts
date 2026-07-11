const STORAGE_KEY = 'handwriting-selected-font';

export const DEFAULT_FONT_FAMILY = 'Playwrite US Modern';

export interface SavedFontPreference {
  family: string;
  fontId?: string;
}

export function getSavedFontPreference(): SavedFontPreference | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as SavedFontPreference;
    if (!parsed?.family || typeof parsed.family !== 'string') return null;

    return {
      family: parsed.family,
      fontId: typeof parsed.fontId === 'string' ? parsed.fontId : undefined,
    };
  } catch {
    return null;
  }
}

export function saveFontPreference(preference: SavedFontPreference): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
  } catch {
    // Ignore quota or privacy errors.
  }
}

export function clearFontPreference(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}
