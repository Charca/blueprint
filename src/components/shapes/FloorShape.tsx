import type { PointerEvent } from 'react';
import { CELL, planeMatrix, project } from '../../lib/projection';
import { derivePalette } from '../../lib/color';
import { floorBounds, floorShadowOf, floorThickness, floorTypeOf } from '../../model/ops';
import type { Element, FloorEl } from '../../model/types';
import type { ShapeProps } from './AssetShape';
import { LabelView } from './LabelView';

const FLOOR_LABEL_GAP = 42;
const HANDLE = 12;

type ResizeSide = 'left' | 'right' | 'top' | 'bottom';

function cursorForSide(side: ResizeSide, mode: 'iso' | 'top') {
  if (mode === 'top') return side === 'left' || side === 'right' ? 'ew-resize' : 'ns-resize';
  return side === 'left' || side === 'right' ? 'nwse-resize' : 'nesw-resize';
}

export function FloorShape({
  el, elements, view, selected, highlighted, onPointerDown, onDoubleClick, onResizePointerDown,
}: ShapeProps<FloorEl> & {
  elements?: Element[];
  highlighted?: boolean;
  onResizePointerDown?: (e: PointerEvent, id: string, side: ResizeSide) => void;
}) {
  const bounds = elements ? floorBounds(elements, el) : el;
  const corner = { x: bounds.gridX - 0.5, y: bounds.gridY - 0.5 };
  const m = planeMatrix(corner, view);
  const w = bounds.width * CELL, d = bounds.depth * CELL;
  const rx = el.corners === 'pill' ? Math.min(w, d) / 2 : el.corners === 'rounded' ? 18 : 0;
  const pal = derivePalette(el.color);
  const type = floorTypeOf(el);
  const hasShadow = floorShadowOf(el);
  const thickness = floorThickness(el, view.mode);
  const floorCenter = project({
    x: bounds.gridX + (bounds.width - 1) / 2,
    y: bounds.gridY + (bounds.depth - 1) / 2,
  }, view);
  const side = el.label?.orientation === 'right'
    ? [
        project({ x: bounds.gridX + bounds.width - 0.5, y: bounds.gridY - 0.5 }, view),
        project({ x: bounds.gridX + bounds.width - 0.5, y: bounds.gridY + bounds.depth - 0.5 }, view),
      ]
    : [
        project({ x: bounds.gridX - 0.5, y: bounds.gridY + bounds.depth - 0.5 }, view),
        project({ x: bounds.gridX + bounds.width - 0.5, y: bounds.gridY + bounds.depth - 0.5 }, view),
      ];
  const sideCenter = {
    x: (side[0].x + side[1].x) / 2,
    y: (side[0].y + side[1].y) / 2,
  };
  const outward = { x: sideCenter.x - floorCenter.x, y: sideCenter.y - floorCenter.y };
  const outwardLen = Math.hypot(outward.x, outward.y) || 1;
  const labelAnchor = {
    x: sideCenter.x + (outward.x / outwardLen) * FLOOR_LABEL_GAP,
    y: sideCenter.y + thickness + (outward.y / outwardLen) * FLOOR_LABEL_GAP,
  };

  return (
    <g
      onPointerDown={(e) => onPointerDown?.(e, el.id)}
      onDoubleClick={() => onDoubleClick?.(el.id)}
      style={onPointerDown ? { cursor: 'move' } : undefined}
    >
      {hasShadow && (
        <g transform={`translate(0 ${thickness + 8})`} opacity={type === 'raised' ? 0.22 : 0.16}
          style={{ filter: 'blur(7px)' }} pointerEvents="none">
          <g transform={m}>
            <rect x={6} y={6} width={Math.max(0, w - 12)} height={Math.max(0, d - 12)} rx={rx} fill="#1d2433" />
          </g>
        </g>
      )}
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
        {highlighted && (
          <rect
            width={w} height={d} rx={rx} fill="#1fd9c6" opacity={0.5}
            pointerEvents="none"
          />
        )}
      </g>
      {selected && onResizePointerDown && (
        <g transform={m}>
          {([
            ['left', { x: -HANDLE / 2, y: 0, width: HANDLE, height: d }],
            ['right', { x: w - HANDLE / 2, y: 0, width: HANDLE, height: d }],
            ['top', { x: 0, y: -HANDLE / 2, width: w, height: HANDLE }],
            ['bottom', { x: 0, y: d - HANDLE / 2, width: w, height: HANDLE }],
          ] as const).map(([side, props]) => (
            <rect key={side} {...props} fill="transparent"
              style={{ cursor: cursorForSide(side, view.mode) }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onResizePointerDown(e, el.id, side);
              }} />
          ))}
        </g>
      )}
      {el.label && <LabelView label={el.label} anchor={labelAnchor} align="center" />}
    </g>
  );
}

export type { ResizeSide as FloorResizeSide };
