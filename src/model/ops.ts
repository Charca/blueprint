import { PRESETS } from '../lib/color';
import { uid } from '../lib/ids';
import type { Point } from '../lib/projection';
import type { AssetEl, ConnectorEl, FloorEl, Label, Element, TagEl, TextEl } from './types';

export type FloorChildEl = AssetEl | TagEl | TextEl;
export interface FloorBounds { gridX: number; gridY: number; width: number; depth: number }

const FLOOR_PADDING = 1;
const FLOOR_JOIN_GAP = 1;

function isFloorChild(el: Element): el is FloorChildEl {
  return el.kind === 'asset' || el.kind === 'tag' || el.kind === 'text';
}

function isPositionedElement(el: Element): el is Exclude<Element, ConnectorEl> {
  return el.kind !== 'connector';
}

export function floorChildren(els: Element[], floorId: string): FloorChildEl[] {
  return els.filter((el): el is FloorChildEl => isFloorChild(el) && el.parentId === floorId);
}

export function floorBounds(els: Element[], floor: FloorEl): FloorBounds {
  if (floor.sizeMode === 'manual') {
    return { gridX: floor.gridX, gridY: floor.gridY, width: floor.width, depth: floor.depth };
  }
  const children = floorChildren(els, floor.id);
  if (children.length === 0) {
    return { gridX: floor.gridX, gridY: floor.gridY, width: floor.width, depth: floor.depth };
  }
  const xs = children.map((el) => el.gridX);
  const ys = children.map((el) => el.gridY);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    gridX: minX - FLOOR_PADDING,
    gridY: minY - FLOOR_PADDING,
    width: maxX - minX + 1 + FLOOR_PADDING * 2,
    depth: maxY - minY + 1 + FLOOR_PADDING * 2,
  };
}

function containsCell(bounds: FloorBounds, cell: Point): boolean {
  return cell.x >= bounds.gridX && cell.x < bounds.gridX + bounds.width &&
    cell.y >= bounds.gridY && cell.y < bounds.gridY + bounds.depth;
}

function floorBoundsForMembership(els: Element[], floor: FloorEl, childId: string): FloorBounds {
  if (floor.sizeMode === 'manual') {
    return { gridX: floor.gridX, gridY: floor.gridY, width: floor.width, depth: floor.depth };
  }
  const siblings = floorChildren(els, floor.id).filter((child) => child.id !== childId);
  if (siblings.length === 0) {
    return { gridX: floor.gridX, gridY: floor.gridY, width: floor.width, depth: floor.depth };
  }
  const xs = siblings.map((el) => el.gridX);
  const ys = siblings.map((el) => el.gridY);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const joinPadding = FLOOR_PADDING + FLOOR_JOIN_GAP;
  return {
    gridX: minX - joinPadding,
    gridY: minY - joinPadding,
    width: maxX - minX + 1 + joinPadding * 2,
    depth: maxY - minY + 1 + joinPadding * 2,
  };
}

function nearestContainingFloor(els: Element[], child: FloorChildEl): string | undefined {
  const current = child.parentId;
  const floors = els
    .filter((el): el is FloorEl => el.kind === 'floor')
    .filter((floor) => containsCell(floorBoundsForMembership(els, floor, child.id), { x: child.gridX, y: child.gridY }))
    .sort((a, b) => {
      if (a.id === current) return -1;
      if (b.id === current) return 1;
      const ab = floorBounds(els, a);
      const bb = floorBounds(els, b);
      return ab.width * ab.depth - bb.width * bb.depth;
    });
  return floors[0]?.id;
}

export function addElement(els: Element[], el: Element): Element[] {
  return [...els, el];
}

export function addElementWithFloorMembership(els: Element[], el: Element): Element[] {
  const next = [...els, el];
  if (!isFloorChild(el)) return next;
  const parentId = nearestContainingFloor(next, el);
  if (!parentId) return next;
  return next.map((candidate) => candidate.id === el.id ? ({ ...candidate, parentId } as Element) : candidate);
}

export function moveElements(els: Element[], ids: string[], dx: number, dy: number): Element[] {
  const set = new Set(ids);
  for (const id of ids) {
    const floor = els.find((el) => el.kind === 'floor' && el.id === id);
    if (floor?.kind === 'floor') {
      for (const child of floorChildren(els, floor.id)) set.add(child.id);
    }
  }
  const moved = els.map((el) => {
    if (!set.has(el.id) || el.kind === 'connector') return el;
    return { ...el, gridX: el.gridX + dx, gridY: el.gridY + dy };
  });
  return assignFloorMembership(moved, [...set]);
}

export function assignFloorMembership(els: Element[], ids?: string[]): Element[] {
  const set = ids ? new Set(ids) : null;
  let changed = false;
  const next = els.map((el) => {
    if (!isFloorChild(el) || (set && !set.has(el.id))) return el;
    const parentId = nearestContainingFloor(els, el);
    if (parentId === el.parentId) return el;
    changed = true;
    if (!parentId) {
      const { parentId: _parentId, ...rest } = el;
      return rest;
    }
    return { ...el, parentId };
  });
  return changed ? next : els;
}

export function deleteElements(els: Element[], ids: string[]): Element[] {
  const dead = new Set(ids);
  let grew = true;
  while (grew) {
    grew = false;
    for (const el of els) {
      if (dead.has(el.id)) continue;
      const cascades =
        (el.kind === 'connector' && (dead.has(el.fromId) || dead.has(el.toId))) ||
        (el.kind === 'tag' && el.attachedTo !== undefined && dead.has(el.attachedTo)) ||
        (isFloorChild(el) && el.parentId !== undefined && dead.has(el.parentId));
      if (cascades) {
        dead.add(el.id);
        grew = true;
      }
    }
  }
  return els.filter((el) => !dead.has(el.id));
}

