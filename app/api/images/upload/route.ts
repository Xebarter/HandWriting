import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as storage from '@/lib/supabase/storage';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const worksheetId = formData.get('worksheetId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate image file
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be smaller than 10MB' }, { status: 400 });
    }

    // Upload image
    const uploadResult = await storage.uploadImage(file, file.name, user.id);

    if (!uploadResult) {
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    // Save image metadata if worksheetId provided
    if (worksheetId) {
      await storage.saveImageMetadata(
        worksheetId,
        user.id,
        {
          id: uploadResult.path,
          dataUrl: uploadResult.url,
          x: 0,
          y: 0,
          width: 200,
          height: 200,
          rotation: 0,
          zIndex: 1,
          opacity: 1,
        },
        uploadResult.path
      );
    }

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
      path: uploadResult.path,
    });
  } catch (error) {
    console.error('[v0] Image upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
