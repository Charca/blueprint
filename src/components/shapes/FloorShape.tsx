import { CELL, planeMatrix, project } from '../../lib/projection';
import { derivePalette } from '../../lib/color';
import type { FloorEl } from '../../model/types';
import type { ShapeProps } from './AssetShape';
import { LabelView } from './LabelView';

export function FloorShape({ el, view, selected, onPointerDown, onDoubleClick }: ShapeProps<FloorEl>) {
  const corner = { x: el.gridX - 0.5, y: el.gridY - 0.5 };
  const m = planeMatrix(corner, view);
  const w = el.width * CELL, d = el.depth * CELL;
  const rx = el.corners === 'pill' ? Math.min(w, d) / 2 : el.corners === 'rounded' ? 18 : 0;
  const pal = derivePalette(el.color);
  const thickness = view.mode === 'iso' ? 6 : 0;
  const center = project({ x: el.gridX + (el.width - 1) / 2, y: el.gridY + (el.depth - 1) / 2 }, view);

  return (
    <g
      onPointerDown={(e) => onPointerDown?.(e, el.id)}
      onDoubleClick={() => onDoubleClick?.(el.id)}
      style={onPointerDown ? { cursor: 'move' } : undefined}
    >
      {thickness > 0 && (
        <g transform={`translate(0 ${thickness})`}>
          <g transform={m}>
            <rect width={w} height={d} rx={rx} fill={pal['#7394f3']} />
          </g>
        </g>
      )}
      <g transform={m}>
        <rect
          width={w} height={d} rx={rx} fill={pal['#d6e0ff']}
          stroke={selected ? '#7C5CFF' : 'none'} strokeWidth={2}
          strokeDasharray={selected ? '6 4' : undefined}
        />
      </g>
      {el.label && <LabelView label={el.label} anchor={center} />}
    </g>
  );
}
