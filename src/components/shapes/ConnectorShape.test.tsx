import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ConnectorEl, Element } from '../../model/types';
import { ConnectorShape } from './ConnectorShape';

const TOP = { rotation: 0 as const, mode: 'top' as const };
const elements: Element[] = [
  { kind: 'asset', id: 'a', gridX: 0, gridY: 0, assetId: 'cube-plain', color: '#618AFF' },
  { kind: 'asset', id: 'b', gridX: 4, gridY: 2, assetId: 'cube-plain', color: '#618AFF' },
];

function connector(patch: Partial<ConnectorEl> = {}): ConnectorEl {
  return {
    kind: 'connector', id: 'c', fromId: 'a', toId: 'b', style: 'solid', color: '#425066',
    ...patch,
  };
}

describe('ConnectorShape connector heads and routing', () => {
  it('renders independent markerStart and markerEnd heads', () => {
    const html = renderToStaticMarkup(
      <ConnectorShape el={connector({ startHead: 'circle', endHead: 'square' })} elements={elements} view={TOP} />,
    );
    expect(html).toContain('marker-start="url(#connector-c-circle)"');
    expect(html).toContain('marker-end="url(#connector-c-square)"');
    expect(html).toContain('<circle');
    expect(html).toContain('<rect');
  });

  it('defaults existing connectors to no start head and an end arrow', () => {
    const html = renderToStaticMarkup(
      <ConnectorShape el={connector()} elements={elements} view={TOP} />,
    );
    expect(html).not.toContain('marker-start=');
    expect(html).toContain('marker-end="url(#connector-c-arrow)"');
  });

  it('renders elbow connectors as rounded paths', () => {
    const html = renderToStaticMarkup(
      <ConnectorShape el={connector({ route: 'elbow' })} elements={elements} view={TOP} />,
    );
    expect(html).toContain(' Q ');
    expect(html).toContain('stroke-linejoin="round"');
  });
});
