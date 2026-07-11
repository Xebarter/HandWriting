import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deserializeDocument, HandwritingDocument } from '@/lib/handwriting-document';
import {
  downloadDocumentFile,
  removeDocumentFile,
  replaceDocumentFile,
} from '@/lib/supabase/worksheet-files';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getWorksheetById(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data, error } = await supabase.from('worksheets').select('*').eq('id', id).single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const worksheet = await getWorksheetById(supabase, id);

    if (worksheet.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let document: HandwritingDocument | null = null;

    if (worksheet.file_path) {
      const raw = await downloadDocumentFile(supabase, worksheet.file_path);
      document = deserializeDocument(raw);
    }

    if (!document) {
      return NextResponse.json({ error: 'Worksheet content not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: worksheet.id,
      title: worksheet.title,
      file_path: worksheet.file_path,
      created_at: worksheet.created_at,
      updated_at: worksheet.updated_at,
      metadata: worksheet.metadata,
      document,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch worksheet' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const worksheet = await getWorksheetById(supabase, id);

    if (worksheet.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const document = (body?.document ?? body?.worksheet) as HandwritingDocument | undefined;
    const title = typeof body?.title === 'string' ? body.title : document?.title ?? worksheet.title;

    if (document && worksheet.file_path) {
      const normalized = { ...document, title };
      await replaceDocumentFile(supabase, worksheet.file_path, normalized);
    }

    const updates = {
      title,
      description: body?.description ?? worksheet.description,
      metadata: body?.metadata ?? worksheet.metadata,
      template: document?.paperType ?? body?.template ?? worksheet.template,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('worksheets')
      .update(updates)
      .eq('id', id)
      .select('id, title, file_path, created_at, updated_at, metadata')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      worksheet: data,
      document: document ? { ...document, title } : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update worksheet' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const worksheet = await getWorksheetById(supabase, id);

    if (worksheet.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (worksheet.file_path) {
      try {
        await removeDocumentFile(supabase, worksheet.file_path);
      } catch {
        // Continue deleting the DB row even if storage cleanup fails.
      }
    }

    const { error } = await supabase.from('worksheets').delete().eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete worksheet' },
      { status: 500 },
    );
  }
}
