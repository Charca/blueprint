import { describe, expect, it } from 'vitest';
import type { AssetEl, Element } from '../model/types';
import { anchorOfElement } from '../model/ops';
import { project } from './projection';
import { edgePoint, elementAtProjectedPoint, projectedElementHull } from './connectorGeometry';

const ISO = { rotation: 0 as const, mode: 'iso' as const };

const asset = (id: string, x: number, y: number): AssetEl => ({
  kind: 'asset', id, gridX: x, gridY: y, assetId: 'cube-plain', color: '#618AFF',
});

describe('connectorGeometry', () => {
  it('intersects asset outlines instead of returning centers', () => {
    const elements: Element[] = [asset('a', 0, 0), asset('b', 3, 0)];
    const [from, to] = elements;
    const fromCenter = project(anchorOfElement(from, elements)!, ISO);
    const toCenter = project(anchorOfElement(to, elements)!, ISO);

    const start = edgePoint(fromCenter, toCenter, projectedElementHull(from, elements, ISO));
    const end = edgePoint(toCenter, fromCenter, projectedElementHull(to, elements, ISO));

    expect(start.x).toBeCloseTo(60, 4);
    expect(start.y).toBeCloseTo(34.641, 3);
    expect(end.x).toBeCloseTo(69.904, 3);
    expect(end.y).toBeCloseTo(40.359, 3);
  });

  it('finds the topmost connectable element under a projected point', () => {
    const elements: Element[] = [
      {
        kind: 'floor', id: 'f', gridX: -1, gridY: -1, width: 4, depth: 4,
        corners: 'sharp', color: '#D9E2EC',
      },
      asset('a', 0, 0),
    ];
    expect(elementAtProjectedPoint(elements, ISO, project({ x: 0, y: 0 }, ISO))?.id).toBe('a');
    expect(elementAtProjectedPoint(elements, ISO, project({ x: 1, y: 1 }, ISO), 'a')?.id).toBe('f');
  });
});
