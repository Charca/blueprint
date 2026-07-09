import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ConnectorEl, Element } from '../../model/types';
import { ConnectorShape } from './ConnectorShape';

const TOP = { rotation: 0 as const, mode: 'top' as const };
const ISO = { rotation: 0 as const, mode: 'iso' as const };
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

  it('defaults connectors to rounded elbow paths', () => {
    const html = renderToStaticMarkup(
      <ConnectorShape el={connector()} elements={elements} view={TOP} />,
    );
    expect(html).toContain(' Q ');
    expect(html).toContain('stroke-linejoin="round"');
  });

  it('renders a selected elbow handle at a customized bend', () => {
    const html = renderToStaticMarkup(
      <ConnectorShape el={connector({ elbowOffset: 50 })} elements={elements} view={TOP} selected onElbowPointerDown={() => undefined} />,
    );
    expect(html).toContain('cx="150"');
    expect(html).toContain('cursor:ew-resize');
  });

  it('draws iso connectors inside the floor plane transform', () => {
    const html = renderToStaticMarkup(
      <ConnectorShape el={connector()} elements={elements} view={ISO} />,
    );
    expect(html).toContain('transform="matrix(0.8660254037844386 0.5 -0.8660254037844386 0.5 0 0)"');
  });
});
