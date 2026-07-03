import { ASSETS } from '../../generated/assets';
import { derivePalette } from '../../lib/color';
import { project } from '../../lib/projection';
import { iconFor } from '../../lib/topIcons';
import type { AssetEl } from '../../model/types';
import type { ShapeProps } from './AssetShape';

const S = 42;

export function TopTile({ el, view, selected, onPointerDown }: ShapeProps<AssetEl>) {
  const pt = project({ x: el.gridX, y: el.gridY }, view);
  const pal = derivePalette(el.color);
  const Icon = iconFor(el.assetId);
  const name = ASSETS[el.assetId]?.name ?? el.assetId;
  return (
    <g
      transform={`translate(${pt.x - S / 2} ${pt.y - S / 2})`}
      onPointerDown={(e) => onPointerDown?.(e, el.id)}
      style={onPointerDown ? { cursor: 'move' } : undefined}
    >
      <rect width={S} height={S} rx={10}
        fill={pal['#a3bbff']} stroke={pal['#3258c2']} strokeWidth={2} />
      <Icon x={9} y={9} width={24} height={24} color={pal['#3258c2']} />
      <text x={S / 2} y={S + 13} textAnchor="middle" fontSize={10} fill="#5a6579">{name}</text>
      {selected && (
        <rect x={-4} y={-4} width={S + 8} height={S + 8} rx={12}
          fill="none" stroke="#7C5CFF" strokeWidth={1.5} strokeDasharray="5 4" />
      )}
    </g>
  );
}
