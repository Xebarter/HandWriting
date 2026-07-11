'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { PAGE_HEIGHT } from '@/lib/document-constants';
import { HandwritingMode, LetterBox, LetterConnection } from '@/lib/types';
import {
  buildConnectionPreview,
  buildManualConnection,
  findNearestEntryAnchor,
  findNearestExitAnchor,
  hasConnection,
} from '@/lib/connection-engine';
import { isConnectableLetter, getEntryAnchor, getExitAnchor } from '@/lib/letter-layout';
import { sampleTraceDots } from '@/lib/connection-engine';
import { cn } from '@/lib/utils';

interface LetterConnectionLayerProps {
  width: number;
  height: number;
  layout: LetterBox[];
  connections: LetterConnection[];
  onConnectionsChange: (connections: LetterConnection[]) => void;
  active: boolean;
  connectionColor: string;
  connectionWidth: number;
  mode: HandwritingMode;
  dotSpacing: number;
  dotColor: string;
  clipPageIndex?: number;
}

function toClippedPageCoords(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  logicalWidth: number,
  pageOffset: number
) {
  return {
    x: ((clientX - rect.left) / rect.width) * logicalWidth,
    y: ((clientY - rect.top) / rect.height) * PAGE_HEIGHT + pageOffset,
  };
}

export const LetterConnectionLayer: React.FC<LetterConnectionLayerProps> = ({
  width,
  height,
  layout,
  connections,
  onConnectionsChange,
  active,
  connectionColor,
  connectionWidth,
  mode,
  dotSpacing,
  dotColor,
  clipPageIndex,
}) => {
  const layerRef = useRef<HTMLDivElement>(null);
  const [dragFrom, setDragFrom] = useState<LetterBox | null>(null);
  const [hoverTarget, setHoverTarget] = useState<LetterBox | null>(null);

  const previewPath = useMemo(() => {
    if (!dragFrom || !hoverTarget) return null;
    return buildConnectionPreview(dragFrom, hoverTarget);
  }, [dragFrom, hoverTarget]);

  const previewDots = useMemo(() => {
    if (!previewPath) return [];
    return sampleTraceDots(previewPath, dotSpacing);
  }, [previewPath, dotSpacing]);

  const resetDrag = useCallback(() => {
    setDragFrom(null);
    setHoverTarget(null);
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!active || !layerRef.current) return;

      const rect = layerRef.current.getBoundingClientRect();
      const point = toClippedPageCoords(
        event.clientX,
        event.clientY,
        rect,
        width,
        (clipPageIndex ?? 0) * PAGE_HEIGHT
      );
      const fromBox = findNearestExitAnchor(layout, point.x, point.y);
      if (!fromBox) return;

      event.currentTarget.setPointerCapture(event.pointerId);
      setDragFrom(fromBox);
      setHoverTarget(null);
    },
    [active, clipPageIndex, layout, width]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragFrom || !layerRef.current) return;

      const rect = layerRef.current.getBoundingClientRect();
      const point = toClippedPageCoords(
        event.clientX,
        event.clientY,
        rect,
        width,
        (clipPageIndex ?? 0) * PAGE_HEIGHT
      );
      const toBox = findNearestEntryAnchor(layout, point.x, point.y, dragFrom.charIndex);
      setHoverTarget(toBox);
    },
    [clipPageIndex, dragFrom, layout, width]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragFrom || !layerRef.current) {
        resetDrag();
        return;
      }

      const rect = layerRef.current.getBoundingClientRect();
      const point = toClippedPageCoords(
        event.clientX,
        event.clientY,
        rect,
        width,
        (clipPageIndex ?? 0) * PAGE_HEIGHT
      );
      const toBox =
        hoverTarget ?? findNearestEntryAnchor(layout, point.x, point.y, dragFrom.charIndex);

      if (toBox && !hasConnection(connections, dragFrom.charIndex, toBox.charIndex)) {
        const connection = buildManualConnection(
          dragFrom,
          toBox,
          [],
          connectionColor,
          connectionWidth,
          mode
        );
        onConnectionsChange([...connections, connection]);
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      resetDrag();
    },
    [
      connections,
      connectionColor,
      connectionWidth,
      dragFrom,
      hoverTarget,
      layout,
      onConnectionsChange,
      resetDrag,
      width,
      clipPageIndex,
    ]
  );

  if (!active) {
    return null;
  }

  const viewportHeight = clipPageIndex !== undefined ? PAGE_HEIGHT : height;
  const pageOffset = clipPageIndex !== undefined ? clipPageIndex * PAGE_HEIGHT : 0;

  return (
    <div
      ref={layerRef}
      className={cn('absolute left-0 top-0 z-20 touch-none overflow-hidden', active && 'cursor-crosshair')}
      style={{ width, height: viewportHeight }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={resetDrag}
      aria-label="Letter connection drawing layer"
    >
      <svg
        className="pointer-events-none absolute left-0 top-0 overflow-visible"
        width={width}
        height={viewportHeight}
        viewBox={`0 0 ${width} ${viewportHeight}`}
        preserveAspectRatio="none"
        style={{ width: `${width}px`, height: `${viewportHeight}px` }}
      >
        <g transform={`translate(0 ${-pageOffset})`}>
        {layout
          .filter((box) => isConnectableLetter(box.char))
          .map((box) => {
            const exit = getExitAnchor(box);
            const entry = getEntryAnchor(box);
            return (
              <g key={box.charIndex}>
                <circle cx={exit.x} cy={exit.y} r={5} fill="rgba(46, 125, 50, 0.45)" />
                <text x={exit.x} y={exit.y + 14} textAnchor="middle" fontSize="8" fill="#2e7d32">
                  start
                </text>
                <circle cx={entry.x} cy={entry.y} r={5} fill="rgba(24, 90, 189, 0.35)" />
                <text x={entry.x} y={entry.y - 8} textAnchor="middle" fontSize="8" fill="#185abd">
                  next
                </text>
              </g>
            );
          })}

        {previewPath && previewPath.length > 1 && (
          <>
            <polyline
              points={previewPath.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke={connectionColor}
              strokeWidth={connectionWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="5 5"
              opacity={0.45}
            />
            {(mode === 'dotted' || mode === 'guide-lines') &&
              previewDots.map((dot, index) => (
                <circle
                  key={`preview-dot-${index}`}
                  cx={dot.x}
                  cy={dot.y}
                  r={1.8}
                  fill={dotColor}
                  opacity={0.9}
                />
              ))}
          </>
        )}
        </g>
      </svg>
    </div>
  );
};
