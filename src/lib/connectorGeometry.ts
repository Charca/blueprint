import { floorBounds } from '../model/ops';
import { depth } from './projection';
import type { ConnectorEl, Element } from '../model/types';
import { project } from './projection';
import type { Point, ViewState } from './projection';
import { wrapText } from './wrap';

const ASSET_LEFT = 60;
const ASSET_TOP = 85;
const ASSET_RIGHT = 60;
const ASSET_BOTTOM = 35;
const ELBOW_RADIUS = 18;

export const DEFAULT_CONNECTOR_START_HEAD = 'none' as const;
export const DEFAULT_CONNECTOR_END_HEAD = 'arrow' as const;
export const DEFAULT_CONNECTOR_ROUTE = 'sharp' as const;

export function connectorStartHead(el: Pick<ConnectorEl, 'startHead'>) {
  return el.startHead ?? DEFAULT_CONNECTOR_START_HEAD;
}

export function connectorEndHead(el: Pick<ConnectorEl, 'endHead'>) {
  return el.endHead ?? DEFAULT_CONNECTOR_END_HEAD;
}

export function connectorRoute(el: Pick<ConnectorEl, 'route'>) {
  return el.route ?? DEFAULT_CONNECTOR_ROUTE;
}

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
    const width = el.style === 'tips'
      ? el.text.length * 7.5 + 44
      : el.text.length * 8 + (el.icon ? 56 : 38);
    return rectPoints(pt.x - width / 2, pt.y - 22, pt.x + width / 2, pt.y + 32);
  }
  if (el.kind === 'text' && el.variant === 'callout') {
    const height = 20 + (el.title ? 24 : 0) + wrapText(el.content, 34).length * 18;
    return rectPoints(pt.x - 120, pt.y, pt.x + 120, pt.y + height);
  }
  const width = el.content.length * 9 + 16;
  return rectPoints(pt.x - width / 2, pt.y - 16, pt.x + width / 2, pt.y + 10);
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

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
}

function compactPoints(points: Point[]): Point[] {
  return points.filter((point, index) => index === 0 || !samePoint(point, points[index - 1]));
}

export function connectorRoutePoints(
  fromCenter: Point,
  toCenter: Point,
  fromHull: Point[] | null,
  toHull: Point[] | null,
  route: ConnectorEl['route'] = DEFAULT_CONNECTOR_ROUTE,
): Point[] {
  if ((route ?? DEFAULT_CONNECTOR_ROUTE) === 'sharp') {
    return [edgePoint(fromCenter, toCenter, fromHull), edgePoint(toCenter, fromCenter, toHull)];
  }

  const midX = (fromCenter.x + toCenter.x) / 2;
  const centerRoute = compactPoints([
    fromCenter,
    { x: midX, y: fromCenter.y },
    { x: midX, y: toCenter.y },
    toCenter,
  ]);
  const startToward = centerRoute[1] ?? toCenter;
  const endFrom = centerRoute[centerRoute.length - 2] ?? fromCenter;
  const start = edgePoint(fromCenter, startToward, fromHull);
  const end = edgePoint(toCenter, endFrom, toHull);
  return compactPoints([start, ...centerRoute.slice(1, -1), end]);
}

export function connectorPathD(points: Point[], rounded = false, radius = ELBOW_RADIUS): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (!rounded || points.length < 3) {
    return `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')}`;
  }
  const parts = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const current = points[i];
    const next = points[i + 1];
    const inLen = Math.hypot(current.x - prev.x, current.y - prev.y);
    const outLen = Math.hypot(next.x - current.x, next.y - current.y);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    if (r <= 0) {
      parts.push(`L ${current.x} ${current.y}`);
      continue;
    }
    const before = {
      x: current.x + ((prev.x - current.x) / inLen) * r,
      y: current.y + ((prev.y - current.y) / inLen) * r,
    };
    const after = {
      x: current.x + ((next.x - current.x) / outLen) * r,
      y: current.y + ((next.y - current.y) / outLen) * r,
    };
    parts.push(`L ${before.x} ${before.y}`, `Q ${current.x} ${current.y} ${after.x} ${after.y}`);
  }
  const last = points[points.length - 1];
  parts.push(`L ${last.x} ${last.y}`);
  return parts.join(' ');
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
