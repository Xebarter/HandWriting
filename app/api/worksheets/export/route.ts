import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as storage from '@/lib/supabase/storage';
import jsPDF from 'jspdf';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { worksheet, format = 'pdf' } = body;

    if (!worksheet) {
      return NextResponse.json({ error: 'Worksheet data required' }, { status: 400 });
    }

    if (format === 'pdf') {
      return await exportPDF(worksheet, user.id);
    } else if (format === 'json') {
      return await exportJSON(worksheet, user.id);
    } else if (format === 'png') {
      return NextResponse.json({ error: 'PNG export not yet implemented' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  } catch (error) {
    console.error('[v0] Export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    );
  }
}

async function exportPDF(worksheet: any, userId: string) {
  try {
    const pdf = new jsPDF({
      orientation: worksheet.pages[0]?.layout?.orientation || 'portrait',
      unit: 'mm',
      format: worksheet.pages[0]?.layout?.paperSize || 'a4',
    });

    // Add each page
    let isFirstPage = true;
    for (const page of worksheet.pages || []) {
      if (!isFirstPage) {
        pdf.addPage();
      }
      isFirstPage = false;

      // Add text content
      if (page.text) {
        pdf.setFontSize(12);
        pdf.text(page.text, 20, 20);
      }

      // Add page number if configured
      if (worksheet.metadata?.includePageNumbers) {
        pdf.setFontSize(10);
        const pageNumber = page.pageNumber || 1;
        pdf.text(`Page ${pageNumber}`, pdf.internal.pageSize.getWidth() - 20, pdf.internal.pageSize.getHeight() - 10);
      }
    }

    // Generate PDF as blob
    const pdfBlob = pdf.output('blob');

    // Upload to storage
    const fileName = `${worksheet.title || 'worksheet'}-${Date.now()}.pdf`;
    const uploadResult = await storage.uploadWorksheet(pdfBlob, fileName, userId);

    if (!uploadResult) {
      throw new Error('Failed to upload PDF');
    }

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      path: uploadResult.path,
    });
  } catch (error) {
    console.error('[v0] PDF export error:', error);
    throw error;
  }
}

async function exportJSON(worksheet: any, userId: string) {
  try {
    const jsonData = JSON.stringify(worksheet, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });

    const fileName = `${worksheet.title || 'worksheet'}-${Date.now()}.json`;
    const uploadResult = await storage.uploadWorksheet(blob, fileName, userId);

    if (!uploadResult) {
      throw new Error('Failed to upload JSON');
    }

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      path: uploadResult.path,
    });
  } catch (error) {
    console.error('[v0] JSON export error:', error);
    throw error;
  }
}
