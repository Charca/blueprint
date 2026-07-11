import { uid } from '../lib/ids';
import type { Doc, Element, Label } from '../model/types';

export interface BlueprintFile {
  format: 'blueprint';
  formatVersion: 1;
  document: Omit<Doc, 'id'>;
}

export class BlueprintImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlueprintImportError';
  }
}

export function serializeBlueprint(doc: Doc): string {
  const { id: _id, ...document } = doc;
  return JSON.stringify({ format: 'blueprint', formatVersion: 1, document } satisfies BlueprintFile, null, 2);
}

export function parseBlueprint(serialized: string): Doc {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new BlueprintImportError('This file is not valid JSON.');
  }
  const file = parseFile(value);
  return { id: uid(), ...file.document };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new BlueprintImportError(message);
}

function string(value: unknown, field: string): string {
  return typeof value === 'string' ? value : fail(`Invalid ${field}.`);
}

function number(value: unknown, field: string): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fail(`Invalid ${field}.`);
}

function oneOf<T extends string | number>(value: unknown, values: readonly T[], field: string): T {
  return values.includes(value as T) ? value as T : fail(`Invalid ${field}.`);
}

function optionalString(value: unknown, field: string): string | undefined {
  return value === undefined ? undefined : string(value, field);
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  return value === undefined ? undefined : typeof value === 'boolean' ? value : fail(`Invalid ${field}.`);
}

function parseFile(value: unknown): BlueprintFile {
  if (!isRecord(value)) fail('Invalid Blueprint file.');
  if (value.format !== 'blueprint') fail('Unsupported Blueprint file format.');
  if (value.formatVersion !== 1) fail('Unsupported Blueprint file version.');
  if (!isRecord(value.document)) fail('Invalid document.');
  return {
    format: 'blueprint',
    formatVersion: 1,
    document: parseDocument(value.document),
  };
}

function parseDocument(value: Record<string, unknown>): Omit<Doc, 'id'> {
  if (value.schemaVersion !== 1) fail('Unsupported document version.');
  if (!isRecord(value.view)) fail('Invalid view.');
  if (!isRecord(value.camera)) fail('Invalid camera.');
  if (!Array.isArray(value.elements)) fail('Invalid elements.');

  const zoom = number(value.camera.zoom, 'camera.zoom');
  if (zoom < 0.2 || zoom > 4) fail('Invalid camera.zoom.');

  const elements = value.elements.map(parseElement);
  validateReferences(elements);
  return {
    schemaVersion: 1,
    name: string(value.name, 'name'),
    view: {
      mode: oneOf(value.view.mode, ['iso', 'top'] as const, 'view.mode'),
      rotation: oneOf(value.view.rotation, [0, 1, 2, 3] as const, 'view.rotation'),
    },
    camera: {
      x: number(value.camera.x, 'camera.x'),
      y: number(value.camera.y, 'camera.y'),
      zoom,
    },
    elements,
  };
}

function parseLabel(value: unknown): Label | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) fail('Invalid label.');
  return {
    text: string(value.text, 'label.text'),
    style: oneOf(value.style, ['text', 'tag'] as const, 'label.style'),
    color: string(value.color, 'label.color'),
    orientation: oneOf(value.orientation, ['left', 'right'] as const, 'label.orientation'),
  };
}

