import { useEffect, useRef, useState } from 'react';
import { unproject } from '../lib/projection';
import type { Point } from '../lib/projection';
import { useDocStore } from '../store/docStore';
import { Grid } from './Grid';
import { Scene } from './Scene';

interface PanDrag { kind: 'pan'; sx: number; sy: number; cx: number; cy: number }
type Drag = PanDrag;

export function CanvasView() {
  const doc = useDocStore((s) => s.doc);
  const selection = useDocStore((s) => s.selection);
  const setCamera = useDocStore((s) => s.setCamera);
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const cam = doc?.camera ?? { x: 0, y: 0, zoom: 1 };

  const toWorld = (e: { clientX: number; clientY: number }): Point => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left - cam.x) / cam.zoom, y: (e.clientY - r.top - cam.y) / cam.zoom };
  };
  const cellAt = (e: { clientX: number; clientY: number }): Point => {
    const g = unproject(toWorld(e), doc!.view);
    return { x: Math.round(g.x), y: Math.round(g.y) };
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = useDocStore.getState();
      const d = s.doc;
      if (!d) return;
      const c = d.camera;
      if (e.ctrlKey || e.metaKey) {
        const r = svg.getBoundingClientRect();
        const px = e.clientX - r.left, py = e.clientY - r.top;
        const zoom = Math.min(4, Math.max(0.2, c.zoom * Math.exp(-e.deltaY * 0.002)));
        const k = zoom / c.zoom;
        s.setCamera({ x: px - (px - c.x) * k, y: py - (py - c.y) * k, zoom });
      } else {
        s.setCamera({ ...c, x: c.x - e.deltaX, y: c.y - e.deltaY });
      }
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  if (!doc) return null;

  void cellAt;

  return (
    <svg
      ref={svgRef}
      className="bp-canvas"
      onPointerDown={(e) => {
        (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
        setDrag({ kind: 'pan', sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y });
      }}
      onPointerMove={(e) => {
        if (drag?.kind === 'pan') {
          setCamera({ ...cam, x: drag.cx + e.clientX - drag.sx, y: drag.cy + e.clientY - drag.sy });
        }
      }}
      onPointerUp={() => setDrag(null)}
    >
      <g transform={`translate(${cam.x} ${cam.y}) scale(${cam.zoom})`}>
        <Grid view={doc.view} />
        <Scene elements={doc.elements} view={doc.view} selection={new Set(selection)} />
      </g>
    </svg>
  );
}
