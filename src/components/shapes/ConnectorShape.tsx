import { project } from '../../lib/projection';
import { edgePoint, projectedElementHull } from '../../lib/connectorGeometry';
import { anchorOfElement } from '../../model/ops';
import type { ConnectorEl, Element } from '../../model/types';
import type { ShapeProps } from './AssetShape';

interface ConnectorProps extends ShapeProps<ConnectorEl> {
  elements: Element[];
}

export function ConnectorShape({
  el, elements, view, selected, onPointerDown, onDoubleClick,
}: ConnectorProps) {
  const from = elements.find((x) => x.id === el.fromId);
  const to = elements.find((x) => x.id === el.toId);
  if (!from || !to) return null;
  const fa = anchorOfElement(from, elements), ta = anchorOfElement(to, elements);
  if (!fa || !ta) return null;
  const a = project(fa, view), b = project(ta, view);
  const A = edgePoint(a, b, projectedElementHull(from, elements, view));
  const B = edgePoint(b, a, projectedElementHull(to, elements, view));
  const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const dash = el.style === 'dashed' ? '10 6' : el.style === 'dotted' ? '0.1 9' : undefined;
  const markerId = `arrow-${el.id}`;
  const labelW = el.label ? el.label.length * 8 + 24 : 0;

  return (
    <g
      onPointerDown={(e) => onPointerDown?.(e, el.id)}
      onDoubleClick={() => onDoubleClick?.(el.id)}
      style={onPointerDown ? { cursor: 'pointer' } : undefined}
    >
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5"
          markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={el.color} />
        </marker>
      </defs>
      <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="transparent" strokeWidth={14} />
      <line
        x1={A.x} y1={A.y} x2={B.x} y2={B.y}
        stroke={selected ? '#7C5CFF' : el.color} strokeWidth={3}
        strokeDasharray={dash} strokeLinecap="round"
        markerEnd={`url(#${markerId})`}
      />
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
