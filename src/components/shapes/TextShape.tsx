import { project } from '../../lib/projection';
import { wrapText } from '../../lib/wrap';
import type { TextEl } from '../../model/types';
import type { ShapeProps } from './AssetShape';

export function TextShape({ el, view, selected, onPointerDown, onDoubleClick }: ShapeProps<TextEl>) {
  const pt = project({ x: el.gridX, y: el.gridY }, view);
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => onPointerDown?.(e, el.id),
    onDoubleClick: () => onDoubleClick?.(el.id),
  };
  const cursor = onPointerDown ? { cursor: 'move' as const } : undefined;

  if (el.variant === 'plain') {
    return (
      <g transform={`translate(${pt.x} ${pt.y})`} {...handlers} style={cursor}>
        <text textAnchor="middle" fontSize={15} fontWeight={600} fill="#2a3242">
          {el.content}
        </text>
        {selected && (
          <rect x={-el.content.length * 4.5 - 8} y={-16} width={el.content.length * 9 + 16}
            height={26} fill="none" stroke="#7C5CFF" strokeWidth={1.5} strokeDasharray="5 4" />
        )}
      </g>
    );
  }

  const W = 240;
  const lines = wrapText(el.content, 34);
  const titleH = el.title ? 24 : 0;
  const H = 20 + titleH + lines.length * 18;
  return (
    <g transform={`translate(${pt.x} ${pt.y})`} {...handlers} style={cursor}>
      <rect x={-W / 2} y={0} width={W} height={H} rx={8} fill="#ffffff"
        stroke={selected ? '#7C5CFF' : '#e3e8f2'} strokeWidth={selected ? 1.5 : 1} />
      {el.title && (
        <text x={-W / 2 + 14} y={26} fontSize={14} fontWeight={700} fill="#2a3242">
          {el.title}
        </text>
      )}
      {lines.map((line, i) => (
        <text key={i} x={-W / 2 + 14} y={titleH + 26 + i * 18} fontSize={12.5} fill="#5a6579">
          {line}
        </text>
      ))}
    </g>
  );
}
