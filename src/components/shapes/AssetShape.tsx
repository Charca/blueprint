import { memo } from 'react';
import type { PointerEvent } from 'react';
import { ASSETS } from '../../generated/assets';
import type { AssetDef } from '../../generated/assets';
import { instanceMarkup } from '../../lib/assetInstance';
import { project } from '../../lib/projection';
import type { ViewState } from '../../lib/projection';
import type { AssetEl } from '../../model/types';
import { LabelView } from './LabelView';

export interface ShapeProps<T> {
  el: T;
  view: ViewState;
  selected?: boolean;
  onPointerDown?: (e: PointerEvent, id: string) => void;
  onDoubleClick?: (id: string) => void;
}

const LABEL_ANCHOR = { x: 60, y: 129 }; // artwork coords: base vertex + 44px

// Memoized so re-renders (selection, drag) never re-commit the innerHTML:
// React 19 rewrites dangerouslySetInnerHTML on every commit even when the
// markup is identical, which discards the pressed DOM node mid-gesture and
// suppresses the browser's click/dblclick synthesis.
const ArtworkGlyph = memo(function ArtworkGlyph({
  def, instanceId, color,
}: { def: AssetDef; instanceId: string; color: string }) {
  return <g dangerouslySetInnerHTML={{ __html: instanceMarkup(def, instanceId, color) }} />;
});

export function AssetShape({ el, view, selected, onPointerDown, onDoubleClick }: ShapeProps<AssetEl>) {
  const def = ASSETS[el.assetId];
  if (!def) return null;
  const pt = project({ x: el.gridX, y: el.gridY }, view);
  return (
    <g
      transform={`translate(${pt.x - 60} ${pt.y - 85})`}
      onPointerDown={(e) => onPointerDown?.(e, el.id)}
      onDoubleClick={() => onDoubleClick?.(el.id)}
      style={onPointerDown ? { cursor: 'move' } : undefined}
    >
      <ArtworkGlyph def={def} instanceId={el.id} color={el.color} />
      {el.label && <LabelView label={el.label} anchor={LABEL_ANCHOR} />}
      {selected && (
        <rect x={2} y={-4} width={116} height={124} rx={10}
          fill="none" stroke="#7C5CFF" strokeWidth={1.5} strokeDasharray="5 4" />
      )}
    </g>
  );
}
