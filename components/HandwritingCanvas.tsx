'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, forwardRef } from 'react';
import { HandwritingMode, LetterPattern, Stroke, ImageAsset, LayoutConfig, LetterConnection } from '@/lib/types';
import { DEFAULT_FONT_SIZE, PAGE_HEIGHT, PAGE_MARGIN } from '@/lib/document-constants';
import { getLineHeight, getRuledRowHeight } from '@/lib/text-layout';
import { drawRuledLinesFromLayout, drawRuledRowLines, ruledRowGuide } from '@/lib/ruled-lines';
import { connectionStrokeWidthForRenderSize, measureRuledFont, RuledFontMetrics } from '@/lib/font-metrics';
import { drawPageMarginLines, pageContentArea } from '@/lib/page-margins';
import { drawWorksheetText, drawWorksheetTextFromLayout } from '@/lib/canvas-text-renderer';
import { measureWorksheetLayout, WorksheetTextLayout } from '@/lib/text-line-layout';
import { renderConnections } from '@/lib/connection-engine';
import * as drawingEngine from '@/lib/drawing-engine';
import { renderLayout } from '@/lib/layout-engine';
import { renderImageOnCanvas } from '@/lib/image-handler';

interface HandwritingCanvasProps {
  text: string;
  mode: HandwritingMode;
  patterns?: LetterPattern[];
  fontSize?: number;
  dotSpacing?: number;
  strokeWidth?: number;
  paperType?: 'blank' | 'ruled' | 'grid';
  showGuides?: boolean;
  showStrokeOrder?: boolean;
  width?: number;
  height?: number;
  backgroundColor?: string;
  textColor?: string;
  dotColor?: string;
  guideColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  className?: string;
  // New drawing props
  drawingMode?: boolean;
  drawingColor?: string;
  drawingWidth?: number;
  drawingStrokes?: Stroke[];
  onDrawingChange?: (strokes: Stroke[]) => void;
  // Layout and images
  layout?: LayoutConfig;
  images?: ImageAsset[];
  // Font selection
  selectedFont?: string;
  fontMetrics?: RuledFontMetrics;
  pageMargin?: number;
  bare?: boolean;
  connections?: LetterConnection[];
  getCharMode?: (charIndex: number) => HandwritingMode;
  getCharFontSize?: (charIndex: number) => number;
  getCharAlign?: (charIndex: number) => 'left' | 'center' | 'right';
  getCharColor?: (charIndex: number) => string;
  getCharLettersTouching?: (charIndex: number) => boolean;
  /** When set, only render this page slice (print-layout view). Full document height is still used internally. */
  clipPageIndex?: number;
  /** Precomputed layout — skips re-layout during canvas paint for faster typing. */
  textLayout?: WorksheetTextLayout | null;
  pageCount?: number;
}

