import { memo } from 'react';
import type { PointerEvent } from 'react';
import { ASSETS } from '../../generated/assets';
import type { AssetDef } from '../../generated/assets';
import { instanceMarkup } from '../../lib/assetInstance';
import { hexToHsl } from '../../lib/color';
import { labelPlaneMatrix, project } from '../../lib/projection';
import type { ViewState } from '../../lib/projection';
import type { AssetEl, AssetLabel } from '../../model/types';

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

function AssetLabelView({ label }: { label: AssetLabel }) {
  if (label.style === 'text') {
    return (
      <text x={LABEL_ANCHOR.x} y={LABEL_ANCHOR.y + 5} textAnchor="middle"
        fontSize={15} fontWeight={600} fill={label.color}>
        {label.text}
      </text>
    );
  }
  const w = label.text.length * 8 + 28;
  const dark = hexToHsl(label.color).l <= 0.7;
  // Tuck the pill alongside the shape's near base edge: 'right' runs up-left
  // along the front-left edge, 'left' runs up-right along the front-right
  // edge, with the inner tip just below the base vertex (kit reference).
  const shift = (w / 2 + 10) * (label.orientation === 'right' ? -1 : 1);
  return (
    <g transform={labelPlaneMatrix(LABEL_ANCHOR, label.orientation)}>
      <g transform={`translate(${shift} 0)`}>
        <rect x={-w / 2} y={-14} width={w} height={28} rx={14} fill={label.color} />
        <text y={4.5} textAnchor="middle" fontSize={13} fontWeight={700}
          fill={dark ? '#ffffff' : '#2a3242'}>
          {label.text}
        </text>
      </g>
    </g>
  );
}

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
      {el.label && <AssetLabelView label={el.label} />}
      {selected && (
        <rect x={2} y={-4} width={116} height={124} rx={10}
          fill="none" stroke="#7C5CFF" strokeWidth={1.5} strokeDasharray="5 4" />
      )}
    </g>
  );
}
