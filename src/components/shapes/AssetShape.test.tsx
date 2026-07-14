import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render } from '@testing-library/react';
import type { AssetEl } from '../../model/types';
import { AssetShape } from './AssetShape';

const ISO = { rotation: 0 as const, mode: 'iso' as const };

const labeled = (orientation: 'left' | 'right'): AssetEl => ({
  kind: 'asset', id: 'a', gridX: 0, gridY: 0, assetId: 'cube-plain', color: '#618AFF',
  label: { text: 'Label', style: 'tag', color: '#2A3242', orientation },
});

describe('AssetShape tag labels', () => {
  it('centers tag labels under the shape while preserving readable tilt', () => {
    const right = renderToStaticMarkup(<AssetShape el={labeled('right')} view={ISO} />);
    const left = renderToStaticMarkup(<AssetShape el={labeled('left')} view={ISO} />);
    // right side: up-right text axis, centered on the asset label anchor
    expect(right).toContain('matrix(0.8660254037844386 -0.5 0.8660254037844386 0.5 60 129)');
    expect(right).toContain('translate(0 0)');
    // left side: down-right text axis, centered on the asset label anchor
    expect(left).toContain('matrix(0.8660254037844386 0.5 -0.8660254037844386 0.5 60 129)');
    expect(left).toContain('translate(0 0)');
  });

  it('keeps artwork DOM nodes stable across re-renders', () => {
    // React 19 rewrites dangerouslySetInnerHTML on every commit unless the
    // subtree is memoized; a discarded node mid-gesture suppresses the
    // browser's click/dblclick synthesis (double-click to edit labels).
    const el = labeled('right');
    const { container, rerender } = render(<svg><AssetShape el={el} view={ISO} /></svg>);
    const path = container.querySelector('path');
    expect(path).toBeTruthy();
    rerender(<svg><AssetShape el={el} view={ISO} selected /></svg>);
    expect(path!.isConnected).toBe(true);
  });
});