export const HandwritingCanvas = forwardRef<HTMLCanvasElement, HandwritingCanvasProps>(
  (
    {
      text,
      mode,
      patterns = [],
      fontSize = DEFAULT_FONT_SIZE,
      dotSpacing = 8,
      strokeWidth = 2,
      paperType = 'blank',
      showGuides = false,
      showStrokeOrder = false,
      width = 800,
      height = 600,
      backgroundColor = '#ffffff',
      textColor = '#000000',
      dotColor = '#cccccc',
      guideColor = '#e0e0e0',
      textAlign = 'left',
      className,
      drawingMode = false,
      drawingColor = '#000000',
      drawingWidth = 3,
      drawingStrokes = [],
      onDrawingChange,
      layout,
      images = [],
      selectedFont,
      fontMetrics,
      pageMargin = PAGE_MARGIN,
      bare = false,
      connections = [],
      getCharMode,
      getCharFontSize,
      getCharAlign,
      getCharColor,
      getCharLettersTouching,
      clipPageIndex,
      textLayout: providedTextLayout,
      pageCount: providedPageCount,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const displayHeight = clipPageIndex === undefined ? height : PAGE_HEIGHT;
    const [isRendering, setIsRendering] = useState(false);
    const drawingContextRef = useRef<ReturnType<typeof drawingEngine.initializeCanvas> | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
      if (!ref || !canvasRef.current) return;

      if (typeof ref === 'function') {
        ref(canvasRef.current);
      } else {
        (ref as React.MutableRefObject<HTMLCanvasElement | null>).current = canvasRef.current;
      }
    }, [ref, canvasRef.current]);

    useEffect(() => {
      if (canvasRef.current && !drawingContextRef.current) {
      drawingContextRef.current = drawingEngine.initializeCanvas(canvasRef.current);
      if (drawingStrokes.length > 0 && drawingContextRef.current) {
        drawingEngine.importStrokes(drawingContextRef.current, drawingStrokes);
      }
    }
  }, []);

  // Drawing event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingMode || !drawingContextRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    drawingEngine.startStroke(drawingContextRef.current, x, y, drawingColor, drawingWidth, 'pen');
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingMode || !isDrawing || !drawingContextRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    drawingEngine.addStrokePoint(drawingContextRef.current, x, y);
    renderCanvas();
  };

  const handleMouseUp = () => {
    if (!drawingMode || !isDrawing || !drawingContextRef.current) return;

    setIsDrawing(false);
    const stroke = drawingEngine.endStroke(drawingContextRef.current);
    if (stroke && onDrawingChange) {
      onDrawingChange(drawingContextRef.current.strokes);
    }
    renderCanvas();
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawingMode || !drawingContextRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    setIsDrawing(true);
    drawingEngine.startStroke(drawingContextRef.current, x, y, drawingColor, drawingWidth, 'pen');
    e.preventDefault();
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawingMode || !isDrawing || !drawingContextRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const pressure = (touch as Touch & { force?: number }).force ?? 1;

    drawingEngine.addStrokePoint(drawingContextRef.current, x, y, pressure);
    renderCanvas();
    e.preventDefault();
  };

  const handleTouchEnd = () => {
    if (!drawingMode || !isDrawing || !drawingContextRef.current) return;

    setIsDrawing(false);
    const stroke = drawingEngine.endStroke(drawingContextRef.current);
    if (stroke && onDrawingChange) {
      onDrawingChange(drawingContextRef.current.strokes);
    }
    renderCanvas();
  };

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, displayHeight);

    ctx.save();
    if (clipPageIndex !== undefined) {
      ctx.translate(0, -clipPageIndex * PAGE_HEIGHT);
    }

    if (layout) {
      renderLayout(ctx, layout, width, height);
    } else if (paperType !== 'blank') {
      const resolvedMetrics =
        fontMetrics ?? measureRuledFont(selectedFont || 'Playwrite US Modern', fontSize);
      const textLayout =
        paperType === 'ruled' && text
          ? (providedTextLayout ??
            measureWorksheetLayout({
              text,
              mode,
              fontSize,
              dotSpacing,
              strokeWidth,
              textColor,
              dotColor,
              font: selectedFont,
              maxWidth: width,
              textAlign,
              margin: pageMargin,
              fontMetrics: resolvedMetrics,
              getCharMode,
              getCharFontSize,
              getCharAlign,
              getCharColor,
              getCharLettersTouching,
            }))
          : null;

      if (paperType === 'ruled' && textLayout) {
        drawRuledLinesFromLayout(ctx, width, height, textLayout, resolvedMetrics);
      } else {
        drawBackgroundPattern(
          ctx,
          width,
          height,
          paperType,
          fontSize,
          pageMargin,
          resolvedMetrics
        );
      }
    }

    drawPageMarginLines(ctx, width, height, pageMargin);

    images.forEach((image) => {
      renderImageOnCanvas(ctx, image);
    });

    if (!drawingMode || (drawingMode && drawingStrokes.length === 0)) {
      if (patterns.length > 0) {
        drawPatterns(ctx, patterns, mode, fontSize, dotSpacing, strokeWidth, textColor, dotColor, selectedFont);
      } else if (text) {
        const drawOptions = {
          text,
          mode,
          fontSize,
          dotSpacing,
          strokeWidth,
          textColor,
          dotColor,
          font: selectedFont,
          maxWidth: width,
          textAlign,
          margin: pageMargin,
          fontMetrics,
          getCharMode,
          getCharFontSize,
          getCharAlign,
          getCharColor,
          getCharLettersTouching,
        };

        if (providedTextLayout) {
          drawWorksheetTextFromLayout(ctx, providedTextLayout, drawOptions, clipPageIndex);
        } else {
          drawWorksheetText(ctx, drawOptions, clipPageIndex);
        }
      }
    }

    if (connections.length > 0) {
      const connectionStrokeWidth = connectionStrokeWidthForRenderSize(
        fontMetrics?.renderFontSize ?? fontSize
      );
      renderConnections(ctx, connections, {
        mode,
        dotSpacing,
        dotColor,
        strokeColor: textColor,
        strokeWidth: connectionStrokeWidth,
      });
    }

    if (drawingStrokes.length > 0) {
      drawingStrokes.forEach((stroke) => {
        drawSavedStroke(ctx, stroke);
      });
    }

    ctx.restore();
  }, [
    text,
    mode,
    patterns,
    fontSize,
    dotSpacing,
    strokeWidth,
    paperType,
    showGuides,
    showStrokeOrder,
    width,
    height,
    backgroundColor,
    textColor,
    dotColor,
    guideColor,
    textAlign,
    drawingMode,
    drawingStrokes,
    layout,
    images,
    selectedFont,
    fontMetrics,
    pageMargin,
    connections,
    getCharMode,
    getCharFontSize,
    getCharAlign,
    getCharColor,
    getCharLettersTouching,
    clipPageIndex,
    displayHeight,
    providedTextLayout,
    providedPageCount,
  ]);

  const drawBackgroundPattern = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    paperType: string,
    fontSize: number,
    margin: number,
    metrics?: RuledFontMetrics
  ) => {
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;

    if (paperType === 'ruled') {
      const ruledHeight = metrics?.ruledHeight ?? getRuledRowHeight(fontSize);
      const lineHeight = metrics?.lineHeight ?? getLineHeight(fontSize);
      const capAscent = metrics?.capAscent ?? ruledHeight;
      const xAscent = metrics?.xAscent ?? ruledHeight * 0.5;
      const pageCount = Math.max(1, Math.ceil(height / PAGE_HEIGHT));

      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        const pageTop = pageIndex * PAGE_HEIGHT;
        const pageBottom = Math.min(height, pageTop + PAGE_HEIGHT);
        const area = pageContentArea(pageTop, pageBottom, width, margin);
        const firstBaseline = area.top + ruledHeight;

        for (
          let baselineY = firstBaseline;
          baselineY <= area.bottom;
          baselineY += lineHeight
        ) {
          const guide = ruledRowGuide(baselineY, capAscent, xAscent);
          if (guide.topY < area.top) continue;
          drawRuledRowLines(ctx, guide, area);
        }
      }
    } else if (paperType === 'grid') {
      const gridSize = Math.max(fontSize * 0.8, 16);
      ctx.strokeStyle = '#f0f0f0';
      ctx.lineWidth = 0.5;
      const pageCount = Math.max(1, Math.ceil(height / PAGE_HEIGHT));

      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        const pageTop = pageIndex * PAGE_HEIGHT;
        const pageBottom = Math.min(height, pageTop + PAGE_HEIGHT);
        const area = pageContentArea(pageTop, pageBottom, width, margin);

        for (let x = area.left + gridSize; x < area.right; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, area.top);
          ctx.lineTo(x, area.bottom);
          ctx.stroke();
        }

        for (let y = area.top + gridSize; y < area.bottom; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(area.left, y);
          ctx.lineTo(area.right, y);
          ctx.stroke();
        }
      }
    }
  };

  const drawSavedStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length < 2) return;

    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = stroke.opacity;

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  };

  const drawPatterns = (
    ctx: CanvasRenderingContext2D,
    patterns: LetterPattern[],
    mode: HandwritingMode,
    fontSize: number,
    dotSpacing: number,
    strokeWidth: number,
    textColor: string,
    dotColor: string,
    font?: string
  ) => {
    let x = 40;
    let y = 60;
    const lineHeight = fontSize + 20;
    const letterSpacing = fontSize * 0.7;

    for (const pattern of patterns) {
      if (x + letterSpacing > 800 - 40) {
        x = 40;
        y += lineHeight;
      }

      drawLetterPattern(ctx, pattern, mode, x, y, fontSize, dotSpacing, strokeWidth, textColor, dotColor, font);
      x += letterSpacing;
    }
  };

  const drawLetterPattern = (
    ctx: CanvasRenderingContext2D,
    pattern: LetterPattern,
    mode: HandwritingMode,
    x: number,
    y: number,
    fontSize: number,
    dotSpacing: number,
    strokeWidth: number,
    textColor: string,
    dotColor: string,
    font?: string
  ) => {
    const glyph = pattern.glyphInfo;

    switch (mode) {
      case 'dotted':
        if (pattern.dots) {
          ctx.fillStyle = dotColor;
          for (const dot of pattern.dots.dots) {
            ctx.beginPath();
            ctx.arc(x + dot.x, y + dot.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;

      case 'outline':
        ctx.strokeStyle = textColor;
        ctx.lineWidth = strokeWidth;
        ctx.fillStyle = 'transparent';
        drawCharOutline(ctx, glyph.char, x, y, fontSize);
        break;

      case 'solid':
        ctx.fillStyle = textColor;
        ctx.font = `${fontSize}px ${font || '"Playwrite US Modern"'}, cursive`;
        ctx.textBaseline = 'top';
        ctx.fillText(glyph.char, x, y);
        break;

      case 'guide-lines':
        // Draw guide lines and character
        drawGuideLines(ctx, x, y, fontSize, textColor);
        ctx.fillStyle = textColor;
        ctx.font = `${fontSize}px ${font || '"Playwrite US Modern"'}, cursive`;
        ctx.textBaseline = 'top';
        ctx.globalAlpha = 0.3;
        ctx.fillText(glyph.char, x, y);
        ctx.globalAlpha = 1;
        break;

      case 'arrow-guides':
        // Draw directional arrows
        drawArrowGuides(ctx, glyph.char, x, y, fontSize, textColor);
        break;
    }
  };

  const drawCharOutline = (ctx: CanvasRenderingContext2D, char: string, x: number, y: number, fontSize: number, font?: string) => {
    ctx.save();
    ctx.translate(x, y);

    const fontFamily = font || 'Playwrite US Modern';
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = fontSize * 2;
    tempCanvas.height = fontSize * 2;

    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCtx.font = `${fontSize}px "${fontFamily}", cursive`;
    tempCtx.fillStyle = 'black';
    tempCtx.textBaseline = 'top';
    tempCtx.fillText(char, 0, 0);

    ctx.font = `${fontSize}px "${fontFamily}", cursive`;
    ctx.strokeText(char, 0, 0);

    ctx.restore();
  };

  const drawGuideLines = (ctx: CanvasRenderingContext2D, x: number, baselineY: number, fontSize: number, color: string) => {
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;

    const topLineY = baselineY - fontSize;
    const midLineY = baselineY - fontSize * 0.5;
    const bottomLineY = baselineY;

    // Top guide line
    ctx.beginPath();
    ctx.moveTo(x - 20, topLineY);
    ctx.lineTo(x + fontSize * 0.7, topLineY);
    ctx.stroke();

    // Middle guide line
    ctx.beginPath();
    ctx.moveTo(x - 20, midLineY);
    ctx.lineTo(x + fontSize * 0.7, midLineY);
    ctx.stroke();

    // Baseline
    ctx.beginPath();
    ctx.moveTo(x - 20, bottomLineY);
    ctx.lineTo(x + fontSize * 0.7, bottomLineY);
    ctx.stroke();
  };

  const drawArrowGuides = (ctx: CanvasRenderingContext2D, char: string, x: number, y: number, fontSize: number, color: string) => {
    // Draw faded character
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.2;
    ctx.font = `${fontSize}px "Playwrite US Modern", cursive`;
    ctx.textBaseline = 'top';
    ctx.fillText(char, x, y);
    ctx.globalAlpha = 1;

    // Draw simple directional arrow
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + fontSize * 0.3);
    ctx.lineTo(x + fontSize * 0.5, y + fontSize * 0.7);
    ctx.stroke();

    // Arrow head
    const angle = Math.atan2(fontSize * 0.4, fontSize * 0.5);
    const arrowSize = 8;
    ctx.beginPath();
    ctx.moveTo(x + fontSize * 0.5, y + fontSize * 0.7);
    ctx.lineTo(x + fontSize * 0.5 - arrowSize * Math.cos(angle - Math.PI / 6), y + fontSize * 0.7 - arrowSize * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x + fontSize * 0.5 - arrowSize * Math.cos(angle + Math.PI / 6), y + fontSize * 0.7 - arrowSize * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  };

  useLayoutEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  if (bare) {
    return (
      <canvas
        ref={canvasRef}
        width={width}
        height={displayHeight}
        className={`block bg-white ${className ?? ''} ${
          drawingMode ? 'cursor-crosshair' : bare ? 'pointer-events-none' : 'cursor-text'
        }`}
        style={{ width: `${width}px`, height: `${displayHeight}px` }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={`border border-gray-300 rounded-lg shadow-md bg-white ${className ?? ''} ${
          drawingMode ? 'cursor-crosshair' : 'cursor-default'
        }`}
        style={{
          width: `${width}px`,
          height: `${height}px`,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      {isRendering && <p className="text-sm text-gray-500 mt-2">Rendering...</p>}
      {drawingMode && <p className="text-sm text-blue-600 mt-2">Drawing mode enabled</p>}
    </div>
  );
});
