import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { createDoc } from '../storage/local';
import { useDocStore } from '../store/docStore';
import { CanvasView } from './CanvasView';

describe('CanvasView', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    useDocStore.setState({ doc: null, selection: [], placing: null, tool: 'select', connectFrom: null, past: [], future: [], snapshot: null });
  });

  it('centers a new empty canvas in the viewport', () => {
    const rectSpy = vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, width: 1000, height: 800, top: 0, right: 1000, bottom: 800, left: 0,
      toJSON: () => ({}),
    } as DOMRect);
    try {
      const doc = createDoc('Centered');
      useDocStore.getState().openDoc(doc.id);
      render(<CanvasView />);
      expect(useDocStore.getState().doc?.camera).toEqual({ x: 500, y: 400, zoom: 1 });
    } finally {
      rectSpy.mockRestore();
    }
  });
});
