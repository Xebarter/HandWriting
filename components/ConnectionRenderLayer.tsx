'use client';

import React, { useMemo } from 'react';
import { PAGE_HEIGHT } from '@/lib/document-constants';
import { HandwritingMode, LetterConnection } from '@/lib/types';
import { sampleTraceDots } from '@/lib/connection-engine';

interface ConnectionRenderLayerProps {
  width: number;
  height: number;
  connections: LetterConnection[];
  mode: HandwritingMode;
  dotSpacing: number;
  dotColor: string;
  strokeColor: string;
  strokeWidth: number;
  clipPageIndex?: number;
}

export const ConnectionRenderLayer: React.FC<ConnectionRenderLayerProps> = ({
  width,
  height,
  connections,
  mode,
  dotSpacing,
  dotColor,
  strokeColor,
  strokeWidth,
  clipPageIndex,
}) => {
  const rendered = useMemo(
    () =>
      connections.map((connection) => ({
        id: connection.id,
        mode: connection.mode,
        points: connection.points,
        dots: sampleTraceDots(connection.points, dotSpacing),
      })),
    [connections, dotSpacing]
  );
  const dotRadius = Math.max(1.8, strokeWidth * 0.45);

  if (rendered.length === 0) {
    return null;
  }

  const viewportHeight = clipPageIndex !== undefined ? PAGE_HEIGHT : height;
  const pageOffset = clipPageIndex !== undefined ? clipPageIndex * PAGE_HEIGHT : 0;

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-[15] overflow-hidden"
      width={width}
      height={viewportHeight}
      viewBox={`0 0 ${width} ${viewportHeight}`}
      preserveAspectRatio="none"
      aria-hidden
      style={{ width: `${width}px`, height: `${viewportHeight}px` }}
    >
      <g transform={`translate(0 ${-pageOffset})`}>
        {rendered.map((connection) => (
          <g key={connection.id}>
            {(connection.mode ?? mode) === 'solid' && connection.points.length > 1 && (
              <polyline
                points={connection.points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.95}
              />
            )}

            {((connection.mode ?? mode) === 'outline' || (connection.mode ?? mode) === 'arrow-guides') &&
              connection.points.length > 1 && (
                <polyline
                  points={connection.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="5 5"
                  opacity={0.85}
                />
              )}

            {((connection.mode ?? mode) === 'dotted' || (connection.mode ?? mode) === 'guide-lines') &&
              connection.dots.map((dot, index) => (
                <circle key={`${connection.id}-dot-${index}`} cx={dot.x} cy={dot.y} r={dotRadius} fill={dotColor} />
              ))}
          </g>
        ))}
      </g>
    </svg>
  );
};
