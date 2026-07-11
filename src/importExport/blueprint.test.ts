import { describe, expect, it } from 'vitest';
import type { Doc } from '../model/types';
import { BlueprintImportError, parseBlueprint, serializeBlueprint } from './blueprint';

const doc: Doc = {
  id: 'local-id', name: 'Production network', schemaVersion: 1,
  view: { mode: 'top', rotation: 3 },
  camera: { x: 736, y: 412, zoom: 1.25 },
  elements: [
    { kind: 'floor', id: 'floor', gridX: -3, gridY: -2, width: 8, depth: 5, sizeMode: 'manual', corners: 'rounded', color: '#E6EEFA', label: { text: 'Rack area', style: 'tag', color: '#425066', orientation: 'left' } },
    { kind: 'asset', id: 'router', gridX: 0, gridY: 1, assetId: 'cube-plain', color: '#3258C2', parentId: 'floor', label: { text: 'Router', style: 'text', color: '#111111', orientation: 'right' } },
    { kind: 'tag', id: 'tag', attachedTo: 'router', gridX: 1, gridY: 1, text: 'Critical', color: '#ff0000', style: 'bubble', parentId: 'floor', icon: 'alert' },
    { kind: 'text', id: 'text', gridX: 2, gridY: 1, content: 'Observe', title: 'Note', variant: 'callout', parentId: 'floor' },
    { kind: 'connector', id: 'link', fromId: 'router', toId: 'tag', style: 'dashed', color: '#425066', label: 'Uplink' },
  ],
};

describe('portable Blueprint JSON', () => {
  it('serializes the versioned envelope without the local document ID', () => {
    const { id: _id, ...document } = doc;
    expect(JSON.parse(serializeBlueprint(doc))).toEqual({
      format: 'blueprint', formatVersion: 1,
      document,
    });
  });

  it('imports a valid file with a fresh local ID and unchanged canvas data', () => {
    const imported = parseBlueprint(serializeBlueprint(doc));
    expect(imported).toMatchObject({ ...doc, id: expect.any(String) });
    expect(imported.id).not.toBe(doc.id);
    expect(imported.elements).toEqual(doc.elements);
  });

  it.each([
    ['malformed JSON', '{oops'],
    ['unknown format', JSON.stringify({ format: 'other', formatVersion: 1, document: {} })],
    ['unsupported version', JSON.stringify({ format: 'blueprint', formatVersion: 2, document: {} })],
    ['invalid zoom', JSON.stringify({ format: 'blueprint', formatVersion: 1, document: { ...doc, id: undefined, camera: { x: 0, y: 0, zoom: 5 } } })],
    ['duplicate ID', JSON.stringify({ format: 'blueprint', formatVersion: 1, document: { ...doc, id: undefined, elements: [...doc.elements, { ...doc.elements[0], id: 'floor' }] } })],
    ['dangling connector', JSON.stringify({ format: 'blueprint', formatVersion: 1, document: { ...doc, id: undefined, elements: [...doc.elements.slice(0, -1), { ...doc.elements[4], toId: 'missing' }] } })],
    ['invalid parent', JSON.stringify({ format: 'blueprint', formatVersion: 1, document: { ...doc, id: undefined, elements: [{ ...doc.elements[0] }, { ...doc.elements[1], parentId: 'tag' }, ...doc.elements.slice(2)] } })],
  ])('rejects %s', (_name, serialized) => {
    expect(() => parseBlueprint(serialized)).toThrow(BlueprintImportError);
  });
});
