import { createClient } from '@/lib/supabase/client';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { FontMetadata, Worksheet, ImageAsset } from '@/lib/types';

// Worksheet storage functions
export async function uploadWorksheet(
  worksheetData: ArrayBuffer | Blob,
  fileName: string,
  userId: string
): Promise<{ path: string; url: string } | null> {
  try {
    const supabase = createClient();
    const fileExtension = fileName.split('.').pop() || 'json';
    const filePath = `${userId}/${Date.now()}.${fileExtension}`;

    const { error, data } = await supabase.storage
      .from('worksheets')
      .upload(filePath, worksheetData, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('[v0] Worksheet upload error:', error);
      return null;
    }

    const { data: publicData } = supabase.storage
      .from('worksheets')
      .getPublicUrl(filePath);

    return {
      path: filePath,
      url: publicData.publicUrl,
    };
  } catch (error) {
    console.error('[v0] Worksheet upload exception:', error);
    return null;
  }
}

export async function deleteWorksheet(filePath: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase.storage
      .from('worksheets')
      .remove([filePath]);

    if (error) {
      console.error('[v0] Worksheet delete error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[v0] Worksheet delete exception:', error);
    return false;
  }
}

export async function downloadWorksheet(filePath: string): Promise<Blob | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from('worksheets')
      .download(filePath);

    if (error) {
      console.error('[v0] Worksheet download error:', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error('[v0] Worksheet download exception:', error);
    return null;
  }
}

// Font storage functions
export async function uploadFont(
  fontData: ArrayBuffer | Blob,
  fileName: string,
  userId: string
): Promise<{ path: string; size: number } | null> {
  try {
    const supabase = createClient();
    const fileExtension = fileName.split('.').pop() || 'ttf';
    const filePath = `${userId}/${fileName}`;

    const fileSize = fontData instanceof Blob ? fontData.size : fontData.byteLength;

    const { error } = await supabase.storage
      .from('fonts')
      .upload(filePath, fontData, {
        cacheControl: '86400',
        upsert: true,
      });

    if (error) {
      console.error('[v0] Font upload error:', error);
      return null;
    }

    return {
      path: filePath,
      size: fileSize,
    };
  } catch (error) {
    console.error('[v0] Font upload exception:', error);
    return null;
  }
}

export async function downloadFont(filePath: string): Promise<ArrayBuffer | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from('fonts')
      .download(filePath);

    if (error) {
      console.error('[v0] Font download error:', error);
      return null;
    }

    return await data.arrayBuffer();
  } catch (error) {
    console.error('[v0] Font download exception:', error);
    return null;
  }
}

export async function deleteFont(filePath: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase.storage
      .from('fonts')
      .remove([filePath]);

    if (error) {
      console.error('[v0] Font delete error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[v0] Font delete exception:', error);
    return false;
  }
}

export function getFontDownloadUrl(filePath: string): string {
  const supabase = createClient();
  const { data } = supabase.storage
    .from('fonts')
    .getPublicUrl(filePath);
  return data.publicUrl;
}

// Image storage functions
export async function uploadImage(
  imageData: Blob,
  fileName: string,
  userId: string
): Promise<{ path: string; url: string } | null> {
  try {
    const supabase = createClient();
    const timestamp = Date.now();
    const filePath = `${userId}/${timestamp}-${fileName}`;

    const { error } = await supabase.storage
      .from('worksheet-images')
      .upload(filePath, imageData, {
        cacheControl: '86400',
        upsert: false,
      });

    if (error) {
      console.error('[v0] Image upload error:', error);
      return null;
    }

    const { data: publicData } = supabase.storage
      .from('worksheet-images')
      .getPublicUrl(filePath);

    return {
      path: filePath,
      url: publicData.publicUrl,
    };
  } catch (error) {
    console.error('[v0] Image upload exception:', error);
    return null;
  }
}

export async function deleteImage(filePath: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase.storage
      .from('worksheet-images')
      .remove([filePath]);

    if (error) {
      console.error('[v0] Image delete error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[v0] Image delete exception:', error);
    return false;
  }
}

export function getImageUrl(filePath: string): string {
  const supabase = createClient();
  const { data } = supabase.storage
    .from('worksheet-images')
    .getPublicUrl(filePath);
  return data.publicUrl;
}

// Database functions
export async function saveWorksheetMetadata(
  worksheet: Omit<Worksheet, 'id' | 'createdAt' | 'updatedAt'> & {
    file_path?: string;
  },
  userId: string
): Promise<string | null> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('worksheets')
      .insert({
        user_id: userId,
        title: worksheet.title,
        description: worksheet.pages[0]?.layout.template || 'blank',
        template: worksheet.pages[0]?.layout.template || 'blank',
        file_path: worksheet.file_path,
        metadata: worksheet.metadata,
        grade_level: worksheet.metadata?.gradeLevel,
        subject: worksheet.metadata?.subject,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[v0] Worksheet metadata save error:', error);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('[v0] Worksheet metadata save exception:', error);
    return null;
  }
}

export async function getWorksheets(userId: string): Promise<any[]> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('worksheets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[v0] Get worksheets error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[v0] Get worksheets exception:', error);
    return [];
  }
}

export async function saveFontMetadata(
  font: Pick<FontMetadata, 'name' | 'family' | 'style' | 'source' | 'fileSize'> & {
    filePath: string;
  },
  userId: string
): Promise<string | null> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('user_fonts')
      .insert({
        user_id: userId,
        name: font.name,
        family: font.family,
        style: font.style,
        file_path: font.filePath,
        file_size: font.fileSize,
        source: font.source,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[v0] Font metadata save error:', error);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('[v0] Font metadata save exception:', error);
    return null;
  }
}

export async function getUserFonts(userId: string): Promise<any[]> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('user_fonts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[v0] Get fonts error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[v0] Get fonts exception:', error);
    return [];
  }
}

export async function deleteFont_DB(fontId: string): Promise<boolean> {
  try {
    const supabase = createClient();

    const { error } = await supabase.from('user_fonts').delete().eq('id', fontId);

    if (error) {
      console.error('[v0] Delete font DB error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[v0] Delete font DB exception:', error);
    return false;
  }
}

export async function saveImageMetadata(
  worksheetId: string,
  userId: string,
  image: ImageAsset,
  imagePath: string
): Promise<string | null> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('worksheet_images')
      .insert({
        worksheet_id: worksheetId,
        user_id: userId,
        image_path: imagePath,
        position_x: image.x,
        position_y: image.y,
        width: image.width,
        height: image.height,
        rotation: image.rotation,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[v0] Image metadata save error:', error);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('[v0] Image metadata save exception:', error);
    return null;
  }
}

export async function getWorksheetImages(worksheetId: string): Promise<any[]> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('worksheet_images')
      .select('*')
      .eq('worksheet_id', worksheetId);

    if (error) {
      console.error('[v0] Get worksheet images error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[v0] Get worksheet images exception:', error);
    return [];
  }
}
