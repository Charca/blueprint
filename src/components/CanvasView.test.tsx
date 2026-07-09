import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
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

  it('temporarily shows pan behavior while space is held', () => {
    const doc = createDoc('Space pan');
    useDocStore.getState().openDoc(doc.id);
    useDocStore.getState().setTool('connect');
    const { container } = render(<CanvasView />);
    const svg = container.querySelector('svg')!;

    expect(svg.classList.contains('bp-tool-connect')).toBe(true);
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    expect(svg.classList.contains('bp-tool-pan')).toBe(true);
    expect(useDocStore.getState().tool).toBe('connect');
    fireEvent.keyUp(window, { code: 'Space', key: ' ' });
    expect(svg.classList.contains('bp-tool-connect')).toBe(true);
  });

  it('switches tools with V, H, and A shortcuts outside text inputs', () => {
    const doc = createDoc('Shortcuts');
    useDocStore.getState().openDoc(doc.id);
    const { container } = render(<><input data-testid="field" /><CanvasView /></>);

    fireEvent.keyDown(window, { key: 'h' });
    expect(useDocStore.getState().tool).toBe('pan');
    fireEvent.keyDown(window, { key: 'a' });
    expect(useDocStore.getState().tool).toBe('connect');
    fireEvent.keyDown(window, { key: 'm' });
    expect(useDocStore.getState().tool).toBe('connect');
    fireEvent.keyDown(window, { key: 'v' });
    expect(useDocStore.getState().tool).toBe('select');

    const input = container.querySelector('input')!;
    fireEvent.keyDown(input, { key: 'a' });
    expect(useDocStore.getState().tool).toBe('select');
  });
});
