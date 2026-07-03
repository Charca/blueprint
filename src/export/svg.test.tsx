import { describe, expect, it } from 'vitest';
import type { Doc } from '../model/types';
import { buildSvg, contentBounds } from './svg';
import { wrapText } from '../lib/wrap';

const doc: Doc = {
  id: 'd1', name: 'T', schemaVersion: 1,
  view: { rotation: 0, mode: 'iso' },
  camera: { x: 0, y: 0, zoom: 1 },
  elements: [
    { kind: 'asset', id: 'a1', gridX: 0, gridY: 0, assetId: 'cube-plain', color: '#E05252' },
    { kind: 'asset', id: 'a2', gridX: 3, gridY: 0, assetId: 'cube-server', color: '#E05252' },
    { kind: 'connector', id: 'c1', fromId: 'a1', toId: 'a2', style: 'dashed', color: '#425066' },
  ],
};

describe('export/svg', () => {
  it('bounds cover all projected elements with padding', () => {
    const b = contentBounds(doc.elements, doc.view);
    expect(b.width).toBeGreaterThan(100);
    expect(b.minX).toBeLessThan(0);
  });

  it('defaults bounds for empty documents', () => {
    expect(contentBounds([], doc.view)).toEqual({ minX: -400, minY: -300, width: 800, height: 600 });
  });

  it('bounds scale with the callout card height', () => {
    const long = 'word '.repeat(60).trim();
    const callout: Doc = {
      ...doc,
      elements: [{
        kind: 'text', id: 'x1', gridX: 0, gridY: 0, title: 'Title',
        content: long, variant: 'callout',
      }],
    };
    const cardH = 20 + 24 + wrapText(long, 34).length * 18;
    expect(cardH).toBeGreaterThan(150); // this case clipped under the old flat constant
    const b = contentBounds(callout.elements, callout.view);
    expect(b.minY + b.height).toBeGreaterThanOrEqual(cardH + 10 + 80);
    expect(b.minX).toBeLessThanOrEqual(-130 - 80);
  });

  it('buildSvg emits a standalone recolored SVG', () => {
    const svg = buildSvg(doc);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox=');
    expect(svg.toLowerCase()).not.toContain('#3258c2'); // both assets recolored away from kit hexes
    expect(svg).toContain('stroke-dasharray');
    expect(svg).not.toContain('__BP__');
    expect(svg).not.toContain('class=');
  });

  it('includes shape labels in the markup and bounds', () => {
    const labeled: Doc = {
      ...doc,
      elements: [{
        kind: 'asset', id: 'a1', gridX: 0, gridY: 0, assetId: 'cube-plain', color: '#E05252',
        label: { text: 'Gateway', style: 'tag', color: '#D6E0FF', orientation: 'left' },
      }],
    };
    expect(buildSvg(labeled)).toContain('Gateway');
    const b = contentBounds(labeled.elements, labeled.view);
    expect(b.minY + b.height).toBeGreaterThanOrEqual(74 + 80);
  });
});
