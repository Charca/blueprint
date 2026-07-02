export const CELL = 50;
export const ISO_X = (Math.sqrt(3) / 2) * CELL; // 43.301
export const ISO_Y = CELL / 2;                  // 25

export type Rotation = 0 | 1 | 2 | 3;
export interface Point { x: number; y: number }
export interface ViewState { rotation: Rotation; mode: 'iso' | 'top' }

export function rotateGrid(p: Point, r: Rotation): Point {
  switch (r) {
    case 0: return { x: p.x, y: p.y };
    case 1: return { x: -p.y, y: p.x };
    case 2: return { x: -p.x, y: -p.y };
    default: return { x: p.y, y: -p.x };
  }
}

export function unrotateGrid(p: Point, r: Rotation): Point {
  return rotateGrid(p, ((4 - r) % 4) as Rotation);
}

export function project(p: Point, view: ViewState): Point {
  const q = rotateGrid(p, view.rotation);
  return view.mode === 'iso'
    ? { x: (q.x - q.y) * ISO_X, y: (q.x + q.y) * ISO_Y }
    : { x: q.x * CELL, y: q.y * CELL };
}

export function unproject(pt: Point, view: ViewState): Point {
  const q = view.mode === 'iso'
    ? { x: (pt.x / ISO_X + pt.y / ISO_Y) / 2, y: (pt.y / ISO_Y - pt.x / ISO_X) / 2 }
    : { x: pt.x / CELL, y: pt.y / CELL };
  return unrotateGrid(q, view.rotation);
}

/** Painter's-algorithm sort key: larger = closer to the viewer. */
export function depth(p: Point, r: Rotation): number {
  const q = rotateGrid(p, r);
  return q.x + q.y;
}

/** SVG transform mapping "plane space" (CELL px per grid cell, origin at
 * `corner`) onto the projected view. Lets us draw rounded rects/text flat
 * and have them lie on the floor plane in iso mode. */
export function planeMatrix(corner: Point, view: ViewState): string {
  const o = project(corner, view);
  const u = project({ x: corner.x + 1, y: corner.y }, view);
  const v = project({ x: corner.x, y: corner.y + 1 }, view);
  const a = (u.x - o.x) / CELL, b = (u.y - o.y) / CELL;
  const c = (v.x - o.x) / CELL, d = (v.y - o.y) / CELL;
  return `matrix(${a} ${b} ${c} ${d} ${o.x} ${o.y})`;
}
