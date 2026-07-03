import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDoc, loadDoc } from '../storage/local';
import { addElement } from '../model/ops';
import type { AssetEl } from '../model/types';
import { useDocStore } from './docStore';

const asset = (id: string): AssetEl =>
  ({ kind: 'asset', id, gridX: 0, gridY: 0, assetId: 'cube-plain', color: '#618AFF' });

describe('docStore', () => {
  beforeEach(() => {
    localStorage.clear();
    const doc = createDoc('T');
    useDocStore.getState().openDoc(doc.id);
  });

  it('apply mutates elements and enables undo/redo', () => {
    const s = () => useDocStore.getState();
    s().apply((els) => addElement(els, asset('a')));
    expect(s().doc?.elements).toHaveLength(1);
    s().undo();
    expect(s().doc?.elements).toHaveLength(0);
    s().redo();
    expect(s().doc?.elements).toHaveLength(1);
  });

  it('transient batch collapses to a single undo step', () => {
    const s = () => useDocStore.getState();
    s().apply((els) => addElement(els, asset('a')));
    s().beginTransient();
    s().applyTransient((els) => addElement(els, asset('b')));
    s().applyTransient((els) => addElement(els, asset('c')));
    s().commitTransient();
    expect(s().doc?.elements).toHaveLength(3);
    s().undo();
    expect(s().doc?.elements).toHaveLength(1);
  });

  it('a new apply clears the redo stack', () => {
    const s = () => useDocStore.getState();
    s().apply((els) => addElement(els, asset('a')));
    s().undo();
    s().apply((els) => addElement(els, asset('b')));
    s().redo();
    expect(s().doc?.elements.map((e) => e.id)).toEqual(['b']);
  });

  it('setView and setCamera do not touch history', () => {
    const s = () => useDocStore.getState();
    s().setView({ rotation: 1, mode: 'top' });
    s().setCamera({ x: 10, y: 20, zoom: 2 });
    s().undo();
    expect(s().doc?.view).toEqual({ rotation: 1, mode: 'top' });
    expect(s().doc?.camera).toEqual({ x: 10, y: 20, zoom: 2 });
  });

  it('caps history at 50 entries', () => {
    const s = () => useDocStore.getState();
    for (let i = 0; i < 60; i++) s().apply((els) => addElement(els, asset(`a${i}`)));
    expect(s().past).toHaveLength(50);
    while (s().past.length > 0) s().undo();
    expect(s().doc?.elements).toHaveLength(10);
  });

  it('commitTransient without changes adds no history entry', () => {
    const s = () => useDocStore.getState();
    s().beginTransient();
    s().commitTransient();
    expect(s().past).toHaveLength(0);
  });

  it('undo/redo on empty stacks are safe no-ops', () => {
    const s = () => useDocStore.getState();
    expect(() => {
      s().undo();
      s().redo();
    }).not.toThrow();
    expect(s().doc?.elements).toHaveLength(0);
  });

  it('debounces persistence and flushes the pending save on openDoc', () => {
    vi.useFakeTimers();
    try {
      const s = () => useDocStore.getState();
      const docA = s().doc!;
      s().apply((els) => addElement(els, asset('a')));
      expect(loadDoc(docA.id)?.elements).toHaveLength(0);
      const docB = createDoc('B');
      s().openDoc(docB.id);
      expect(loadDoc(docA.id)?.elements).toHaveLength(1);
      vi.runAllTimers();
    } finally {
      vi.useRealTimers();
    }
  });

  it('flushes the pending save on pagehide', () => {
    vi.useFakeTimers();
    try {
      const s = () => useDocStore.getState();
      const docA = s().doc!;
      s().apply((els) => addElement(els, asset('a')));
      expect(loadDoc(docA.id)?.elements).toHaveLength(0);
      window.dispatchEvent(new Event('pagehide'));
      expect(loadDoc(docA.id)?.elements).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
