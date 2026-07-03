import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AssetEl } from '../../model/types';
import { AssetShape } from './AssetShape';

const ISO = { rotation: 0 as const, mode: 'iso' as const };

const labeled = (orientation: 'left' | 'right'): AssetEl => ({
  kind: 'asset', id: 'a', gridX: 0, gridY: 0, assetId: 'cube-plain', color: '#618AFF',
  label: { text: 'Label', style: 'tag', color: '#2A3242', orientation },
});

describe('AssetShape tag labels', () => {
  it('extend outward from the shape base by orientation (kit style)', () => {
    // w = 5*8+28 = 68 → along-axis shift = w/2 + 10 = 44
    expect(renderToStaticMarkup(<AssetShape el={labeled('right')} view={ISO} />))
      .toContain('translate(44 0)');
    expect(renderToStaticMarkup(<AssetShape el={labeled('left')} view={ISO} />))
      .toContain('translate(-44 0)');
  });
});
