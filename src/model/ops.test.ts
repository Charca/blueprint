import { describe, expect, it } from 'vitest';
import type { AssetEl, ConnectorEl, Element, FloorEl, TagEl } from './types';
import {
  addElement, addElementWithFloorMembership, anchorOf, createFromPlacing, deleteElements, duplicateElements,
  floorBounds, moveElements, updateElement, setLabel,
} from './ops';

const asset = (id: string, x = 0, y = 0): AssetEl =>
  ({ kind: 'asset', id, gridX: x, gridY: y, assetId: 'cube-plain', color: '#618AFF' });
const conn = (id: string, fromId: string, toId: string): ConnectorEl =>
  ({ kind: 'connector', id, fromId, toId, style: 'solid', color: '#425066' });
const floor = (id: string, x = 0, y = 0): FloorEl =>
  ({ kind: 'floor', id, gridX: x, gridY: y, width: 4, depth: 3, corners: 'sharp', color: '#C9D2E3' });

describe('ops', () => {
  it('addElement appends without mutating', () => {
    const els: Element[] = [];
    const next = addElement(els, asset('a'));
    expect(next).toHaveLength(1);
    expect(els).toHaveLength(0);
  });

  it('moveElements shifts targeted movable elements only', () => {
    const els = [asset('a', 1, 1), asset('b', 5, 5)];
    const next = moveElements(els, ['a'], 2, -1);
    expect(next[0]).toMatchObject({ gridX: 3, gridY: 0 });
    expect(next[1]).toMatchObject({ gridX: 5, gridY: 5 });
  });

  it('assigns placed shapes to a containing floor', () => {
    const els: Element[] = [floor('f', 0, 0)];
    const next = addElementWithFloorMembership(els, asset('a', 1, 1));
    expect((next[1] as AssetEl).parentId).toBe('f');
  });

  it('auto-sizes populated floors with one grid unit of padding', () => {
    const els: Element[] = [
      floor('f', 0, 0),
      { ...asset('a', 2, 3), parentId: 'f' },
      { ...asset('b', 5, 7), parentId: 'f' },
    ];
    expect(floorBounds(els, els[0] as FloorEl)).toEqual({
      gridX: 1, gridY: 2, width: 6, depth: 7,
    });
  });

  it('treats missing floor sizeMode as auto for backwards compatibility', () => {
    const els: Element[] = [
      floor('f', 10, 10),
      { ...asset('a', 2, 3), parentId: 'f' },
    ];
    expect(floorBounds(els, els[0] as FloorEl)).toEqual({
      gridX: 1, gridY: 2, width: 3, depth: 3,
    });
  });

  it('uses explicit bounds for manual floors even with children', () => {
    const els: Element[] = [
      { ...floor('f', 10, 10), width: 2, depth: 2, sizeMode: 'manual' },
      { ...asset('a', 2, 3), parentId: 'f' },
    ];
    expect(floorBounds(els, els[0] as FloorEl)).toEqual({
      gridX: 10, gridY: 10, width: 2, depth: 2,
    });
  });

  it('dragging a floor moves its children', () => {
    const els: Element[] = [floor('f', 0, 0), { ...asset('a', 1, 1), parentId: 'f' }];
    const next = moveElements(els, ['f'], 2, 3);
    expect(next[0]).toMatchObject({ gridX: 2, gridY: 3 });
    expect(next[1]).toMatchObject({ gridX: 3, gridY: 4, parentId: 'f' });
  });

  it('dragging a child out of a floor removes floor membership', () => {
    const els: Element[] = [floor('f', 0, 0), { ...asset('a', 1, 1), parentId: 'f' }];
    const next = moveElements(els, ['a'], 5, 0);
    expect((next[1] as AssetEl).parentId).toBeUndefined();
  });

  it('adds a moved shape to a floor when it lands one empty cell from grouped content', () => {
    const els: Element[] = [
      floor('f', 0, 0),
      { ...asset('a', 1, 1), parentId: 'f' },
      asset('b', 6, 1),
    ];
    const next = moveElements(els, ['b'], -3, 0);
    expect((next[2] as AssetEl).parentId).toBe('f');
    expect(floorBounds(next, next[0] as FloorEl)).toEqual({
      gridX: 0, gridY: 0, width: 5, depth: 3,
    });
  });

  it('uses manual floor bounds for membership containment', () => {
    const els: Element[] = [
      { ...floor('f', 10, 10), width: 2, depth: 2, sizeMode: 'manual' },
      { ...asset('a', 1, 1), parentId: 'f' },
      asset('b', 11, 11),
      asset('c', 2, 2),
    ];
    const next = moveElements(els, ['b', 'c'], 0, 0);
    expect((next[2] as AssetEl).parentId).toBe('f');
    expect((next[3] as AssetEl).parentId).toBeUndefined();
  });

  it('deleteElements cascades to connectors and attached tags', () => {
    const tag: TagEl = { kind: 'tag', id: 't', attachedTo: 'a', gridX: 0, gridY: 0, text: 'x', color: '#fff', style: 'bubble' };
    const els: Element[] = [asset('a'), asset('b'), conn('c', 'a', 'b'), tag];
    const next = deleteElements(els, ['a']);
    expect(next.map((e) => e.id)).toEqual(['b']);
  });

  it('deleteElements cascades from floors to grouped children', () => {
    const els: Element[] = [floor('f'), { ...asset('a'), parentId: 'f' }, asset('b')];
    expect(deleteElements(els, ['f']).map((e) => e.id)).toEqual(['b']);
  });

  it('duplicateElements clones with new ids, +1/+1 offset, remapped connectors', () => {
    const els: Element[] = [asset('a', 0, 0), asset('b', 2, 0), conn('c', 'a', 'b')];
    const { elements, newIds } = duplicateElements(els, ['a', 'b', 'c']);
    expect(elements).toHaveLength(6);
    expect(newIds).toHaveLength(3);
    const clones = elements.slice(3);
    const cloneA = clones.find((e) => e.kind === 'asset' && e.gridX === 1 && e.gridY === 1)!;
    const cloneConn = clones.find((e) => e.kind === 'connector') as ConnectorEl;
    expect(cloneConn.fromId).toBe(cloneA.id);
    expect(cloneConn.fromId).not.toBe('a');
  });

  it('duplicateElements drops connectors whose endpoints are not duplicated', () => {
    const els: Element[] = [asset('a'), asset('b'), conn('c', 'a', 'b')];
    const { elements } = duplicateElements(els, ['a', 'c']);
    expect(elements.filter((e) => e.kind === 'connector')).toHaveLength(1);
  });

  it('anchorOf centers floors and returns null for connectors', () => {
    const floor: Element = { kind: 'floor', id: 'f', gridX: 2, gridY: 4, width: 4, depth: 3, corners: 'sharp', color: '#fff' };
    expect(anchorOf(floor)).toEqual({ x: 3.5, y: 5 });
    expect(anchorOf(conn('c', 'a', 'b'))).toBeNull();
  });

  it('updateElement patches one element by id', () => {
    const next = updateElement([asset('a')], 'a', { color: '#ff0000' });
    expect((next[0] as AssetEl).color).toBe('#ff0000');
  });

  it('createFromPlacing builds each element kind at the cell', () => {
    expect(createFromPlacing('asset:cube-server', { x: 2, y: 3 })).toMatchObject({
      kind: 'asset', assetId: 'cube-server', gridX: 2, gridY: 3,
    });
    expect(createFromPlacing('floor', { x: 0, y: 0 })).toMatchObject({ kind: 'floor', width: 4, depth: 3 });
    expect(createFromPlacing('tag:bubble', { x: 0, y: 0 })).toMatchObject({ kind: 'tag', style: 'bubble' });
    expect(createFromPlacing('tag:tips', { x: 0, y: 0 })).toMatchObject({ kind: 'tag', style: 'tips' });
    expect(createFromPlacing('text:callout', { x: 0, y: 0 })).toMatchObject({ kind: 'text', variant: 'callout' });
    expect(createFromPlacing('text:plain', { x: 0, y: 0 })).toMatchObject({ kind: 'text', variant: 'plain' });
  });

  it('delete cascade is transitive regardless of array order', () => {
    const tag: TagEl = { kind: 'tag', id: 't', attachedTo: 'c', gridX: 0, gridY: 0, text: 'x', color: '#fff', style: 'bubble' };
    const els: Element[] = [tag, asset('a'), asset('b'), conn('c', 'a', 'b')];
    expect(deleteElements(els, ['a']).map((e) => e.id)).toEqual(['b']);
  });

  it('duplicateElements remaps tag attachments within the duplicated set', () => {
    const tag: TagEl = { kind: 'tag', id: 't', attachedTo: 'a', gridX: 0, gridY: 0, text: 'x', color: '#fff', style: 'bubble' };
    const els: Element[] = [asset('a'), tag];
    const { elements } = duplicateElements(els, ['a', 't']);
    const clones = elements.slice(2);
    const cloneTag = clones.find((e) => e.kind === 'tag') as TagEl;
    const cloneAsset = clones.find((e) => e.kind === 'asset')!;
    expect(cloneTag.attachedTo).toBe(cloneAsset.id);
  });

  it('setLabel creates with defaults (orientation left), updates text, and removes on empty', () => {
    let els: Element[] = [asset('a')];
    els = setLabel(els, 'a', 'API');
    expect((els[0] as AssetEl).label).toEqual({
      text: 'API', style: 'text', color: '#2A3242', orientation: 'left',
    });
    els = updateElement(els, 'a', {
      label: { ...(els[0] as AssetEl).label!, style: 'tag' as const },
    });
    els = setLabel(els, 'a', '  API v2  ');
    expect((els[0] as AssetEl).label).toMatchObject({ text: 'API v2', style: 'tag' });
    els = setLabel(els, 'a', '   ');
    expect((els[0] as AssetEl).label).toBeUndefined();
  });

  it('setLabel applies to floor elements', () => {
    let els: Element[] = [floor('f')];
    els = setLabel(els, 'f', 'Zone A');
    expect((els[0] as FloorEl).label).toMatchObject({
      text: 'Zone A', style: 'text', orientation: 'left',
    });
    els = setLabel(els, 'f', '   ');
    expect((els[0] as FloorEl).label).toBeUndefined();
  });

  it('setLabel ignores unsupported kinds', () => {
    const els: Element[] = [conn('c', 'a', 'b')];
    expect(setLabel(els, 'c', 'X')).toBe(els);
  });

  it('duplicateElements carries labels', () => {
    const labeled = setLabel([asset('a')], 'a', 'DB');
    const { elements } = duplicateElements(labeled, ['a']);
    expect((elements[1] as AssetEl).label?.text).toBe('DB');
  });

  it('setLabel returns the same array when nothing changes', () => {
    const els = setLabel([asset('a')], 'a', 'DB');
    expect(setLabel(els, 'a', 'DB')).toBe(els);
    expect(setLabel(els, 'a', '  DB ')).toBe(els);
    const unlabeled: Element[] = [asset('b')];
    expect(setLabel(unlabeled, 'b', '   ')).toBe(unlabeled);
  });
});
