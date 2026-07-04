import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { unproject } from '../lib/projection';
import type { Point } from '../lib/projection';
import { uid } from '../lib/ids';
import {
  addElement, addElementWithFloorMembership, createFromPlacing, deleteElements, duplicateElements,
  moveElements, setLabel, updateElement,
} from '../model/ops';
import { useDocStore } from '../store/docStore';
import { Grid } from './Grid';
import { LabelEditor } from './LabelEditor';
import { Scene } from './Scene';

interface PanDrag { kind: 'pan'; sx: number; sy: number; cx: number; cy: number }
interface MoveDrag { kind: 'move'; last: Point; ids: string[]; moved: boolean }
type Drag = PanDrag | MoveDrag;

export function CanvasView() {
  const doc = useDocStore((s) => s.doc);
  const selection = useDocStore((s) => s.selection);
  const placing = useDocStore((s) => s.placing);
  const connectFrom = useDocStore((s) => s.connectFrom);
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hoverCell, setHoverCell] = useState<Point | null>(null);
  const [labelEditId, setLabelEditId] = useState<string | null>(null);

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

  useLayoutEffect(() => {
    if (!doc || doc.elements.length > 0 || doc.camera.x !== 0 || doc.camera.y !== 0 || doc.camera.zoom !== 1) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    useDocStore.getState().setCamera({ x: rect.width / 2, y: rect.height / 2, zoom: 1 });
  }, [doc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      const s = useDocStore.getState();
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo(); else s.undo();
      } else if (meta && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (s.selection.length) {
          let created: string[] = [];
          s.apply((els) => {
            const r = duplicateElements(els, s.selection);
            created = r.newIds;
            return r.elements;
          });
          s.select(created);
        }
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (s.selection.length) {
          e.preventDefault();
          s.apply((els) => deleteElements(els, s.selection));
          s.select([]);
        }
      } else if (e.key === 'Escape') {
        s.setPlacing(null);
        s.setTool('select');
        s.select([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!doc) return null;

  const onElementPointerDown = (e: React.PointerEvent, id: string) => {
    const s = useDocStore.getState();
    e.stopPropagation();
    // Capture on the element itself, NOT the svg: pointer capture retargets
    // the compatibility mouse events (click/dblclick) to the capture target,
    // so capturing on the svg suppresses element double-clicks entirely.
    // Moves/ups still bubble up to the svg's handlers.
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (s.placing) {
      const cell = cellAt(e);
      s.apply((els) => addElementWithFloorMembership(els, createFromPlacing(s.placing!, cell)));
      if (!e.shiftKey) s.setPlacing(null);
      return;
    }
    const el = doc.elements.find((x) => x.id === id);
    if (!el) return;
    if (s.tool === 'connect') {
      const target = doc.elements.find((x) => x.id === id);
      if (!target || target.kind === 'connector') return;
      if (!s.connectFrom) {
        s.setConnectFrom(id);
      } else if (s.connectFrom !== id) {
        const fromId = s.connectFrom;
        s.apply((els) => addElement(els, {
          kind: 'connector', id: uid(), fromId, toId: id, style: 'solid', color: '#425066',
        }));
        s.setConnectFrom(null);
        s.setTool('select');
      }
      return;
    }
    const next = e.shiftKey
      ? selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id]
      : selection.includes(id) ? selection : [id];
    s.select(next);
    if (el.kind !== 'connector') {
      s.beginTransient();
      setDrag({ kind: 'move', last: cellAt(e), ids: next.length ? next : [id], moved: false });
    }
  };

  const onElementDoubleClick = (id: string) => {
    const s = useDocStore.getState();
    const el = doc.elements.find((x) => x.id === id);
    if (!el) return;
    if (el.kind === 'asset' || el.kind === 'floor') {
      setLabelEditId(id);
      return;
    }
    if (el.kind === 'connector') {
      const label = window.prompt('Connector label (empty to remove)', el.label ?? '');
      if (label !== null) s.apply((els) => updateElement(els, id, { label: label || undefined }));
    }
    if (el.kind === 'tag') {
      const text = window.prompt('Tag text', el.text);
      if (text) s.apply((els) => updateElement(els, id, { text }));
    }
    if (el.kind === 'text') {
      if (el.variant === 'callout') {
        const title = window.prompt('Title (empty to remove)', el.title ?? '');
        if (title === null) return;
        const content = window.prompt('Body', el.content);
        if (content === null) return;
        s.apply((els) => updateElement(els, id, { title: title || undefined, content }));
      } else {
        const content = window.prompt('Text', el.content);
        if (content) s.apply((els) => updateElement(els, id, { content }));
      }
    }
  };

  return (
    <svg
      ref={svgRef}
      className="bp-canvas"
      onPointerDown={(e) => {
        const s = useDocStore.getState();
        (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
        if (placing) {
          const cell = cellAt(e);
          s.apply((els) => addElementWithFloorMembership(els, createFromPlacing(placing, cell)));
          if (!e.shiftKey) s.setPlacing(null);
          return;
        }
        s.select([]);
        setDrag({ kind: 'pan', sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y });
      }}
      onPointerMove={(e) => {
        const s = useDocStore.getState();
        if (placing) { setHoverCell(cellAt(e)); return; }
        if (!drag) return;
        if (drag.kind === 'pan') {
          s.setCamera({ ...cam, x: drag.cx + e.clientX - drag.sx, y: drag.cy + e.clientY - drag.sy });
        } else {
          const c = cellAt(e);
          if (c.x !== drag.last.x || c.y !== drag.last.y) {
            s.applyTransient((els) => moveElements(els, drag.ids, c.x - drag.last.x, c.y - drag.last.y));
            setDrag({ ...drag, last: c, moved: true });
          }
        }
      }}
      onPointerUp={() => {
        const s = useDocStore.getState();
        if (drag?.kind === 'move') s.commitTransient();
        setDrag(null);
      }}
    >
      <g transform={`translate(${cam.x} ${cam.y}) scale(${cam.zoom})`}>
        <Grid view={doc.view} />
        <Scene
          elements={doc.elements}
          view={doc.view}
          selection={new Set(connectFrom ? [...selection, connectFrom] : selection)}
          onElementPointerDown={onElementPointerDown}
          onElementDoubleClick={onElementDoubleClick}
          ghost={placing && hoverCell ? (
            <g opacity={0.5} style={{ pointerEvents: 'none' }}>
              <Scene elements={[createFromPlacing(placing, hoverCell)]} view={doc.view} />
            </g>
          ) : null}
        />
        {(() => {
          const editing = labelEditId ? doc.elements.find((x) => x.id === labelEditId) : null;
          if (!editing || (editing.kind !== 'asset' && editing.kind !== 'floor')) return null;
          return (
            <LabelEditor
              el={editing}
              view={doc.view}
              onCommit={(text) => {
                useDocStore.getState().apply((els) => setLabel(els, editing.id, text));
                setLabelEditId(null);
              }}
              onCancel={() => setLabelEditId(null)}
            />
          );
        })()}
      </g>
    </svg>
  );
}
