import { uid } from '../lib/ids';
import type { Doc } from '../model/types';

export interface DocMeta { id: string; name: string; updatedAt: number; openedAt: number; createdAt: number }

const INDEX_KEY = 'blueprint:index';
const docKey = (id: string) => `blueprint:doc:${id}`;

function normalizeMeta(meta: Partial<DocMeta> & { id: string; name: string }): DocMeta {
  const updatedAt = typeof meta.updatedAt === 'number' ? meta.updatedAt : 0;
  const openedAt = typeof meta.openedAt === 'number' ? meta.openedAt : updatedAt;
  return {
    id: meta.id,
    name: meta.name,
    updatedAt,
    openedAt,
    createdAt: typeof meta.createdAt === 'number' ? meta.createdAt : Math.min(updatedAt || openedAt, openedAt || updatedAt),
  };
}

export function listDocs(): DocMeta[] {
  try {
    return (JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]') as Array<Partial<DocMeta> & { id: string; name: string }>)
      .map(normalizeMeta)
      .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}

function writeIndex(metas: DocMeta[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(metas));
}

let warnedSaveFailure = false;

export function saveDoc(doc: Doc): boolean {
  const key = docKey(doc.id);
  let previous: string | null = null;
  let documentWritten = false;
  try {
    previous = localStorage.getItem(key);
    localStorage.setItem(key, JSON.stringify(doc));
    documentWritten = true;
    const now = Date.now();
    const existing = listDocs().find((m) => m.id === doc.id);
    const rest = listDocs().filter((m) => m.id !== doc.id);
    writeIndex([{ id: doc.id, name: doc.name, updatedAt: now, openedAt: existing?.openedAt ?? now, createdAt: existing?.createdAt ?? now }, ...rest]);
    return true;
  } catch (err) {
    if (documentWritten) {
      try {
        if (previous === null) localStorage.removeItem(key);
        else localStorage.setItem(key, previous);
      } catch {
        // Preserve the non-throwing save contract even if compensation fails.
      }
    }
    console.error('Blueprint: failed to save document', err);
    if (!warnedSaveFailure) {
      warnedSaveFailure = true;
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert('Blueprint could not save your changes (storage full or unavailable).');
      }
    }
    return false;
  }
}

export function createDoc(name = 'Untitled'): Doc {
  const doc: Doc = {
    id: uid(),
    name,
    schemaVersion: 1,
    view: { rotation: 0, mode: 'iso' },
    camera: { x: 0, y: 0, zoom: 1 },
    elements: [],
  };
  saveDoc(doc);
  markDocOpened(doc.id);
  return doc;
}

export function loadDoc(id: string): Doc | null {
  const raw = localStorage.getItem(docKey(id));
  if (!raw) return null;
  try {
    const doc = JSON.parse(raw) as Doc;
    return { ...doc, view: doc.view ?? { rotation: 0, mode: 'iso' } };
  } catch {
    return null;
  }
}

export function markDocOpened(id: string): void {
  const metas = listDocs();
  const meta = metas.find((m) => m.id === id);
  if (!meta) return;
  writeIndex([{ ...meta, openedAt: Date.now() }, ...metas.filter((m) => m.id !== id)]);
}

export function latestOpenedDocId(): string | null {
  return listDocs()
    .filter((meta) => loadDoc(meta.id))
    .sort((a, b) => b.openedAt - a.openedAt || b.updatedAt - a.updatedAt)[0]?.id ?? null;
}

export function deleteDoc(id: string): void {
  localStorage.removeItem(docKey(id));
  writeIndex(listDocs().filter((m) => m.id !== id));
}

export function renameDoc(id: string, name: string): void {
  const doc = loadDoc(id);
  if (doc) saveDoc({ ...doc, name });
}
