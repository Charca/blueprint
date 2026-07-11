import { beforeEach, describe, expect, it } from 'vitest';
import { createDoc, deleteDoc, listDocs, loadDoc, renameDoc, saveDoc } from './local';

describe('storage/local', () => {
  beforeEach(() => localStorage.clear());

  it('createDoc persists a loadable empty doc and indexes it', () => {
    const doc = createDoc('My canvas');
    expect(loadDoc(doc.id)).toEqual(doc);
    expect(listDocs()).toMatchObject([{ id: doc.id, name: 'My canvas' }]);
    expect(doc).toMatchObject({
      schemaVersion: 1,
      view: { rotation: 0, mode: 'iso' },
      camera: { x: 0, y: 0, zoom: 1 },
      elements: [],
    });
  });

  it('saveDoc updates the index entry (name, most-recent-first order)', () => {
    const a = createDoc('A');
    const b = createDoc('B');
    saveDoc({ ...a, name: 'A2' });
    const metas = listDocs();
    expect(metas[0]).toMatchObject({ id: a.id, name: 'A2' });
    expect(metas[1]).toMatchObject({ id: b.id });
  });

  it('deleteDoc removes doc and index entry', () => {
    const doc = createDoc('X');
    deleteDoc(doc.id);
    expect(loadDoc(doc.id)).toBeNull();
    expect(listDocs()).toHaveLength(0);
  });

  it('renameDoc renames doc and index', () => {
    const doc = createDoc('Old');
    renameDoc(doc.id, 'New');
    expect(loadDoc(doc.id)?.name).toBe('New');
    expect(listDocs()[0].name).toBe('New');
  });

  it('loadDoc returns null for unknown ids and corrupt JSON', () => {
    expect(loadDoc('nope')).toBeNull();
    localStorage.setItem('blueprint:doc:bad', '{oops');
    expect(loadDoc('bad')).toBeNull();
  });

  it('preserves a saved non-default view on load', () => {
    const doc = createDoc('V');
    saveDoc({ ...doc, view: { rotation: 2, mode: 'top' } });
    expect(loadDoc(doc.id)?.view).toEqual({ rotation: 2, mode: 'top' });
  });

  it('supplies the default view for legacy stored documents without one', () => {
    const doc = createDoc('Legacy');
    const { view: _view, ...legacyDoc } = doc;
    localStorage.setItem(`blueprint:doc:${doc.id}`, JSON.stringify(legacyDoc));
    expect(loadDoc(doc.id)).toEqual({ ...doc, view: { rotation: 0, mode: 'iso' } });
  });
});
