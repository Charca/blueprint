import { icons } from 'lucide-react';
import { hexToHsl } from '../../lib/color';
import { readablePlaneMatrix, project } from '../../lib/projection';
import type { TagEl } from '../../model/types';
import type { ShapeProps } from './AssetShape';

export function TagShape({ el, view, selected, onPointerDown, onDoubleClick }: ShapeProps<TagEl>) {
  const pt = project({ x: el.gridX, y: el.gridY }, view);
  const dark = hexToHsl(el.color).l <= 0.7;
  const textFill = dark ? '#ffffff' : '#2a3242';
  const Icon = el.icon ? icons[el.icon as keyof typeof icons] : null;
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => onPointerDown?.(e, el.id),
    onDoubleClick: () => onDoubleClick?.(el.id),
  };
  const cursor = onPointerDown ? { cursor: 'move' as const } : undefined;

  if (el.style === 'tips') {
    const w = el.text.length * 7.5 + 24;
    return (
      <g transform={`translate(${pt.x} ${pt.y})`} {...handlers} style={cursor}>
        <path d={`M${-w / 2} -14 h${w} a6 6 0 0 1 6 6 v16 a6 6 0 0 1 -6 6 h${w * 0.1}` +
          ` l-6 8 l-6 -8 h${-w * 0.8 - 12} a6 6 0 0 1 -6 -6 v-16 a6 6 0 0 1 6 -6 z`}
          transform={`translate(${-6} 0)`}
          fill={dark ? el.color : '#ffffff'} stroke={dark ? 'none' : '#d4dae6'} />
        <text y={4} textAnchor="middle" fontSize={12} fill={textFill}>{el.text}</text>
        {selected && (
          <rect x={-w / 2 - 10} y={-20} width={w + 20} height={44} rx={8}
            fill="none" stroke="#7C5CFF" strokeWidth={1.5} strokeDasharray="5 4" />
        )}
      </g>
    );
  }

  const w = el.text.length * 8 + (Icon ? 46 : 28);
  const h = 28;
  const transform = view.mode === 'iso'
    ? readablePlaneMatrix({ x: el.gridX, y: el.gridY }, view)
    : `translate(${pt.x} ${pt.y})`;

  return (
    <g transform={transform} {...handlers} style={cursor}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={el.color} />
      {Icon && <Icon x={-w / 2 + 10} y={-8} width={16} height={16} color={textFill} />}
      <text x={Icon ? 9 : 0} y={4.5} textAnchor="middle" fontSize={13} fontWeight={700}
        fill={textFill}>{el.text}</text>
      {selected && (
        <rect x={-w / 2 - 5} y={-h / 2 - 5} width={w + 10} height={h + 10} rx={h / 2 + 5}
          fill="none" stroke="#7C5CFF" strokeWidth={1.5} strokeDasharray="5 4" />
      )}
    </g>
  );
}
