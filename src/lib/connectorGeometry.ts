import { floorBounds } from '../model/ops';
import { depth } from './projection';
import type { Element } from '../model/types';
import { project } from './projection';
import type { Point, ViewState } from './projection';
import { wrapText } from './wrap';

const ASSET_LEFT = 60;
const ASSET_TOP = 85;
const ASSET_RIGHT = 60;
const ASSET_BOTTOM = 35;
const STANDALONE_TAG_MAX_CHARS = 22;
const STANDALONE_TAG_LINE_HEIGHT = 18;
const PLAIN_TEXT_MAX_CHARS = 24;
const PLAIN_TEXT_LINE_HEIGHT = 18;

function rectPoints(left: number, top: number, right: number, bottom: number): Point[] {
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

export function projectedElementHull(el: Element, elements: Element[], view: ViewState): Point[] | null {
  if (el.kind === 'connector') return null;
  if (el.kind === 'floor') {
    const bounds = floorBounds(elements, el);
    return [
      project({ x: bounds.gridX - 0.5, y: bounds.gridY - 0.5 }, view),
      project({ x: bounds.gridX + bounds.width - 0.5, y: bounds.gridY - 0.5 }, view),
      project({ x: bounds.gridX + bounds.width - 0.5, y: bounds.gridY + bounds.depth - 0.5 }, view),
      project({ x: bounds.gridX - 0.5, y: bounds.gridY + bounds.depth - 0.5 }, view),
    ];
  }

  const pt = project({ x: el.gridX, y: el.gridY }, view);
  if (el.kind === 'asset') {
    return rectPoints(pt.x - ASSET_LEFT, pt.y - ASSET_TOP, pt.x + ASSET_RIGHT, pt.y + ASSET_BOTTOM);
  }
  if (el.kind === 'tag') {
    const lines = wrapText(el.text, STANDALONE_TAG_MAX_CHARS, 2, true);
    const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
    const width = el.style === 'tips'
      ? longestLine * 7.5 + 44
      : longestLine * 8 + (el.icon ? 56 : 38);
    const height = Math.max(54, lines.length * STANDALONE_TAG_LINE_HEIGHT + 24);
    return rectPoints(pt.x - width / 2, pt.y - height / 2, pt.x + width / 2, pt.y + height / 2);
  }
  if (el.kind === 'text' && el.variant === 'callout') {
    const height = 20 + (el.title ? 24 : 0) + wrapText(el.content, 34).length * 18;
    return rectPoints(pt.x - 120, pt.y, pt.x + 120, pt.y + height);
  }
  const lines = wrapText(el.content, PLAIN_TEXT_MAX_CHARS, 2, true);
  const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const width = longestLine * 9 + 16;
  const height = lines.length * PLAIN_TEXT_LINE_HEIGHT + 8;
  return rectPoints(pt.x - width / 2, pt.y - height / 2, pt.x + width / 2, pt.y + height / 2);
}

function lineIntersection(from: Point, to: Point, a: Point, b: Point): { t: number; point: Point } | null {
  const sx = to.x - from.x;
  const sy = to.y - from.y;
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const denom = sx * ey - sy * ex;
  if (Math.abs(denom) < 1e-6) return null;
  const ax = a.x - from.x;
  const ay = a.y - from.y;
  const t = (ax * ey - ay * ex) / denom;
  const u = (ax * sy - ay * sx) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, point: { x: from.x + sx * t, y: from.y + sy * t } };
}

export function edgePoint(fromCenter: Point, toCenter: Point, hull: Point[] | null): Point {
  if (!hull || hull.length < 3) return fromCenter;
  let best: { t: number; point: Point } | null = null;
  for (let i = 0; i < hull.length; i++) {
    const hit = lineIntersection(fromCenter, toCenter, hull[i], hull[(i + 1) % hull.length]);
    if (!hit || hit.t < 1e-6) continue;
    if (!best || hit.t < best.t) best = hit;
  }
  return best?.point ?? fromCenter;
}

export function containsProjectedPoint(hull: Point[] | null, point: Point): boolean {
  if (!hull || hull.length < 3) return false;
  let inside = false;
  for (let i = 0, j = hull.length - 1; i < hull.length; j = i++) {
    const a = hull[i];
    const b = hull[j];
    const intersects = (a.y > point.y) !== (b.y > point.y) &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1e-6) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function elementAtProjectedPoint(
  elements: Element[], view: ViewState, point: Point, ignoreId?: string,
): Element | null {
  const hits = elements
    .filter((el) => el.kind !== 'connector' && el.id !== ignoreId)
    .filter((el) => containsProjectedPoint(projectedElementHull(el, elements, view), point))
    .sort((a, b) => layerRank(b) - layerRank(a) || depthPoint(b, elements, view) - depthPoint(a, elements, view));
  return hits[0] ?? null;
}

function layerRank(el: Element): number {
  return el.kind === 'floor' ? 0 : 1;
}

function depthPoint(el: Element, elements: Element[], view: ViewState): number {
  if (el.kind === 'floor') {
    const bounds = floorBounds(elements, el);
    return depth({ x: bounds.gridX + (bounds.width - 1) / 2, y: bounds.gridY + (bounds.depth - 1) / 2 }, view.rotation);
  }
  if (el.kind === 'connector') return Number.NEGATIVE_INFINITY;
  return depth({ x: el.gridX, y: el.gridY }, view.rotation);
}
