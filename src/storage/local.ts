import { uid } from '../lib/ids';
import type { Doc } from '../model/types';

export interface DocMeta { id: string; name: string; updatedAt: number }

const INDEX_KEY = 'blueprint:index';
const docKey = (id: string) => `blueprint:doc:${id}`;

export function listDocs(): DocMeta[] {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]') as DocMeta[];
  } catch {
    return [];
  }
}

function writeIndex(metas: DocMeta[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(metas));
}

let warnedSaveFailure = false;

export function saveDoc(doc: Doc): void {
  try {
    localStorage.setItem(docKey(doc.id), JSON.stringify(doc));
    const rest = listDocs().filter((m) => m.id !== doc.id);
    writeIndex([{ id: doc.id, name: doc.name, updatedAt: Date.now() }, ...rest]);
  } catch (err) {
    console.error('Blueprint: failed to save document', err);
    if (!warnedSaveFailure) {
      warnedSaveFailure = true;
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert('Blueprint could not save your changes (storage full or unavailable).');
      }
    }
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

export function deleteDoc(id: string): void {
  localStorage.removeItem(docKey(id));
  writeIndex(listDocs().filter((m) => m.id !== id));
}

export function renameDoc(id: string, name: string): void {
  const doc = loadDoc(id);
  if (doc) saveDoc({ ...doc, name });
}