function parseElement(value: unknown): Element {
  if (!isRecord(value)) fail('Invalid element.');
  const id = string(value.id, 'element.id');
  // IDs are embedded in SVG instance markup; uid() emits lowercase base-36 values.
  if (!/^[a-z0-9]+$/.test(id)) fail('Invalid element.id.');

  switch (value.kind) {
    case 'asset': {
      const parentId = optionalString(value.parentId, 'asset.parentId');
      const label = parseLabel(value.label);
      return {
        kind: 'asset', id,
        gridX: number(value.gridX, 'asset.gridX'), gridY: number(value.gridY, 'asset.gridY'),
        assetId: string(value.assetId, 'asset.assetId'), color: string(value.color, 'asset.color'),
        ...(parentId === undefined ? {} : { parentId }),
        ...(label === undefined ? {} : { label }),
      };
    }
    case 'floor': {
      const floorType = value.floorType === undefined ? undefined : oneOf(value.floorType, ['raised', 'flat'] as const, 'floor.floorType');
      const floorShadow = optionalBoolean(value.floorShadow, 'floor.floorShadow');
      const sizeMode = value.sizeMode === undefined ? undefined : oneOf(value.sizeMode, ['auto', 'manual'] as const, 'floor.sizeMode');
      const label = parseLabel(value.label);
      return {
        kind: 'floor', id,
        gridX: number(value.gridX, 'floor.gridX'), gridY: number(value.gridY, 'floor.gridY'),
        width: number(value.width, 'floor.width'), depth: number(value.depth, 'floor.depth'),
        corners: oneOf(value.corners, ['sharp', 'rounded', 'pill'] as const, 'floor.corners'),
        color: string(value.color, 'floor.color'),
        ...(floorType === undefined ? {} : { floorType }),
        ...(floorShadow === undefined ? {} : { floorShadow }),
        ...(sizeMode === undefined ? {} : { sizeMode }),
        ...(label === undefined ? {} : { label }),
      };
    }
    case 'connector': {
      const label = optionalString(value.label, 'connector.label');
      return {
        kind: 'connector', id,
        fromId: string(value.fromId, 'connector.fromId'), toId: string(value.toId, 'connector.toId'),
        style: oneOf(value.style, ['solid', 'dashed', 'dotted'] as const, 'connector.style'),
        color: string(value.color, 'connector.color'),
        ...(label === undefined ? {} : { label }),
      };
    }
    case 'tag': {
      const attachedTo = optionalString(value.attachedTo, 'tag.attachedTo');
      const parentId = optionalString(value.parentId, 'tag.parentId');
      const icon = optionalString(value.icon, 'tag.icon');
      return {
        kind: 'tag', id,
        gridX: number(value.gridX, 'tag.gridX'), gridY: number(value.gridY, 'tag.gridY'),
        text: string(value.text, 'tag.text'), color: string(value.color, 'tag.color'),
        style: oneOf(value.style, ['bubble', 'tips'] as const, 'tag.style'),
        ...(attachedTo === undefined ? {} : { attachedTo }),
        ...(parentId === undefined ? {} : { parentId }),
        ...(icon === undefined ? {} : { icon }),
      };
    }
    case 'text': {
      const title = optionalString(value.title, 'text.title');
      const parentId = optionalString(value.parentId, 'text.parentId');
      return {
        kind: 'text', id,
        gridX: number(value.gridX, 'text.gridX'), gridY: number(value.gridY, 'text.gridY'),
        content: string(value.content, 'text.content'),
        variant: oneOf(value.variant, ['plain', 'callout'] as const, 'text.variant'),
        ...(title === undefined ? {} : { title }),
        ...(parentId === undefined ? {} : { parentId }),
      };
    }
    default:
      return fail('Invalid element.kind.');
  }
}

function validateReferences(elements: Element[]): void {
  const ids = new Set<string>();
  const nonConnectorIds = new Set<string>();
  const floorIds = new Set<string>();

  for (const element of elements) {
    if (ids.has(element.id)) fail('Duplicate element ID.');
    ids.add(element.id);
    if (element.kind !== 'connector') nonConnectorIds.add(element.id);
    if (element.kind === 'floor') floorIds.add(element.id);
  }

  for (const element of elements) {
    if (element.kind === 'connector') {
      if (!nonConnectorIds.has(element.fromId) || !nonConnectorIds.has(element.toId)) {
        fail('Invalid connector reference.');
      }
    }
    if ((element.kind === 'asset' || element.kind === 'tag' || element.kind === 'text') && element.parentId !== undefined && !floorIds.has(element.parentId)) {
      fail('Invalid parent reference.');
    }
    if (element.kind === 'tag' && element.attachedTo !== undefined && !ids.has(element.attachedTo)) {
      fail('Invalid tag attachment.');
    }
  }
}
