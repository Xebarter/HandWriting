'use client';

import jsPDF from 'jspdf';
import { PAGE_HEIGHT, PAGE_WIDTH } from '@/lib/document-constants';
import { sliceCanvasPage } from '@/lib/canvas-page-slice';
import { ExportOptions } from './types';

export class ExportManager {
  /**
   * Export canvas to PNG
   */
  static readonly MM_PER_INCH = 25.4;
  static readonly STANDARD_DPI = 96;

  private static getCanvasSizeMm(canvas: HTMLCanvasElement): { widthMm: number; heightMm: number } {
    const widthPx = canvas.clientWidth || canvas.width / (window.devicePixelRatio || 1);
    const heightPx = canvas.clientHeight || canvas.height / (window.devicePixelRatio || 1);
    return {
      widthMm: (widthPx / ExportManager.STANDARD_DPI) * ExportManager.MM_PER_INCH,
      heightMm: (heightPx / ExportManager.STANDARD_DPI) * ExportManager.MM_PER_INCH,
    };
  }

  private static fitToBox(
    width: number,
    height: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    const ratio = width / height;
    let fittedWidth = maxWidth;
    let fittedHeight = maxWidth / ratio;

    if (fittedHeight > maxHeight) {
      fittedHeight = maxHeight;
      fittedWidth = maxHeight * ratio;
    }

    return { width: fittedWidth, height: fittedHeight };
  }

  static exportToPNG(canvas: HTMLCanvasElement, filename: string = 'handwriting-worksheet.png'): void {
    canvas.toBlob((blob) => {
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  /**
   * Export a tall worksheet canvas as multiple letter-sized PDF pages.
   */
  static exportMultiPagePDF(
    canvas: HTMLCanvasElement,
    options: Partial<ExportOptions> & { pageCount: number } = { pageCount: 1 }
  ): void {
    const {
      filename = 'handwriting-worksheet.pdf',
      pageCount = 1,
      dpi = 300,
    } = options;

    const pageWidthMm = (PAGE_WIDTH / ExportManager.STANDARD_DPI) * ExportManager.MM_PER_INCH;
    const pageHeightMm = (PAGE_HEIGHT / ExportManager.STANDARD_DPI) * ExportManager.MM_PER_INCH;
    const scale = dpi / ExportManager.STANDARD_DPI;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pageWidthMm, pageHeightMm],
    });

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      if (pageIndex > 0) {
        pdf.addPage([pageWidthMm, pageHeightMm], 'portrait');
      }

      const pageCanvas = sliceCanvasPage(canvas, pageIndex);
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = Math.round(PAGE_WIDTH * scale);
      exportCanvas.height = Math.round(PAGE_HEIGHT * scale);
      const ctx = exportCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(pageCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
      }

      const imgData = exportCanvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, pageWidthMm, pageHeightMm, undefined, 'FAST');
    }

    pdf.save(filename);
  }

  /**
   * Export canvas to PDF
   */
  static exportToPDF(
    canvas: HTMLCanvasElement,
    options: Partial<ExportOptions> = {}
  ): void {
    const {
      pageSize = 'letter',
      filename = 'handwriting-worksheet.pdf',
      contentWidthMm,
      contentHeightMm,
      horizontalAlign = 'left',
      verticalAlign = 'top',
      fullBleed = false,
    } = options;

    // Calculate page dimensions
    let pageWidth: number;
    let pageHeight: number;

    switch (pageSize) {
      case 'A4':
        pageWidth = 210; // mm
        pageHeight = 297; // mm
        break;
      case 'letter':
        pageWidth = 215.9; // mm
        pageHeight = 279.4; // mm
        break;
      default:
        pageWidth = options.pageWidth || 210;
        pageHeight = options.pageHeight || 297;
    }

    const imageSize =
      contentWidthMm && contentHeightMm
        ? { widthMm: contentWidthMm, heightMm: contentHeightMm }
        : ExportManager.getCanvasSizeMm(canvas);

    const imgData = canvas.toDataURL('image/png');

    if (fullBleed && contentWidthMm && contentHeightMm) {
      const pdf = new jsPDF({
        orientation: contentWidthMm > contentHeightMm ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [contentWidthMm, contentHeightMm],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, contentWidthMm, contentHeightMm, undefined, 'FAST');
      pdf.save(filename);
      return;
    }

    const marginMm = 10;
    const fittedSize = ExportManager.fitToBox(
      imageSize.widthMm,
      imageSize.heightMm,
      pageWidth - marginMm * 2,
      pageHeight - marginMm * 2
    );

    const xOffset =
      horizontalAlign === 'center'
        ? (pageWidth - fittedSize.width) / 2
        : horizontalAlign === 'right'
        ? pageWidth - marginMm - fittedSize.width
        : marginMm;

    const yOffset =
      verticalAlign === 'middle'
        ? (pageHeight - fittedSize.height) / 2
        : verticalAlign === 'bottom'
        ? pageHeight - marginMm - fittedSize.height
        : marginMm;

    const pdf = new jsPDF({
      orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [pageWidth, pageHeight],
    });

    pdf.addImage(imgData, 'PNG', xOffset, yOffset, fittedSize.width, fittedSize.height, undefined, 'FAST');
    pdf.save(filename);
  }

  /**
   * Export canvas to SVG
   */
  static exportToSVG(
    canvas: HTMLCanvasElement,
    filename: string = 'handwriting-worksheet.svg'
  ): void {
    const width = canvas.width;
    const height = canvas.height;

    // Convert canvas to image data
    const imgData = canvas.toDataURL('image/png');

    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Add image to SVG
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', imgData);
    image.setAttribute('width', String(width));
    image.setAttribute('height', String(height));

    svg.appendChild(image);

    // Download SVG
    const svgString = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Export to multiple formats
   */
  static async exportMultiple(
    canvas: HTMLCanvasElement,
    formats: Array<'png' | 'pdf' | 'svg'>,
    baseFilename: string = 'handwriting-worksheet'
  ): Promise<void> {
    for (const format of formats) {
      const filename = `${baseFilename}.${format}`;

      switch (format) {
        case 'png':
          this.exportToPNG(canvas, filename);
          break;
        case 'pdf':
          this.exportToPDF(canvas, { filename });
          break;
        case 'svg':
          this.exportToSVG(canvas, filename);
          break;
      }

      // Add small delay between exports
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  /**
   * Get print-ready canvas at 300 DPI
   */
  static createPrintReadyCanvas(
    sourceCanvas: HTMLCanvasElement,
    dpi: number = 300,
    logicalWidth?: number,
    logicalHeight?: number
  ): HTMLCanvasElement {
    if (!(sourceCanvas instanceof HTMLCanvasElement)) {
      console.error('ExportManager.createPrintReadyCanvas expected an HTMLCanvasElement but received:', sourceCanvas);
      return document.createElement('canvas');
    }

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const logicalW = logicalWidth ?? sourceCanvas.width / dpr;
    const logicalH = logicalHeight ?? sourceCanvas.height / dpr;
    const scale = dpi / ExportManager.STANDARD_DPI;

    const printCanvas = document.createElement('canvas');
    printCanvas.width = Math.round(logicalW * scale);
    printCanvas.height = Math.round(logicalH * scale);

    const ctx = printCanvas.getContext('2d');
    if (!ctx) return sourceCanvas;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, printCanvas.width, printCanvas.height);

    return printCanvas;
  }

  /**
   * Create batch exports for worksheets
   */
  static async batchExport(
    canvases: HTMLCanvasElement[],
    format: 'png' | 'pdf' | 'svg' = 'pdf',
    baseFilename: string = 'worksheet'
  ): Promise<void> {
    for (let i = 0; i < canvases.length; i++) {
      const filename = `${baseFilename}-${i + 1}.${format}`;

      switch (format) {
        case 'png':
          this.exportToPNG(canvases[i], filename);
          break;
        case 'pdf':
          this.exportToPDF(canvases[i], { filename });
          break;
        case 'svg':
          this.exportToSVG(canvases[i], filename);
          break;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  /**
   * Generate print-optimized PDF
   */
  static exportPrintOptimized(
    canvas: HTMLCanvasElement,
    options: Partial<ExportOptions> = {},
    logicalSize?: { width: number; height: number }
  ): void {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const logicalW = logicalSize?.width ?? canvas.width / dpr;
    const logicalH = logicalSize?.height ?? canvas.height / dpr;
    const printCanvas = this.createPrintReadyCanvas(canvas, options.dpi || 300, logicalW, logicalH);

    const widthMm = (logicalW / ExportManager.STANDARD_DPI) * ExportManager.MM_PER_INCH;
    const heightMm = (logicalH / ExportManager.STANDARD_DPI) * ExportManager.MM_PER_INCH;

    this.exportToPDF(printCanvas, {
      pageSize: 'letter',
      fullBleed: true,
      ...options,
      contentWidthMm: widthMm,
      contentHeightMm: heightMm,
    });
  }

  /**
   * Export preview/screen version at 96 DPI
   */
  static exportScreenVersion(
    canvas: HTMLCanvasElement,
    filename: string = 'handwriting-preview.png'
  ): void {
    this.exportToPNG(canvas, filename);
  }
}

/**
 * Utility function to copy canvas to clipboard
 */
export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve);
    });

    if (!blob) return false;

    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob,
      }),
    ]);

    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

