import { PRESETS } from '../lib/color';
import { uid } from '../lib/ids';
import type { Point } from '../lib/projection';
import type { AssetLabel, Element } from './types';

export function addElement(els: Element[], el: Element): Element[] {
  return [...els, el];
}

export function moveElements(els: Element[], ids: string[], dx: number, dy: number): Element[] {
  const set = new Set(ids);
  return els.map((el) => {
    if (!set.has(el.id) || el.kind === 'connector') return el;
    return { ...el, gridX: el.gridX + dx, gridY: el.gridY + dy };
  });
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
        (el.kind === 'tag' && el.attachedTo !== undefined && dead.has(el.attachedTo));
      if (cascades) {
        dead.add(el.id);
        grew = true;
      }
    }
  }
  return els.filter((el) => !dead.has(el.id));
}

export function duplicateElements(
  els: Element[], ids: string[],
): { elements: Element[]; newIds: string[] } {
  const idSet = new Set(ids);
  const map = new Map<string, string>();
  for (const el of els) if (idSet.has(el.id)) map.set(el.id, uid());
  const clones: Element[] = [];
  for (const el of els) {
    if (!idSet.has(el.id)) continue;
    if (el.kind === 'connector') {
      if (!map.has(el.fromId) || !map.has(el.toId)) continue;
      clones.push({ ...el, id: map.get(el.id)!, fromId: map.get(el.fromId)!, toId: map.get(el.toId)! });
    } else {
      const clone = { ...el, id: map.get(el.id)!, gridX: el.gridX + 1, gridY: el.gridY + 1 };
      if (clone.kind === 'tag' && clone.attachedTo) clone.attachedTo = map.get(clone.attachedTo);
      clones.push(clone);
    }
  }
  return { elements: [...els, ...clones], newIds: clones.map((c) => c.id) };
}

export function anchorOf(el: Element): Point | null {
  switch (el.kind) {
    case 'connector': return null;
    case 'floor': return { x: el.gridX + (el.width - 1) / 2, y: el.gridY + (el.depth - 1) / 2 };
    default: return { x: el.gridX, y: el.gridY };
  }
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
      return { kind: 'floor', ...base, width: 4, depth: 3, corners: 'sharp', color: PRESETS.gray };
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

export function makeLabel(text: string): AssetLabel {
  return { text, style: 'text', color: DEFAULT_LABEL_COLOR, orientation: 'right' };
}

/** Create (with defaults), retext, or remove (empty text) an asset's label. */
export function setAssetLabel(els: Element[], id: string, text: string): Element[] {
  return els.map((el) => {
    if (el.id !== id || el.kind !== 'asset') return el;
    const trimmed = text.trim();
    if (!trimmed) {
      const { label: _label, ...rest } = el;
      return rest;
    }
    return { ...el, label: el.label ? { ...el.label, text: trimmed } : makeLabel(trimmed) };
  });
}
