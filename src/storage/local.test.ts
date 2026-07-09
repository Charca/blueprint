import { beforeEach, describe, expect, it } from 'vitest';
import { createDoc, deleteDoc, listDocs, loadDoc, renameDoc, saveDoc } from './local';
import {
  createPreviewSeedDocs,
  isCloudflarePreviewEnvironment,
  seedPreviewDocsIfNeeded,
} from './previewSeeds';

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

  it('normalizes the saved view back to default iso on load', () => {
    const doc = createDoc('V');
    saveDoc({ ...doc, view: { rotation: 2, mode: 'top' } });
    expect(loadDoc(doc.id)?.view).toEqual({ rotation: 0, mode: 'iso' });
  });

  it('seeds three preview docs when enabled and the workspace is empty', () => {
    expect(seedPreviewDocsIfNeeded({ enabled: true })).toBe(true);
    expect(listDocs().map((doc) => doc.name)).toEqual([
      'PR Preview Architecture',
      'Service Topology',
      'Design System Sampler',
    ]);
    for (const meta of listDocs()) {
      const doc = loadDoc(meta.id);
      expect(doc?.schemaVersion).toBe(1);
      expect(doc?.elements.some((el) => el.kind === 'asset')).toBe(true);
      expect(doc?.elements.some((el) => el.kind === 'connector')).toBe(true);
    }
  });

  it('does not seed when existing docs are present', () => {
    createDoc('Existing');
    expect(seedPreviewDocsIfNeeded({ enabled: true })).toBe(false);
    expect(listDocs().map((doc) => doc.name)).toEqual(['Existing']);
  });

  it('does not seed when the preview gate is disabled', () => {
    expect(seedPreviewDocsIfNeeded({ enabled: false })).toBe(false);
    expect(listDocs()).toEqual([]);
  });

  it('keeps preview seed ids and index entries aligned', () => {
    const docs = createPreviewSeedDocs();
    expect(docs).toHaveLength(3);
    expect(new Set(docs.map((doc) => doc.id)).size).toBe(3);
    for (const doc of docs) {
      const ids = new Set(doc.elements.map((el) => el.id));
      expect(ids.size).toBe(doc.elements.length);
      for (const el of doc.elements) {
        if (el.kind === 'connector') {
          expect(ids.has(el.fromId)).toBe(true);
          expect(ids.has(el.toId)).toBe(true);
        }
      }
    }
  });

  it('detects Cloudflare preview URLs and local override URLs only', () => {
    expect(isCloudflarePreviewEnvironment({
      hostname: '7f38f2-blueprint.charca.workers.dev',
      search: '',
    })).toBe(true);
    expect(isCloudflarePreviewEnvironment({
      hostname: 'blueprint.charca.workers.dev',
      search: '',
    })).toBe(false);
    expect(isCloudflarePreviewEnvironment({
      hostname: 'localhost',
      search: '?bp-preview-seeds=1',
    })).toBe(true);
    expect(isCloudflarePreviewEnvironment({
      hostname: 'localhost',
      search: '',
    })).toBe(false);
  });
});
