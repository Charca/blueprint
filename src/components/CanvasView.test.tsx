import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { createDoc } from '../storage/local';
import { useDocStore } from '../store/docStore';
import { CanvasView } from './CanvasView';
import type { AssetEl, ConnectorEl, Doc, Element } from '../model/types';

const asset = (id: string, x = 0, y = 0): AssetEl =>
  ({ kind: 'asset', id, gridX: x, gridY: y, assetId: 'cube-plain', color: '#618AFF' });
const conn = (id: string, fromId: string, toId: string): ConnectorEl =>
  ({ kind: 'connector', id, fromId, toId, style: 'solid', color: '#425066' });

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
    SVGElement.prototype.setPointerCapture ??= vi.fn();
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

  it('selects newly placed nodes', () => {
    const doc = createDoc('Place selection');
    useDocStore.getState().openDoc(doc.id);
    useDocStore.getState().setPlacing('floor');
    const { container } = render(<CanvasView />);
    const svg = container.querySelector('svg')!;

    fireEvent.pointerDown(svg, { clientX: 0, clientY: 0, pointerId: 1 });

    const elements = useDocStore.getState().doc!.elements;
    expect(elements).toHaveLength(1);
    expect(elements[0].kind).toBe('floor');
    expect(useDocStore.getState().selection).toEqual([elements[0].id]);
  });

  it('selects newly created connectors', () => {
    useDocStore.setState({
      doc: docWithElements([asset('a', 0, 0), asset('b', 4, 0)]),
      selection: [],
      tool: 'connect',
    });
    const { container } = render(<CanvasView />);
    const svg = container.querySelector('svg')!;
    const assetGroups = Array.from(container.querySelectorAll('g[style*="cursor: move"]'));

    fireEvent.pointerDown(assetGroups[0], { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 200, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1 });

    const connector = useDocStore.getState().doc!.elements.find((el): el is ConnectorEl => el.kind === 'connector');
    expect(connector).toBeTruthy();
    expect(connector?.route).toBe('elbow');
    expect(useDocStore.getState().selection).toEqual([connector!.id]);
  });

  it('highlights a floor drop target while placing a node over it', () => {
    const doc = createDoc('Floor highlight');
    useDocStore.getState().openDoc(doc.id);
    useDocStore.setState((s) => ({
      doc: s.doc ? {
        ...s.doc,
        view: { rotation: 0, mode: 'top' },
        elements: [{
          kind: 'floor', id: 'floor-1', gridX: 0, gridY: 0, width: 4, depth: 3,
          sizeMode: 'manual', corners: 'sharp', color: '#9aa4b2',
        } satisfies Element],
      } : s.doc,
    }));
    useDocStore.getState().setPlacing('text:plain');
    const { container } = render(<CanvasView />);
    const svg = container.querySelector('svg')!;

    fireEvent.pointerMove(svg, { clientX: 25, clientY: 25, pointerId: 1 });

    expect(container.querySelector('rect[fill="#1fd9c6"][opacity="0.5"]')).not.toBeNull();
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

  it('copies, deletes, and pastes the current selection to the right with a gap', () => {
    useDocStore.setState({
      doc: docWithElements([asset('a', 1, 1), asset('b', 3, 1), conn('c', 'a', 'b')]),
      selection: ['a', 'b'],
      tool: 'select',
    });
    render(<CanvasView />);

    fireEvent.keyDown(window, { key: 'c', metaKey: true });
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(useDocStore.getState().doc?.elements).toHaveLength(0);
    fireEvent.keyDown(window, { key: 'v', metaKey: true });

    const state = useDocStore.getState();
    expect(state.doc?.elements).toHaveLength(3);
    const cloneAssets = state.doc!.elements.filter((el): el is AssetEl => el.kind === 'asset');
    const cloneConn = state.doc!.elements.find((el) => el.kind === 'connector') as ConnectorEl;
    expect(cloneAssets).toEqual(expect.arrayContaining([
      expect.objectContaining({ gridX: 5, gridY: 1 }),
      expect.objectContaining({ gridX: 7, gridY: 1 }),
    ]));
    expect(cloneAssets.map((el) => el.id)).toContain(cloneConn.fromId);
    expect(cloneAssets.map((el) => el.id)).toContain(cloneConn.toId);
    expect(state.selection).toEqual(state.doc!.elements.map((el) => el.id));
  });

  it('duplicates the current selection to the right with a gap', () => {
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
      expect.objectContaining({ gridX: 5, gridY: 1 }),
      expect.objectContaining({ gridX: 7, gridY: 1 }),
    ]));
    expect(state.selection).toEqual(clones.map((el) => el.id));
  });

  it('customizes selected elbow connectors by dragging the handle', () => {
    useDocStore.setState({
      doc: docWithElements([asset('a', 0, 0), asset('b', 4, 2), conn('c', 'a', 'b')]),
      selection: ['c'],
      tool: 'select',
    });
    const { container } = render(<CanvasView />);
    const svg = container.querySelector('svg')!;
    const handle = container.querySelector('circle[fill="#ffffff"][stroke="#7C5CFF"]')!;

    fireEvent.pointerDown(handle, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 150, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1 });

    const connector = useDocStore.getState().doc!.elements.find((el): el is ConnectorEl => el.kind === 'connector')!;
    expect(connector.elbowOffset).toBe(50);
    expect(useDocStore.getState().selection).toEqual(['c']);
  });
});
