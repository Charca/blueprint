import { project } from '../lib/projection';
import type { ViewState } from '../lib/projection';

const R = 24;

export function Grid({ view }: { view: ViewState }) {
  const lines = [];
  for (let i = -R; i <= R; i++) {
    const b = i + 0.5;
    const p1 = project({ x: b, y: -R }, view);
    const p2 = project({ x: b, y: R }, view);
    const q1 = project({ x: -R, y: b }, view);
    const q2 = project({ x: R, y: b }, view);
    lines.push(
      <line key={`x${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />,
      <line key={`y${i}`} x1={q1.x} y1={q1.y} x2={q2.x} y2={q2.y} />,
    );
  }
  return <g stroke="#e8ecf4" strokeWidth={1}>{lines}</g>;
}
