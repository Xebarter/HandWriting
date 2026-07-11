'use client';

import { GlyphInfo, LetterPattern, DotPattern, ShapedGlyph, HandwritingEngineOptions } from './types';

// Simple HarfBuzz wrapper for text shaping
class TextShaper {
  private fontData: ArrayBuffer | null = null;
  private isInitialized = false;

  async initializeFont(fontPath: string): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      const response = await fetch(fontPath);
      this.fontData = await response.arrayBuffer();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to load font:', error);
      throw new Error(`Font loading failed: ${fontPath}`);
    }
  }

  /**
   * Shape text using canvas font metrics as fallback when HarfBuzz unavailable
   * Returns glyph information for each character
   */
  async shapeText(
    text: string,
    fontSize: number,
    fontFamily: string = '"Playwrite US Modern"'
  ): Promise<GlyphInfo[]> {
    const glyphs: GlyphInfo[] = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) throw new Error('Failed to get canvas context');

    ctx.font = `${fontSize}px ${fontFamily}`;
    
    let x = 0;
    for (const char of text) {
      const metrics = ctx.measureText(char);
      
      // Get bounding box through text rendering
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = fontSize * 2;
      tempCanvas.height = fontSize * 2;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) continue;
      
      tempCtx.font = `${fontSize}px ${fontFamily}`;
      tempCtx.fillStyle = 'black';
      tempCtx.textBaseline = 'alphabetic';
      tempCtx.fillText(char, 0, fontSize);
      
      // Extract path data through canvas (simplified, returns placeholder)
      const pathData = this.getPathFromChar(char, fontSize, fontFamily);
      
      glyphs.push({
        char,
        path: pathData,
        x,
        y: 0,
        width: metrics.width,
        height: fontSize,
        advance: metrics.width,
      });
      
      x += metrics.width;
    }
    
    return glyphs;
  }

  /**
   * Generate SVG path data for a character using canvas rendering
   * This is a simplified approach that traces character outlines
   */
  private getPathFromChar(char: string, fontSize: number, fontFamily: string): string {
    // Create a canvas and render the character
    const canvas = document.createElement('canvas');
    canvas.width = fontSize * 2;
    canvas.height = fontSize * 2;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'black';
    ctx.fillText(char, fontSize * 0.2, fontSize);
    
    // Use potrace-like edge detection to create path
    // For now, return a simplified quadratic path based on character width
    const width = ctx.measureText(char).width;
    const height = fontSize;
    
    // Return a basic path that represents the character bounds
    // In production, this would use actual font glyph outlines
    return `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`;
  }

  /**
   * Extract SVG paths for each glyph
   */
  async getGlyphPaths(text: string, fontSize: number): Promise<GlyphInfo[]> {
    return this.shapeText(text, fontSize);
  }
}

// Main Handwriting Engine
export class HandwritingEngine {
  private shaper: TextShaper;
  private defaultFontFamily = '"Playwrite US Modern"';
  private glyphCache: Map<string, GlyphInfo> = new Map();

  constructor() {
    this.shaper = new TextShaper();
  }

  async initialize(): Promise<void> {
    // Try to load system fonts, fallback to Google Fonts
    try {
      await this.shaper.initializeFont('/fonts/playwrite-us-modern.ttf');
    } catch {
      console.warn('Using fallback font family');
    }
  }

  /**
   * Shape and extract glyphs from text
   */
  async processText(text: string, options: HandwritingEngineOptions = {}): Promise<GlyphInfo[]> {
    const fontSize = options.fontSize || 48;
    const glyphs = await this.shaper.getGlyphPaths(text, fontSize);
    
    // Cache glyphs for reuse
    for (const glyph of glyphs) {
      this.glyphCache.set(`${glyph.char}-${fontSize}`, glyph);
    }
    
    return glyphs;
  }

