import { describe, expect, it } from 'vitest';
import {
  CELL, ISO_X, ISO_Y, depth, planeMatrix, readablePlaneMatrix, project, rotateGrid, unproject, unrotateGrid,
} from './projection';
import type { Rotation, ViewState } from './projection';

const ISO: ViewState = { rotation: 0, mode: 'iso' };
const TOP: ViewState = { rotation: 0, mode: 'top' };

describe('projection', () => {
  it('projects the origin to the origin in both modes', () => {
    expect(project({ x: 0, y: 0 }, ISO)).toEqual({ x: 0, y: 0 });
    expect(project({ x: 0, y: 0 }, TOP)).toEqual({ x: 0, y: 0 });
  });

  it('projects iso axes symmetrically', () => {
    expect(project({ x: 1, y: 0 }, ISO)).toEqual({ x: ISO_X, y: ISO_Y });
    expect(project({ x: 0, y: 1 }, ISO)).toEqual({ x: -ISO_X, y: ISO_Y });
  });

  it('projects top mode to a plain grid', () => {
    expect(project({ x: 2, y: 3 }, TOP)).toEqual({ x: 2 * CELL, y: 3 * CELL });
  });

  it('rotateGrid cycles back to identity after 4 steps', () => {
    let p = { x: 3, y: -2 };
    for (let i = 0; i < 4; i++) p = rotateGrid(p, 1);
    expect(p).toEqual({ x: 3, y: -2 });
  });

  it('unrotateGrid inverts rotateGrid for every rotation', () => {
    const p = { x: 5, y: 7 };
    for (const r of [0, 1, 2, 3] as Rotation[]) {
      expect(unrotateGrid(rotateGrid(p, r), r)).toEqual(p);
    }
  });

  it('unproject inverts project in every view', () => {
    const p = { x: 4, y: -3 };
    for (const mode of ['iso', 'top'] as const) {
      for (const rotation of [0, 1, 2, 3] as Rotation[]) {
        const view = { rotation, mode };
        const q = unproject(project(p, view), view);
        expect(q.x).toBeCloseTo(p.x, 6);
        expect(q.y).toBeCloseTo(p.y, 6);
      }
    }
  });

  it('depth increases toward the viewer along +x and +y', () => {
    expect(depth({ x: 1, y: 1 }, 0)).toBeGreaterThan(depth({ x: 0, y: 0 }, 0));
  });

  it('planeMatrix maps a unit cell onto projected basis vectors', () => {
    const m = planeMatrix({ x: 0, y: 0 }, ISO);
    const [a, b, c, d, e, f] = m.slice(7, -1).split(' ').map(Number);
    expect(a * CELL).toBeCloseTo(ISO_X, 4);
    expect(b * CELL).toBeCloseTo(ISO_Y, 4);
    expect(c * CELL).toBeCloseTo(-ISO_X, 4);
    expect(d * CELL).toBeCloseTo(ISO_Y, 4);
    expect(e).toBe(0);
    expect(f).toBe(0);
  });

  it('readablePlaneMatrix never points the x-basis leftward', () => {
    for (const mode of ['iso', 'top'] as const) {
      for (const rotation of [0, 1, 2, 3] as Rotation[]) {
        const m = readablePlaneMatrix({ x: 0, y: 0 }, { rotation, mode });
        const a = Number(m.slice(7, -1).split(' ')[0]);
        expect(a).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
