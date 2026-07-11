'use client';

import { GlyphInfo, LetterPattern, PaperType } from './types';
import { HandwritingEngine } from './handwriting-engine';

export class PatternGenerator {
  private engine: HandwritingEngine;

  constructor(engine: HandwritingEngine) {
    this.engine = engine;
  }

  /**
   * Generate complete letter patterns from text
   */
  async generateLetterPatterns(
    text: string,
    glyphs: GlyphInfo[],
    dotSpacing: number = 8,
    strokeWidth: number = 2
  ): Promise<LetterPattern[]> {
    return glyphs.map((glyph) => ({
      glyphInfo: glyph,
      dots: this.engine.generateDottedPattern(glyph, dotSpacing),
      outline: {
        path: this.engine.generateOutlinePattern(glyph, strokeWidth),
        strokeWidth,
      },
    }));
  }

  /**
   * Create dotted grid background (ruled lines)
   */
  static createRuledPaper(
    width: number,
    height: number,
    lineSpacing: number = 24,
    lineColor: string = '#e0e0e0',
    lineWidth: number = 1
  ): string {
    let path = '';
    
    // Horizontal lines
    for (let y = lineSpacing; y < height; y += lineSpacing) {
      path += `M 0 ${y} L ${width} ${y} `;
    }
    
    return path;
  }

  /**
   * Create grid background
   */
  static createGridPaper(
    width: number,
    height: number,
    gridSize: number = 16,
    gridColor: string = '#f0f0f0',
    gridWidth: number = 0.5
  ): string {
    let path = '';
    
    // Vertical lines
    for (let x = gridSize; x < width; x += gridSize) {
      path += `M ${x} 0 L ${x} ${height} `;
    }
    
    // Horizontal lines
    for (let y = gridSize; y < height; y += gridSize) {
      path += `M 0 ${y} L ${width} ${y} `;
    }
    
    return path;
  }

  /**
   * Create stroke order guides with numbers
   */
  static createStrokeOrderGuides(
    glyph: GlyphInfo,
    strokeCount: number,
    currentStroke: number = 1
  ): {
    label: string;
    x: number;
    y: number;
  } {
    return {
      label: `${currentStroke}/${strokeCount}`,
      x: glyph.x + glyph.width + 8,
      y: glyph.y,
    };
  }

  /**
   * Create directional arrow guides
   */
  static createArrowGuides(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    arrowSize: number = 8
  ): string {
    // Main line
    let path = `M ${startX} ${startY} L ${endX} ${endY}`;
    
    // Calculate arrow direction
    const angle = Math.atan2(endY - startY, endX - startX);
    
    // Arrow head points
    const arrowP1X = endX - arrowSize * Math.cos(angle - Math.PI / 6);
    const arrowP1Y = endY - arrowSize * Math.sin(angle - Math.PI / 6);
    const arrowP2X = endX - arrowSize * Math.cos(angle + Math.PI / 6);
    const arrowP2Y = endY - arrowSize * Math.sin(angle + Math.PI / 6);
    
    path += ` M ${endX} ${endY} L ${arrowP1X} ${arrowP1Y} M ${endX} ${endY} L ${arrowP2X} ${arrowP2Y}`;
    
    return path;
  }

  /**
   * Scale pattern complexity by age level
   */
  static scalePatternsForAge(age: number): {
    dotSpacing: number;
    fontSize: number;
    showGuides: boolean;
    showStrokeOrder: boolean;
    mode: 'dotted' | 'outline' | 'solid';
  } {
    if (age < 4) {
      return {
        dotSpacing: 12,
        fontSize: 64,
        showGuides: true,
        showStrokeOrder: true,
        mode: 'dotted',
      };
    } else if (age < 5) {
      return {
        dotSpacing: 10,
        fontSize: 56,
        showGuides: true,
        showStrokeOrder: true,
        mode: 'dotted',
      };
    } else if (age < 6) {
      return {
        dotSpacing: 8,
        fontSize: 48,
        showGuides: true,
        showStrokeOrder: false,
        mode: 'dotted',
      };
    } else {
      return {
        dotSpacing: 6,
        fontSize: 40,
        showGuides: false,
        showStrokeOrder: false,
        mode: 'outline',
      };
    }
  }

  /**
   * Generate complete worksheet layout
   */
  static generateWorksheetLayout(
    text: string,
    glyphs: GlyphInfo[],
    patterns: LetterPattern[],
    paperType: PaperType = 'ruled',
    pageWidth: number = 800,
    pageHeight: number = 1000,
    marginTop: number = 40,
    marginLeft: number = 40
  ): {
    backgroundPath: string;
    layouts: Array<{
      pattern: LetterPattern;
      x: number;
      y: number;
    }>;
  } {
    const layouts = [];
    let x = marginLeft;
    let y = marginTop;
    const lineHeight = 80;
    const letterSpacing = 60;
    
    // Generate background pattern
    const backgroundPath =
      paperType === 'grid'
        ? PatternGenerator.createGridPaper(pageWidth, pageHeight)
        : PatternGenerator.createRuledPaper(pageWidth, pageHeight);
    
    // Layout letters
    for (let i = 0; i < patterns.length; i++) {
      if (x + letterSpacing > pageWidth - marginLeft) {
        x = marginLeft;
        y += lineHeight;
      }
      
      if (y > pageHeight) {
        break;
      }
      
      layouts.push({
        pattern: patterns[i],
        x,
        y,
      });
      
      x += letterSpacing;
    }
    
    return { backgroundPath, layouts };
  }

  /**
   * Generate practice lines for continuous text
   */
  static generatePracticeLines(
    text: string,
    fontSize: number = 48,
    lineSpacing: number = 80,
    pageWidth: number = 800,
    pageHeight: number = 1000,
    marginLeft: number = 40
  ): Array<{
    text: string;
    x: number;
    y: number;
  }> {
    const lines = [];
    let y = 60;
    let line = '';
    let lineWidth = marginLeft;
    const charWidth = fontSize * 0.5; // Approximate char width
    
    for (const char of text) {
      lineWidth += charWidth;
      
      if (lineWidth > pageWidth - marginLeft && line) {
        lines.push({
          text: line,
          x: marginLeft,
          y,
        });
        line = '';
        lineWidth = marginLeft + charWidth;
        y += lineSpacing;
      }
      
      if (y > pageHeight) {
        break;
      }
      
      line += char;
    }
    
    if (line) {
      lines.push({
        text: line,
        x: marginLeft,
        y,
      });
    }
    
    return lines;
  }

  /**
   * Create dotted word template
   */
  static createDottedWordTemplate(
    word: string,
    fontSize: number = 48,
    letterSpacing: number = 10,
    startX: number = 40,
    startY: number = 100,
    dotSpacing: number = 6
  ): {
    dots: Array<{ x: number; y: number }>;
    letterBounds: Array<{ start: number; end: number; char: string }>;
  } {
    const dots: Array<{ x: number; y: number }> = [];
    const letterBounds: Array<{ start: number; end: number; char: string }> = [];
    
    let currentX = startX;
    
    // For each letter, create a grid of dots in its bounding area
    for (const char of word) {
      const letterWidth = fontSize * 0.5; // Approximate
      const letterBoundsStart = dots.length;
      
      for (let y = startY; y < startY + fontSize; y += dotSpacing) {
        for (let x = currentX; x < currentX + letterWidth; x += dotSpacing) {
          dots.push({ x, y });
        }
      }
      
      letterBounds.push({
        start: letterBoundsStart,
        end: dots.length,
        char,
      });
      
      currentX += letterWidth + letterSpacing;
    }
    
    return { dots, letterBounds };
  }
}
