import { TextRange } from '@/lib/editor-input';
import { LetterConnection, TextStyleRange } from '@/lib/types';

export interface HistoryEntry {
  text: string;
  selection: TextRange;
  connections: LetterConnection[];
  autoLinkEnabled: boolean;
  textStyleRanges: TextStyleRange[];
}

export type EditKind = 'typing' | 'delete' | 'paragraph' | 'paste' | 'other';

const MAX_DEPTH = 100;
const COALESCE_WINDOW_MS = 1000;

export function cloneHistoryEntry(entry: HistoryEntry): HistoryEntry {
  return {
    text: entry.text,
    selection: { ...entry.selection },
    connections: entry.connections.map((connection) => ({
      ...connection,
      points: connection.points.map((point) => ({ ...point })),
    })),
    autoLinkEnabled: entry.autoLinkEnabled,
    textStyleRanges: entry.textStyleRanges.map((range) => ({ ...range })),
  };
}

/**
 * Undo/redo stack with typing coalescing: consecutive character insertions
 * (or deletions) within a short window collapse into one undo step, like
 * Word / Google Docs.
 */
export class UndoHistory {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private lastKind: EditKind | null = null;
  private lastTime = 0;

  /** Record the state as it was *before* an edit is applied. */
  record(previous: HistoryEntry, kind: EditKind, now: number = Date.now()) {
    const coalesce =
      (kind === 'typing' || kind === 'delete') &&
      kind === this.lastKind &&
      now - this.lastTime < COALESCE_WINDOW_MS;

    if (!coalesce) {
      this.undoStack.push(cloneHistoryEntry(previous));
      if (this.undoStack.length > MAX_DEPTH) {
        this.undoStack.shift();
      }
    }

    this.redoStack = [];
    this.lastKind = kind;
    this.lastTime = now;
  }

  /** Stop coalescing (e.g. after a selection move or click). */
  breakCoalescing() {
    this.lastKind = null;
  }

  undo(current: HistoryEntry): HistoryEntry | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.redoStack.push(cloneHistoryEntry(current));
    this.lastKind = null;
    return entry;
  }

  redo(current: HistoryEntry): HistoryEntry | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push(cloneHistoryEntry(current));
    this.lastKind = null;
    return entry;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
