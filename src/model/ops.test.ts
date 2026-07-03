import { describe, expect, it } from 'vitest';
import type { AssetEl, ConnectorEl, Element, TagEl } from './types';
import {
  addElement, anchorOf, createFromPlacing, deleteElements, duplicateElements,
  moveElements, updateElement, setAssetLabel,
} from './ops';

const asset = (id: string, x = 0, y = 0): AssetEl =>
  ({ kind: 'asset', id, gridX: x, gridY: y, assetId: 'cube-plain', color: '#618AFF' });
const conn = (id: string, fromId: string, toId: string): ConnectorEl =>
  ({ kind: 'connector', id, fromId, toId, style: 'solid', color: '#425066' });

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

  it('deleteElements cascades to connectors and attached tags', () => {
    const tag: TagEl = { kind: 'tag', id: 't', attachedTo: 'a', gridX: 0, gridY: 0, text: 'x', color: '#fff', style: 'bubble' };
    const els: Element[] = [asset('a'), asset('b'), conn('c', 'a', 'b'), tag];
    const next = deleteElements(els, ['a']);
    expect(next.map((e) => e.id)).toEqual(['b']);
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

  it('setAssetLabel creates with defaults, updates text, and removes on empty', () => {
    let els: Element[] = [asset('a')];
    els = setAssetLabel(els, 'a', 'API');
    expect((els[0] as AssetEl).label).toEqual({
      text: 'API', style: 'text', color: '#2A3242', orientation: 'right',
    });
    els = updateElement(els, 'a', {
      label: { ...(els[0] as AssetEl).label!, style: 'tag' as const },
    });
    els = setAssetLabel(els, 'a', '  API v2  ');
    expect((els[0] as AssetEl).label).toMatchObject({ text: 'API v2', style: 'tag' });
    els = setAssetLabel(els, 'a', '   ');
    expect((els[0] as AssetEl).label).toBeUndefined();
  });

  it('setAssetLabel ignores non-asset elements', () => {
    const els: Element[] = [conn('c', 'a', 'b')];
    expect(setAssetLabel(els, 'c', 'X')).toEqual(els);
  });

  it('duplicateElements carries labels', () => {
    const labeled = setAssetLabel([asset('a')], 'a', 'DB');
    const { elements } = duplicateElements(labeled, ['a']);
    expect((elements[1] as AssetEl).label?.text).toBe('DB');
  });

  it('setAssetLabel returns the same array when nothing changes', () => {
    const els = setAssetLabel([asset('a')], 'a', 'DB');
    expect(setAssetLabel(els, 'a', 'DB')).toBe(els);
    expect(setAssetLabel(els, 'a', '  DB ')).toBe(els);
    const unlabeled: Element[] = [asset('b')];
    expect(setAssetLabel(unlabeled, 'b', '   ')).toBe(unlabeled);
  });
});
