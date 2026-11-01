import { hexToHsl } from '../../lib/color';
import { labelLines, labelWidth } from '../../lib/labelLayout';
import { labelPlaneMatrix } from '../../lib/projection';
import type { Point } from '../../lib/projection';
import type { Label } from '../../model/types';
import { useLabelTuningStore } from '../../store/labelTuningStore';

/** Renders a shape/floor label. `anchor` is a point in the enclosing group's
 * user space. `orientation` names the side used by edge-aligned tag pills. */
export function LabelView({
  label, anchor, align = 'side',
}: { label: Label; anchor: Point; align?: 'side' | 'edge' | 'center' }) {
  const tuning = useLabelTuningStore();
  const lines = labelLines(label.text, tuning.labelWrapAt);
  if (label.style === 'text') {
    return (
      <text x={anchor.x} y={anchor.y + tuning.textBaseline - (lines.length - 1) * tuning.labelLineHeight / 2} textAnchor="middle"
        fontSize={15} fontWeight={600} fill={label.color}>
        {lines.map((line, index) => (
          <tspan key={index} x={anchor.x} dy={index === 0 ? 0 : tuning.labelLineHeight}>{line}</tspan>
        ))}
      </text>
    );
  }
  const w = labelWidth(lines, tuning.tagInlinePadding);
  const h = lines.length > 1 ? tuning.tagTwoLineHeight : tuning.tagOneLineHeight;
  const outerH = h + tuning.tagOutlineWidth * 2;
  const dark = hexToHsl(label.color).l <= 0.7;
  const dir = label.orientation === 'right' ? 1 : -1;
  const axis = label.orientation === 'left' ? 'right' : 'left'; // labelPlaneMatrix's text-tilt axis
  // Asset artwork has 50px isometric base edges. An edge-aligned label sits
  // at that edge's midpoint, independently of the label's own width.
  const shift = align === 'center' ? 0 : align === 'edge' ? tuning.assetEdgeOffset * dir : (w / 2 + 10) * dir;
  const away = align === 'center' ? { x: 0, y: 0 } : { x: tuning.assetAwayX * dir, y: tuning.assetAwayY };
  return (
    <g transform={`translate(${away.x} ${away.y})`}
      style={{ filter: 'drop-shadow(0 2px 3px rgba(29, 36, 51, 0.28))' }}>
      <g transform={labelPlaneMatrix(anchor, axis)}>
        <g transform={`translate(${shift} 0)`}>
          <rect x={-w / 2 - tuning.tagOutlineWidth} y={-outerH / 2}
            width={w + tuning.tagOutlineWidth * 2} height={outerH} rx={outerH / 2} fill="#ffffff" />
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={label.color} />
          <text y={tuning.tagTextBaseline - (lines.length - 1) * tuning.labelLineHeight / 2} textAnchor="middle" fontSize={13} fontWeight={700}
            fill={dark ? '#ffffff' : '#2a3242'}>
            {lines.map((line, index) => (
              <tspan key={index} x={0} dy={index === 0 ? 0 : tuning.labelLineHeight}>{line}</tspan>
            ))}
          </text>
        </g>
      </g>
    </g>
  );
}
