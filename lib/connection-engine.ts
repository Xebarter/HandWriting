import {
  getEntryAnchor,
  getExitAnchor,
  isConnectableLetter,
} from '@/lib/letter-layout';
import {
  buildTrainingConnection,
  buildTrainingConnectorPath,
  refreshTrainingConnection,
  renderTrainingConnections,
  sampleTraceDots,
  TrainingRenderOptions,
} from '@/lib/connection-patterns';
import { ConnectionPoint, LetterBox, LetterConnection } from '@/lib/types';
import { HandwritingMode } from '@/lib/types';

const SNAP_RADIUS = 22;

export function createConnectionId(): string {
  return `conn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Connect every letter to the next connectable letter on the same line (skips spaces) */
export function autoConnectLetters(
  layout: LetterBox[],
  options?: {
    color?: string;
    width?: number;
    getCharStyle?: (charIndex: number) => { mode: HandwritingMode; linksEnabled: boolean };
  }
): LetterConnection[] {
  const color = options?.color ?? '#6b7280';
  const width = options?.width ?? 2;
  const connections: LetterConnection[] = [];
  const connectable = layout.filter((box) => isConnectableLetter(box.char));

  for (let i = 0; i < connectable.length - 1; i++) {
    const from = connectable[i];
    const to = connectable[i + 1];

    if (from.lineIndex !== to.lineIndex) {
      continue;
    }

    const fromStyle = options?.getCharStyle?.(from.charIndex);
    const toStyle = options?.getCharStyle?.(to.charIndex);
    if (fromStyle && !fromStyle.linksEnabled) continue;
    if (toStyle && !toStyle.linksEnabled) continue;

    const connection = buildTrainingConnection(from, to, color, width, 'auto');
    connection.mode = toStyle?.mode ?? fromStyle?.mode;
    connections.push(connection);
  }

  return connections;
}

export function renderConnections(
  ctx: CanvasRenderingContext2D,
  connections: LetterConnection[],
  options: TrainingRenderOptions
): void {
  renderTrainingConnections(ctx, connections, options);
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function findNearestExitAnchor(
  layout: LetterBox[],
  x: number,
  y: number,
  radius = SNAP_RADIUS
): LetterBox | null {
  let nearest: LetterBox | null = null;
  let nearestDistance = radius;

  for (const box of layout) {
    if (!isConnectableLetter(box.char)) continue;
    const anchor = getExitAnchor(box);
    const d = distance(anchor, { x, y });
    if (d <= nearestDistance) {
      nearest = box;
      nearestDistance = d;
    }
  }

  return nearest;
}

export function findNearestEntryAnchor(
  layout: LetterBox[],
  x: number,
  y: number,
  fromCharIndex: number,
  radius = SNAP_RADIUS
): LetterBox | null {
  let nearest: LetterBox | null = null;
  let nearestDistance = radius;

  for (const box of layout) {
    if (!isConnectableLetter(box.char)) continue;
    if (box.charIndex <= fromCharIndex) continue;

    const anchor = getEntryAnchor(box);
    const d = distance(anchor, { x, y });
    if (d <= nearestDistance) {
      nearest = box;
      nearestDistance = d;
    }
  }

  return nearest;
}

export function buildManualConnection(
  from: LetterBox,
  to: LetterBox,
  _dragPoints: ConnectionPoint[],
  color: string,
  width: number,
  mode?: HandwritingMode
): LetterConnection {
  const connection = buildTrainingConnection(from, to, color, width, 'manual');
  connection.mode = mode;
  return connection;
}

export function buildConnectionPreview(from: LetterBox, to: LetterBox): ConnectionPoint[] {
  return buildTrainingConnectorPath(from, to);
}

export function reconcileConnections(
  connections: LetterConnection[],
  text: string,
  layout: LetterBox[]
): LetterConnection[] {
  const boxByIndex = new Map(layout.map((box) => [box.charIndex, box]));

  return connections
    .filter((connection) => {
      const from = boxByIndex.get(connection.fromCharIndex);
      const to = boxByIndex.get(connection.toCharIndex);
      return (
        from &&
        to &&
        text[from.charIndex] === from.char &&
        text[to.charIndex] === to.char
      );
    })
    .map((connection) => {
      const from = boxByIndex.get(connection.fromCharIndex)!;
      const to = boxByIndex.get(connection.toCharIndex)!;
      return refreshTrainingConnection(connection, from, to);
    });
}

function rebaseCharIndex(
  index: number,
  prefix: number,
  removed: number,
  delta: number
): number | null {
  if (index < prefix) return index;
  if (index >= prefix + removed) return index + delta;
  return null;
}

/** Shift or drop letter connections when text is edited. */
export function rebaseConnections(
  connections: LetterConnection[],
  previousText: string,
  nextText: string
): LetterConnection[] {
  if (previousText === nextText) return connections;
  if (!nextText.trim()) return [];

  let prefix = 0;
  while (
    prefix < previousText.length &&
    prefix < nextText.length &&
    previousText[prefix] === nextText[prefix]
  ) {
    prefix += 1;
  }

  let prevSuffix = previousText.length - 1;
  let nextSuffix = nextText.length - 1;
  while (
    prevSuffix >= prefix &&
    nextSuffix >= prefix &&
    previousText[prevSuffix] === nextText[nextSuffix]
  ) {
    prevSuffix -= 1;
    nextSuffix -= 1;
  }

  const removed = prevSuffix - prefix + 1;
  const inserted = nextSuffix - prefix + 1;
  const delta = inserted - removed;

  return connections
    .map((connection) => {
      const newFrom = rebaseCharIndex(connection.fromCharIndex, prefix, removed, delta);
      const newTo = rebaseCharIndex(connection.toCharIndex, prefix, removed, delta);

      if (newFrom === null || newTo === null) return null;
      if (newFrom >= nextText.length || newTo >= nextText.length) return null;
      if (newFrom === newTo) return null;

      return {
        ...connection,
        fromCharIndex: newFrom,
        toCharIndex: newTo,
      };
    })
    .filter((connection): connection is LetterConnection => connection !== null);
}

export function hasConnection(
  connections: LetterConnection[],
  fromCharIndex: number,
  toCharIndex: number
): boolean {
  return connections.some(
    (connection) =>
      connection.fromCharIndex === fromCharIndex &&
      connection.toCharIndex === toCharIndex
  );
}

export { sampleTraceDots };
