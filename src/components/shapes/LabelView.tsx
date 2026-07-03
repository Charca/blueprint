import { hexToHsl } from '../../lib/color';
import { labelPlaneMatrix } from '../../lib/projection';
import type { Point } from '../../lib/projection';
import type { Label } from '../../model/types';

/** Renders a shape/floor label. `anchor` is a point in the enclosing group's
 * user space; the pill/text is centered on it. `orientation` names the side the
 * tag pill sits on (only relevant for `style === 'tag'`). */
export function LabelView({ label, anchor }: { label: Label; anchor: Point }) {
  if (label.style === 'text') {
    return (
      <text x={anchor.x} y={anchor.y + 5} textAnchor="middle"
        fontSize={15} fontWeight={600} fill={label.color}>
        {label.text}
      </text>
    );
  }
  const w = label.text.length * 8 + 28;
  const dark = hexToHsl(label.color).l <= 0.7;
  const dir = label.orientation === 'right' ? 1 : -1;
  const axis = label.orientation === 'left' ? 'right' : 'left'; // labelPlaneMatrix's text-tilt axis
  const shift = (w / 2 + 10) * dir;
  const away = { x: 5 * dir, y: 8.7 };
  return (
    <g transform={`translate(${away.x} ${away.y})`}
      style={{ filter: 'drop-shadow(0 2px 3px rgba(29, 36, 51, 0.28))' }}>
      <g transform={labelPlaneMatrix(anchor, axis)}>
        <g transform={`translate(${shift} 0)`}>
          <rect x={-w / 2 - 3} y={-17} width={w + 6} height={34} rx={17} fill="#ffffff" />
          <rect x={-w / 2} y={-14} width={w} height={28} rx={14} fill={label.color} />
          <text y={4.5} textAnchor="middle" fontSize={13} fontWeight={700}
            fill={dark ? '#ffffff' : '#2a3242'}>
            {label.text}
          </text>
        </g>
      </g>
    </g>
  );
}