export function duplicateElements(
  els: Element[], ids: string[], offset: Point = { x: 1, y: 1 },
): { elements: Element[]; newIds: string[] } {
  const idSet = new Set(ids);
  for (const el of els) {
    if (el.kind === 'connector' && idSet.has(el.fromId) && idSet.has(el.toId)) {
      idSet.add(el.id);
    }
  }
  const map = new Map<string, string>();
  for (const el of els) if (idSet.has(el.id)) map.set(el.id, uid());
  const clones: Element[] = [];
  for (const el of els) {
    if (!idSet.has(el.id)) continue;
    if (el.kind === 'connector') {
      if (!map.has(el.fromId) || !map.has(el.toId)) continue;
      clones.push({ ...el, id: map.get(el.id)!, fromId: map.get(el.fromId)!, toId: map.get(el.toId)! });
    } else {
      const clone = { ...el, id: map.get(el.id)!, gridX: el.gridX + offset.x, gridY: el.gridY + offset.y };
      if (clone.kind === 'tag' && clone.attachedTo) clone.attachedTo = map.get(clone.attachedTo);
      if (isFloorChild(clone) && clone.parentId) clone.parentId = map.get(clone.parentId) ?? clone.parentId;
      clones.push(clone);
    }
  }
  return { elements: [...els, ...clones], newIds: clones.map((c) => c.id) };
}

function duplicateBounds(els: Element[], ids: string[]): FloorBounds | null {
  const idSet = new Set(ids);
  const movable = els.filter((el): el is Exclude<Element, ConnectorEl> => idSet.has(el.id) && isPositionedElement(el));
  if (movable.length === 0) return null;
  const bounds = movable.map((el): FloorBounds => {
    if (el.kind === 'floor') return floorBounds(els, el);
    return { gridX: el.gridX, gridY: el.gridY, width: 1, depth: 1 };
  });
  const minX = Math.min(...bounds.map((bound) => bound.gridX));
  const maxX = Math.max(...bounds.map((bound) => bound.gridX + bound.width - 1));
  const minY = Math.min(...bounds.map((bound) => bound.gridY));
  const maxY = Math.max(...bounds.map((bound) => bound.gridY + bound.depth - 1));
  return { gridX: minX, gridY: minY, width: maxX - minX + 1, depth: maxY - minY + 1 };
}

export function duplicateElementsToRight(
  els: Element[], ids: string[],
): { elements: Element[]; newIds: string[] } {
  const bounds = duplicateBounds(els, ids);
  return duplicateElements(els, ids, { x: bounds ? bounds.width + 1 : 1, y: 0 });
}

export function anchorOf(el: Element): Point | null {
  switch (el.kind) {
    case 'connector': return null;
    case 'floor': return { x: el.gridX + (el.width - 1) / 2, y: el.gridY + (el.depth - 1) / 2 };
    default: return { x: el.gridX, y: el.gridY };
  }
}

export function anchorOfElement(el: Element, elements: Element[]): Point | null {
  if (el.kind !== 'floor') return anchorOf(el);
  const bounds = floorBounds(elements, el);
  return { x: bounds.gridX + (bounds.width - 1) / 2, y: bounds.gridY + (bounds.depth - 1) / 2 };
}

export function updateElement(els: Element[], id: string, patch: Partial<Element>): Element[] {
  return els.map((el) => (el.id === id ? ({ ...el, ...patch } as Element) : el));
}

export function createFromPlacing(placing: string, cell: Point): Element {
  const base = { id: uid(), gridX: cell.x, gridY: cell.y };
  if (placing.startsWith('asset:')) {
    return { kind: 'asset', ...base, assetId: placing.slice(6), color: PRESETS.blue };
  }
  switch (placing) {
    case 'floor':
      return { kind: 'floor', ...base, width: 4, depth: 3, sizeMode: 'auto', corners: 'sharp', color: PRESETS.gray };
    case 'tag:bubble':
      return { kind: 'tag', ...base, text: 'Label', color: '#3479FF', style: 'bubble' };
    case 'tag:tips':
      return { kind: 'tag', ...base, text: 'Tip', color: '#FFFFFF', style: 'tips' };
    case 'text:callout':
      return { kind: 'text', ...base, title: 'Title', content: 'This is a short piece of text.', variant: 'callout' };
    default:
      return { kind: 'text', ...base, content: 'Text', variant: 'plain' };
  }
}

export const DEFAULT_LABEL_COLOR = '#2A3242';

export function makeLabel(text: string): Label {
  return { text, style: 'text', color: DEFAULT_LABEL_COLOR, orientation: 'left' };
}

/** Create (with defaults), retext, or remove (empty text) an asset's or floor's
 * label. Returns `els` unchanged (same reference) when nothing would change. */
export function setLabel(els: Element[], id: string, text: string): Element[] {
  const target = els.find((el) => el.id === id);
  if (!target || (target.kind !== 'asset' && target.kind !== 'floor')) return els;
  const trimmed = text.trim();
  if (trimmed === (target.label?.text ?? '')) return els;
  return els.map((el) => {
    if (el.id !== id || (el.kind !== 'asset' && el.kind !== 'floor')) return el;
    if (!trimmed) {
      const { label: _label, ...rest } = el;
      return rest;
    }
    return { ...el, label: el.label ? { ...el.label, text: trimmed } : makeLabel(trimmed) };
  });
}
