import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { HandwritingDocument } from '@/lib/handwriting-document';
import { uploadDocumentFile } from '@/lib/supabase/worksheet-files';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildWorksheetRecord(document: HandwritingDocument, userId: string, filePath: string) {
  const now = new Date().toISOString();

  return {
    user_id: userId,
    title: document.title || 'Untitled worksheet',
    description: 'Handwriting worksheet',
    template: document.paperType || 'ruled',
    file_path: filePath,
    storage_bucket: 'worksheets',
    metadata: { documentVersion: document.version },
    grade_level: 'year1',
    subject: null,
    created_at: now,
    updated_at: now,
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('worksheets')
      .select('id, title, file_path, created_at, updated_at, metadata')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(data || []);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load worksheets' },
      { status: 500 },
    );
  }
}

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
    const document = (body?.document ?? body?.worksheet) as HandwritingDocument | undefined;

    if (!document) {
      return NextResponse.json({ error: 'Document payload is required' }, { status: 400 });
    }

    const filePath = await uploadDocumentFile(
      supabase,
      document,
      body?.fileName || 'worksheet.json',
      user.id,
    );

    const record = buildWorksheetRecord(document, user.id, filePath);

    const { data, error } = await supabase
      .from('worksheets')
      .insert(record)
      .select('id, title, file_path, created_at, updated_at, metadata')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      worksheet: data,
      id: data.id,
      document,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create worksheet' },
      { status: 500 },
    );
  }
}
