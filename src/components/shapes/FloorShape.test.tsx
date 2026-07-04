import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FloorEl } from '../../model/types';
import { FloorShape } from './FloorShape';

const ISO = { rotation: 0 as const, mode: 'iso' as const };

const labeledFloor = (orientation: 'left' | 'right'): FloorEl => ({
  kind: 'floor', id: 'f', gridX: 0, gridY: 0, width: 4, depth: 3,
  corners: 'sharp', color: '#D9E2EC',
  label: { text: 'Floor label', style: 'tag', color: '#2A3242', orientation },
});

describe('FloorShape labels', () => {
  it('centers left tag labels along the outside lower edge', () => {
    const markup = renderToStaticMarkup(<FloorShape el={labeledFloor('left')} view={ISO} />);
    expect(markup).toContain('matrix(0.8660254037844386 0.5 -0.8660254037844386 0.5 -79.67433714816836 127)');
    expect(markup).toContain('translate(0 0)');
  });

  it('centers right tag labels along the outside right edge', () => {
    const markup = renderToStaticMarkup(<FloorShape el={labeledFloor('right')} view={ISO} />);
    expect(markup).toContain('matrix(0.8660254037844386 -0.5 0.8660254037844386 0.5 144.62624243200125 139.5)');
    expect(markup).toContain('translate(0 0)');
  });
});
