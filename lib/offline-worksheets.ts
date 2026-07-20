import { openDB } from 'idb';
import {
  HandwritingDocument,
  WorksheetRecord,
  deserializeDocument,
} from '@/lib/handwriting-document';

const DB_NAME = 'HandwritingDocuments';
const STORE_NAME = 'worksheets';
const DB_VERSION = 1;

interface StoredWorksheet {
  id: string;
  title: string;
  document: HandwritingDocument;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

function toRecord(entry: StoredWorksheet): WorksheetRecord {
  return {
    id: entry.id,
    title: entry.title,
    file_path: null,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    metadata: entry.metadata,
  };
}

export async function listOfflineWorksheets(): Promise<WorksheetRecord[]> {
  const db = await getDB();
  const entries = (await db.getAll(STORE_NAME)) as StoredWorksheet[];
  return entries
    .map(toRecord)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export async function saveOfflineDocument(
  document: HandwritingDocument,
  fileName?: string
): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const title = document.title?.trim() || fileName?.replace(/\.json$/i, '') || 'Untitled Document';

  const entry: StoredWorksheet = {
    id,
    title,
    document: { ...document, title },
    created_at: now,
    updated_at: now,
    metadata: { documentVersion: document.version, offline: true },
  };

  await db.put(STORE_NAME, entry);
  return id;
}

export async function loadOfflineDocument(
  worksheetId: string
): Promise<{ record: WorksheetRecord; document: HandwritingDocument }> {
  const db = await getDB();
  const entry = (await db.get(STORE_NAME, worksheetId)) as StoredWorksheet | undefined;

  if (!entry) {
    throw new Error('Document not found');
  }

  const document = deserializeDocument(entry.document);
  if (!document) {
    throw new Error('Document file is invalid or unsupported');
  }

  return {
    record: toRecord(entry),
    document,
  };
}

export async function updateOfflineDocument(
  worksheetId: string,
  document: HandwritingDocument,
  title?: string
): Promise<WorksheetRecord> {
  const db = await getDB();
  const entry = (await db.get(STORE_NAME, worksheetId)) as StoredWorksheet | undefined;

  if (!entry) {
    throw new Error('Document not found');
  }

  const nextTitle = (title ?? document.title)?.trim() || entry.title;
  const updated: StoredWorksheet = {
    ...entry,
    title: nextTitle,
    document: { ...document, title: nextTitle },
    updated_at: new Date().toISOString(),
    metadata: { ...entry.metadata, documentVersion: document.version, offline: true },
  };

  await db.put(STORE_NAME, updated);
  return toRecord(updated);
}

export async function deleteOfflineDocument(worksheetId: string): Promise<string> {
  const db = await getDB();
  const entry = await db.get(STORE_NAME, worksheetId);
  if (!entry) {
    throw new Error('Document not found');
  }
  await db.delete(STORE_NAME, worksheetId);
  return worksheetId;
}