export interface PrintCanvasOptions {
  title?: string;
  widthMm?: number;
  heightMm?: number;
  pageCount?: number;
}

/**
 * Utility function to print canvas
 */
export function printCanvas(
  canvas: HTMLCanvasElement,
  title: string = 'Handwriting Worksheet',
  options: PrintCanvasOptions = {}
): void {
  const pageWidthMm = options.widthMm ?? (PAGE_WIDTH / 96) * 25.4;
  const pageHeightMm = options.heightMm ?? (PAGE_HEIGHT / 96) * 25.4;
  const pageCount = Math.max(1, options.pageCount ?? 1);

  const pageImages = Array.from({ length: pageCount }, (_, pageIndex) =>
    sliceCanvasPage(canvas, pageIndex).toDataURL('image/png')
  );

  const pagesHtml = pageImages
    .map(
      (src) =>
        `<section class="print-page"><img src="${src}" alt="${title}" /></section>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
  <head>
    <title>${title}</title>
    <style>
      @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body { background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .print-page {
        width: ${pageWidthMm}mm;
        height: ${pageHeightMm}mm;
        page-break-after: always;
        overflow: hidden;
      }
      .print-page:last-child { page-break-after: auto; }
      img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: contain;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    </style>
  </head>
  <body onload="window.focus(); window.print();">
    ${pagesHtml}
  </body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow;
  if (win) {
    win.focus();
    win.print();
  }

  setTimeout(() => {
    if (iframe.parentNode) {
      document.body.removeChild(iframe);
    }
  }, 1000);
}
