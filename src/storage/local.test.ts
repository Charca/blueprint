import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Doc } from '../model/types';
import { createDoc, deleteDoc, latestOpenedDocId, listDocs, loadDoc, markDocOpened, renameDoc, saveDoc } from './local';

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

  it('tracks and returns the latest opened canvas without being affected by saves', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1000);
      const first = createDoc('First');
      vi.setSystemTime(2000);
      const second = createDoc('Second');
      expect(latestOpenedDocId()).toBe(second.id);

      vi.setSystemTime(3000);
      markDocOpened(first.id);
      vi.setSystemTime(4000);
      saveDoc({ ...second, name: 'Second saved later' });

      expect(latestOpenedDocId()).toBe(first.id);
    } finally {
      vi.useRealTimers();
    }
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

  it('rolls back a newly saved document when the index write fails', () => {
    const doc: Doc = {
      id: 'index-write-failure',
      name: 'No orphan',
      schemaVersion: 1,
      view: { rotation: 0, mode: 'iso' },
      camera: { x: 0, y: 0, zoom: 1 },
      elements: [],
    };
    const setItem = localStorage.setItem.bind(localStorage);
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      if (key === 'blueprint:index') throw new Error('index unavailable');
      setItem(key, value);
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    try {
      expect(saveDoc(doc)).toBe(false);
      expect(loadDoc(doc.id)).toBeNull();
      expect(localStorage.getItem(`blueprint:doc:${doc.id}`)).toBeNull();
      expect(listDocs()).not.toContainEqual(expect.objectContaining({ id: doc.id }));
    } finally {
      setItemSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      alertSpy.mockRestore();
    }
  });
});
