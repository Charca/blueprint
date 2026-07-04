import { renderToStaticMarkup } from 'react-dom/server';
import { project } from '../lib/projection';
import type { ViewState } from '../lib/projection';
import { anchorOfElement, floorBounds } from '../model/ops';
import type { Doc, Element } from '../model/types';
import { Scene } from '../components/Scene';
import { wrapText } from '../lib/wrap';

const PAD = 80;
const FLOOR_LABEL_GAP = 42;

export interface Bounds { minX: number; minY: number; width: number; height: number }

export function contentBounds(elements: Element[], view: ViewState): Bounds {
  const pts: { x: number; y: number }[] = [];
  for (const el of elements) {
    if (el.kind === 'floor') {
      const bounds = floorBounds(elements, el);
      for (const [dx, dy] of [[-0.5, -0.5], [bounds.width - 0.5, -0.5], [-0.5, bounds.depth - 0.5], [bounds.width - 0.5, bounds.depth - 0.5]]) {
        pts.push(project({ x: bounds.gridX + dx, y: bounds.gridY + dy }, view));
      }
      if (el.label) {
        const floorCenter = project({
          x: bounds.gridX + (bounds.width - 1) / 2,
          y: bounds.gridY + (bounds.depth - 1) / 2,
        }, view);
        const side = el.label.orientation === 'right'
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
        const c = {
          x: sideCenter.x + (outward.x / outwardLen) * FLOOR_LABEL_GAP,
          y: sideCenter.y + (view.mode === 'iso' ? 6 : 0) + (outward.y / outwardLen) * FLOOR_LABEL_GAP,
        };
        const halfW = (el.label.text.length * 8 + 28) / 2 + 12;
        pts.push({ x: c.x - halfW, y: c.y - 20 }, { x: c.x + halfW, y: c.y + 20 });
      }
    } else {
      const a = anchorOfElement(el, elements);
      if (!a) continue;
      const pt = project(a, view);
      pts.push(pt);
      if (el.kind === 'asset' && el.label) {
        const halfW = (el.label.text.length * 8 + 28) / 2 + 12;
        pts.push({ x: pt.x - halfW, y: pt.y }, { x: pt.x + halfW, y: pt.y + 74 });
      }
      if (el.kind === 'text') {
        const cardH = 20 + (el.title ? 24 : 0) + wrapText(el.content, 34).length * 18;
        pts.push({ x: pt.x - 130, y: pt.y }, { x: pt.x + 130, y: pt.y + cardH + 10 });
      }
    }
  }
  if (pts.length === 0) return { minX: -400, minY: -300, width: 800, height: 600 };
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs) - PAD, maxX = Math.max(...xs) + PAD;
  const minY = Math.min(...ys) - PAD - 40, maxY = Math.max(...ys) + PAD;
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

export function buildSvg(doc: Doc): string {
  const b = contentBounds(doc.elements, doc.view);
  const inner = renderToStaticMarkup(
    <Scene elements={doc.elements} view={doc.view} />,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.minX} ${b.minY} ${b.width} ${b.height}" width="${b.width}" height="${b.height}" font-family="system-ui, -apple-system, sans-serif">` +
    `<rect x="${b.minX}" y="${b.minY}" width="${b.width}" height="${b.height}" fill="#ffffff"/>` +
    inner +
    `</svg>`;
}
