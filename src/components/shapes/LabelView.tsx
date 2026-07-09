import { hexToHsl } from '../../lib/color';
import { labelPlaneMatrix } from '../../lib/projection';
import type { Point } from '../../lib/projection';
import { wrapText } from '../../lib/wrap';
import type { Label } from '../../model/types';

const TAG_MAX_CHARS = 22;
const TEXT_MAX_CHARS = 24;
const TAG_CHAR_WIDTH = 8;
const TAG_HORIZONTAL_PADDING = 14;
const TAG_LINE_HEIGHT = 16;
const TAG_VERTICAL_PADDING = 6;
const TEXT_LINE_HEIGHT = 18;

function renderedLines(text: string, maxChars: number): string[] {
  const lines = wrapText(text, maxChars, 2, true);
  return lines.length ? lines : [''];
}

/** Renders a shape/floor label. `anchor` is a point in the enclosing group's
 * user space; the pill/text is centered on it. `orientation` names the side the
 * tag pill sits on (only relevant for `style === 'tag'`). */
export function LabelView({
  label, anchor, align = 'side',
}: { label: Label; anchor: Point; align?: 'side' | 'center' }) {
  if (label.style === 'text') {
    const lines = renderedLines(label.text, TEXT_MAX_CHARS);
    const firstY = anchor.y + 5 - ((lines.length - 1) * TEXT_LINE_HEIGHT) / 2;
    return (
      <text x={anchor.x} y={firstY} textAnchor="middle"
        fontSize={15} fontWeight={600} fill={label.color}>
        {lines.map((line, index) => (
          <tspan key={index} x={anchor.x} dy={index === 0 ? 0 : TEXT_LINE_HEIGHT}>{line}</tspan>
        ))}
      </text>
    );
  }

  const lines = renderedLines(label.text, TAG_MAX_CHARS);
  const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const w = longestLine * TAG_CHAR_WIDTH + TAG_HORIZONTAL_PADDING * 2;
  const h = lines.length * TAG_LINE_HEIGHT + TAG_VERTICAL_PADDING * 2;
  const dark = hexToHsl(label.color).l <= 0.7;
  const dir = label.orientation === 'right' ? 1 : -1;
  const axis = label.orientation === 'left' ? 'right' : 'left'; // labelPlaneMatrix's text-tilt axis
  const shift = align === 'center' ? 0 : (w / 2 + 10) * dir;
  const away = align === 'center' ? { x: 0, y: 0 } : { x: 5 * dir, y: 8.7 };
  const firstTextY = 4.5 - ((lines.length - 1) * TAG_LINE_HEIGHT) / 2;
  return (
    <g transform={`translate(${away.x} ${away.y})`}
      style={{ filter: 'drop-shadow(0 2px 3px rgba(29, 36, 51, 0.28))' }}>
      <g transform={labelPlaneMatrix(anchor, axis)}>
        <g transform={`translate(${shift} 0)`}>
          <rect x={-w / 2 - 3} y={-h / 2 - 3} width={w + 6} height={h + 6} rx={(h + 6) / 2} fill="#ffffff" />
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={label.color} />
          <text y={firstTextY} textAnchor="middle" fontSize={13} fontWeight={700}
            fill={dark ? '#ffffff' : '#2a3242'}>
            {lines.map((line, index) => (
              <tspan key={index} x={0} dy={index === 0 ? 0 : TAG_LINE_HEIGHT}>{line}</tspan>
            ))}
          </text>
        </g>
      </g>
    </g>
  );
}
