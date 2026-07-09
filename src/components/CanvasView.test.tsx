import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { createDoc } from '../storage/local';
import { useDocStore } from '../store/docStore';
import { CanvasView } from './CanvasView';
import type { AssetEl, Doc, Element } from '../model/types';

const asset = (id: string, x = 0, y = 0): AssetEl =>
  ({ kind: 'asset', id, gridX: x, gridY: y, assetId: 'cube-plain', color: '#618AFF' });

function docWithElements(elements: Element[]): Doc {
  return {
    id: 'doc',
    name: 'Test',
    schemaVersion: 1,
    view: { rotation: 0, mode: 'top' },
    camera: { x: 0, y: 0, zoom: 1 },
    elements,
  };
}

describe('CanvasView', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    useDocStore.setState({ doc: null, selection: [], placing: null, tool: 'select', connectFrom: null, past: [], future: [], snapshot: null });
    Element.prototype.setPointerCapture ??= () => undefined;
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

  it('switches tools with M, H, and A shortcuts outside text inputs', () => {
    const doc = createDoc('Shortcuts');
    useDocStore.getState().openDoc(doc.id);
    const { container } = render(<><input data-testid="field" /><CanvasView /></>);

    fireEvent.keyDown(window, { key: 'h' });
    expect(useDocStore.getState().tool).toBe('pan');
    fireEvent.keyDown(window, { key: 'a' });
    expect(useDocStore.getState().tool).toBe('connect');
    fireEvent.keyDown(window, { key: 'm' });
    expect(useDocStore.getState().tool).toBe('select');

    const input = container.querySelector('input')!;
    fireEvent.keyDown(input, { key: 'a' });
    expect(useDocStore.getState().tool).toBe('select');
  });

  it('selects elements with a marquee drag from empty canvas space', () => {
    useDocStore.setState({
      doc: docWithElements([asset('a', 1, 1), asset('b', 5, 5)]),
      selection: [],
      tool: 'select',
    });
    const { container } = render(<CanvasView />);
    const svg = container.querySelector('svg')!;

    fireEvent.pointerDown(svg, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 120, clientY: 120, pointerId: 1 });
    expect(container.querySelector('rect[fill="#7C5CFF"]')).toBeTruthy();
    fireEvent.pointerUp(svg, { pointerId: 1 });

    expect(useDocStore.getState().selection).toEqual(['a']);
  });

  it('copies, deletes, and pastes the current selection immediately to the right', () => {
    useDocStore.setState({
      doc: docWithElements([asset('a', 1, 1)]),
      selection: ['a'],
      tool: 'select',
    });
    render(<CanvasView />);

    fireEvent.keyDown(window, { key: 'c', metaKey: true });
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(useDocStore.getState().doc?.elements).toHaveLength(0);
    fireEvent.keyDown(window, { key: 'v', metaKey: true });

    const state = useDocStore.getState();
    expect(state.doc?.elements).toHaveLength(1);
    const clone = state.doc?.elements[0] as AssetEl;
    expect(clone).toMatchObject({ kind: 'asset', gridX: 2, gridY: 1 });
    expect(state.selection).toEqual([clone.id]);
  });

  it('duplicates the current selection immediately to the right', () => {
    useDocStore.setState({
      doc: docWithElements([asset('a', 1, 1), asset('b', 3, 1)]),
      selection: ['a', 'b'],
      tool: 'select',
    });
    render(<CanvasView />);

    fireEvent.keyDown(window, { key: 'd', metaKey: true });

    const state = useDocStore.getState();
    expect(state.doc?.elements).toHaveLength(4);
    const clones = state.doc!.elements.filter((el) => el.id !== 'a' && el.id !== 'b') as AssetEl[];
    expect(clones).toEqual(expect.arrayContaining([
      expect.objectContaining({ gridX: 4, gridY: 1 }),
      expect.objectContaining({ gridX: 6, gridY: 1 }),
    ]));
    expect(state.selection).toEqual(clones.map((el) => el.id));
  });
});