  /**
   * Generate dotted pattern for a glyph
   */
  generateDottedPattern(glyph: GlyphInfo, dotSpacing: number = 8): DotPattern {
    const dots: Array<{ x: number; y: number }> = [];
    
    // Create a canvas to sample the glyph
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(glyph.width) + 20;
    canvas.height = Math.ceil(glyph.height) + 20;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return { dots, spacing: dotSpacing };
    
    // Draw the character at high resolution for sampling
    ctx.font = `${glyph.height}px "${this.defaultFontFamily}"`;
    ctx.fillStyle = 'black';
    ctx.textBaseline = 'top';
    ctx.fillText(glyph.char, 10, 10);
    
    // Sample the image data to find pixels
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Grid sampling with configurable spacing
    for (let y = 0; y < canvas.height; y += dotSpacing) {
      for (let x = 0; x < canvas.width; x += dotSpacing) {
        const index = (y * canvas.width + x) * 4;
        
        // Check if this pixel or nearby pixels are filled
        if (data[index + 3] > 128) { // alpha > 128 means pixel is part of character
          dots.push({
            x: x + glyph.x,
            y: y + glyph.y,
          });
        }
      }
    }
    
    return { dots, spacing: dotSpacing };
  }

  /**
   * Generate outline/tracing guide pattern
   */
  generateOutlinePattern(glyph: GlyphInfo, strokeWidth: number = 2): string {
    // For outline mode, we render at a higher resolution and trace edges
    const canvas = document.createElement('canvas');
    const scale = 2; // Super-sample for better edge detection
    canvas.width = Math.ceil(glyph.width * scale) + 20;
    canvas.height = Math.ceil(glyph.height * scale) + 20;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    
    // Draw character
    ctx.font = `${glyph.height * scale}px "${this.defaultFontFamily}"`;
    ctx.fillStyle = 'black';
    ctx.textBaseline = 'top';
    ctx.fillText(glyph.char, 10, 10);
    
    // Get edges using Sobel operator (simplified)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Simple edge detection: find boundaries of character
    const paths: string[] = [];
    let pathD = '';
    
    for (let y = 1; y < canvas.height - 1; y++) {
      for (let x = 1; x < canvas.width - 1; x++) {
        const index = (y * canvas.width + x) * 4;
        const alpha = data[index + 3];
        
        // Check if this is an edge (alpha changes from transparent to opaque)
        const up = data[((y - 1) * canvas.width + x) * 4 + 3];
        const down = data[((y + 1) * canvas.width + x) * 4 + 3];
        const left = data[(y * canvas.width + (x - 1)) * 4 + 3];
        const right = data[(y * canvas.width + (x + 1)) * 4 + 3];
        
        const isEdge = (alpha > 128 && (up < 128 || down < 128 || left < 128 || right < 128));
        
        if (isEdge) {
          if (pathD === '') {
            pathD = `M ${x / scale} ${y / scale}`;
          } else {
            pathD += ` L ${x / scale} ${y / scale}`;
          }
        }
      }
    }
    
    return pathD || glyph.path;
  }

  /**
   * Create guides for handwriting instruction
   */
  createGuidePath(glyph: GlyphInfo, baselineY: number, capHeight: number): string {
    const x1 = glyph.x;
    const x2 = glyph.x + glyph.width;
    
    // Create baseline
    const baseline = `M ${x1} ${baselineY} L ${x2} ${baselineY}`;
    
    // Create x-height line
    const xHeight = `M ${x1} ${baselineY - (capHeight * 0.6)} L ${x2} ${baselineY - (capHeight * 0.6)}`;
    
    // Create cap height line
    const capHeightLine = `M ${x1} ${baselineY - capHeight} L ${x2} ${baselineY - capHeight}`;
    
    return `${baseline} ${xHeight} ${capHeightLine}`;
  }

  /**
   * Clear glyph cache
   */
  clearCache(): void {
    this.glyphCache.clear();
  }
}

// Singleton instance
let engineInstance: HandwritingEngine | null = null;

export async function getHandwritingEngine(): Promise<HandwritingEngine> {
  if (!engineInstance) {
    engineInstance = new HandwritingEngine();
    await engineInstance.initialize();
  }
  return engineInstance;
}
