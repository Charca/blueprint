import { CELL, planeMatrix, project } from '../../lib/projection';
import {
  connectorEndHead,
  connectorPathD,
  connectorRoute,
  connectorRoutePoints,
  connectorStartHead,
  padConnectorHeadEndpoints,
  planeElementHull,
  planePoint,
} from '../../lib/connectorGeometry';
import { anchorOfElement } from '../../model/ops';
import type { PointerEvent } from 'react';
import type { ConnectorEl, ConnectorHead, Element } from '../../model/types';
import type { ShapeProps } from './AssetShape';

interface ConnectorProps extends ShapeProps<ConnectorEl> {
  elements: Element[];
  onElbowPointerDown?: (e: PointerEvent, id: string) => void;
}

function markerRef(id: string, head: ConnectorHead | undefined): string | undefined {
  return head && head !== 'none' ? `url(#${id}-${head})` : undefined;
}

function ConnectorMarker({ id, head, color }: { id: string; head: ConnectorHead; color: string }) {
  if (head === 'none') return null;
  const common = {
    id: `${id}-${head}`,
    viewBox: '0 0 10 10',
    refX: 8,
    refY: 5,
    markerWidth: 6,
    markerHeight: 6,
    orient: 'auto-start-reverse',
  } as const;
  if (head === 'arrow') {
    return (
      <marker {...common}>
        <path d="M0 0L10 5L0 10z" fill={color} />
      </marker>
    );
  }
  if (head === 'triangle') {
    return (
      <marker {...common}>
        <path d="M1 1L9 5L1 9z" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      </marker>
    );
  }
  if (head === 'circle') {
    return (
      <marker {...common} refX={5} markerWidth={7} markerHeight={7}>
        <circle cx={5} cy={5} r={3.2} fill={color} />
      </marker>
    );
  }
  return (
    <marker {...common} refX={5} markerWidth={7} markerHeight={7}>
      <rect x={2} y={2} width={6} height={6} rx={0.8} fill={color} />
    </marker>
  );
}

export function ConnectorShape({
  el, elements, view, selected, onPointerDown, onDoubleClick, onElbowPointerDown,
}: ConnectorProps) {
  const from = elements.find((x) => x.id === el.fromId);
  const to = elements.find((x) => x.id === el.toId);
  if (!from || !to) return null;
  const fa = anchorOfElement(from, elements), ta = anchorOfElement(to, elements);
  if (!fa || !ta) return null;
  const a = planePoint(fa), b = planePoint(ta);
  const route = connectorRoute(el);
  const points = connectorRoutePoints(
    a,
    b,
    planeElementHull(from, elements),
    planeElementHull(to, elements),
    route,
    el.elbowOffset,
  );
  const dash = el.style === 'dashed' ? '10 6' : el.style === 'dotted' ? '0.1 9' : undefined;
  const markerId = `connector-${el.id}`;
  const startHead = connectorStartHead(el);
  const endHead = connectorEndHead(el);
  const paddedPoints = padConnectorHeadEndpoints(points, startHead !== 'none', endHead !== 'none');
  const d = connectorPathD(paddedPoints, route === 'elbow');
  const midPlane = points[Math.floor(points.length / 2)] ?? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const mid = project({ x: midPlane.x / CELL, y: midPlane.y / CELL }, view);
  const stroke = selected ? '#7C5CFF' : el.color;
  const markerHeads = [...new Set([startHead, endHead])];
  const labelW = el.label ? el.label.length * 8 + 24 : 0;
  const elbowHandle = route === 'elbow' && points.length >= 4
    ? {
        x: points[1].x,
        y: (points[1].y + points[2].y) / 2,
      }
    : null;

  return (
    <g
      onPointerDown={(e) => onPointerDown?.(e, el.id)}
      onDoubleClick={() => onDoubleClick?.(el.id)}
      style={onPointerDown ? { cursor: 'pointer' } : undefined}
    >
      <defs>
        {markerHeads.map((head) => <ConnectorMarker key={head} id={markerId} head={head} color={stroke} />)}
      </defs>
      <g transform={planeMatrix({ x: 0, y: 0 }, view)}>
        <path d={d} fill="none" stroke="transparent" strokeWidth={14} strokeLinejoin="round" strokeLinecap="round" />
        <path
          d={d}
          fill="none"
          stroke={stroke} strokeWidth={3}
          strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round"
          markerStart={markerRef(markerId, startHead)}
          markerEnd={markerRef(markerId, endHead)}
        />
        {selected && elbowHandle && (
          <g
            onPointerDown={(e) => {
              e.stopPropagation();
              onElbowPointerDown?.(e, el.id);
            }}
            style={onElbowPointerDown ? { cursor: 'ew-resize' } : undefined}
          >
            <circle cx={elbowHandle.x} cy={elbowHandle.y} r={9} fill="#ffffff" stroke="#7C5CFF" strokeWidth={3} />
            <circle cx={elbowHandle.x} cy={elbowHandle.y} r={3} fill="#7C5CFF" />
          </g>
        )}
      </g>
      {el.label && (
        <g transform={`translate(${mid.x} ${mid.y})`}>
          <rect x={-labelW / 2} y={-13} width={labelW} height={26} rx={13} fill={el.color} />
          <text y={4} textAnchor="middle" fontSize={12} fontWeight={700}
            fill="#ffffff" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            {el.label}
          </text>
        </g>
      )}
    </g>
  );
}
