import type { PointerEvent } from 'react';
import { ASSETS } from '../../generated/assets';
import { instanceMarkup } from '../../lib/assetInstance';
import { project } from '../../lib/projection';
import type { ViewState } from '../../lib/projection';
import type { AssetEl } from '../../model/types';
import { TopTile } from './TopTile';

export interface ShapeProps<T> {
  el: T;
  view: ViewState;
  selected?: boolean;
  onPointerDown?: (e: PointerEvent, id: string) => void;
  onDoubleClick?: (id: string) => void;
}

export function AssetShape({ el, view, selected, onPointerDown }: ShapeProps<AssetEl>) {
  const def = ASSETS[el.assetId];
  if (!def) return null;
  if (view.mode === 'top') {
    return <TopTile el={el} view={view} selected={selected} onPointerDown={onPointerDown} />;
  }
  const pt = project({ x: el.gridX, y: el.gridY }, view);
  return (
    <g
      transform={`translate(${pt.x - 60} ${pt.y - 85})`}
      onPointerDown={(e) => onPointerDown?.(e, el.id)}
      style={onPointerDown ? { cursor: 'move' } : undefined}
    >
      <g dangerouslySetInnerHTML={{ __html: instanceMarkup(def, el.id, el.color) }} />
      {selected && (
        <rect x={2} y={-4} width={116} height={124} rx={10}
          fill="none" stroke="#7C5CFF" strokeWidth={1.5} strokeDasharray="5 4" />
      )}
    </g>
  );
}
