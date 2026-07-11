const STORAGE_KEY = 'handwriting-worksheet-draft';

export function getSavedWorksheetDraft(): string {
  if (typeof window === 'undefined') return '';

  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveWorksheetDraft(text: string): void {
  if (typeof window === 'undefined') return;

  try {
    if (text) {
      localStorage.setItem(STORAGE_KEY, text);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors.
  }
}

export function clearWorksheetDraft(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}
