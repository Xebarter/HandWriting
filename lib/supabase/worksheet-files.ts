import type { SupabaseClient } from '@supabase/supabase-js';
import { HandwritingDocument } from '@/lib/handwriting-document';

export async function uploadDocumentFile(
  supabase: SupabaseClient,
  document: HandwritingDocument,
  fileName: string,
  userId: string,
): Promise<string> {
  const safeName = (fileName || 'worksheet.json').replace(/\s+/g, '-').toLowerCase();
  const filePath = `${userId}/${Date.now()}-${safeName}`;
  const payload = new Blob([JSON.stringify(document, null, 2)], {
    type: 'application/json',
  });

  const { error } = await supabase.storage.from('worksheets').upload(filePath, payload, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  return filePath;
}

export async function replaceDocumentFile(
  supabase: SupabaseClient,
  filePath: string,
  document: HandwritingDocument,
): Promise<void> {
  const payload = new Blob([JSON.stringify(document, null, 2)], {
    type: 'application/json',
  });

  const { error } = await supabase.storage.from('worksheets').upload(filePath, payload, {
    cacheControl: '3600',
    upsert: true,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function downloadDocumentFile(
  supabase: SupabaseClient,
  filePath: string,
): Promise<HandwritingDocument | null> {
  const { data, error } = await supabase.storage.from('worksheets').download(filePath);

  if (error || !data) {
    throw new Error(error?.message || 'Failed to download worksheet file');
  }

  const text = await data.text();
  return JSON.parse(text) as HandwritingDocument;
}

export async function removeDocumentFile(
  supabase: SupabaseClient,
  filePath: string,
): Promise<void> {
  const { error } = await supabase.storage.from('worksheets').remove([filePath]);

  if (error) {
    throw new Error(error.message);
  }
}
