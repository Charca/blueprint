import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { project, unproject } from '../lib/projection';
import type { Point } from '../lib/projection';
import { edgePoint, elementAtProjectedPoint, projectedElementHull } from '../lib/connectorGeometry';
import { uid } from '../lib/ids';
import {
  anchorOfElement,
  addElement, addElementWithFloorMembership, createFromPlacing, deleteElements, duplicateElementsToRight,
  floorBounds, moveElements, setLabel, updateElement,
} from '../model/ops';
import type { Element as ModelElement, FloorEl } from '../model/types';
import type { FloorResizeSide } from './shapes/FloorShape';
import { useDocStore } from '../store/docStore';
import { Grid } from './Grid';
import { LabelEditor } from './LabelEditor';
import { Scene } from './Scene';

interface PanDrag { kind: 'pan'; sx: number; sy: number; cx: number; cy: number }
interface MoveDrag { kind: 'move'; last: Point; ids: string[]; moved: boolean }
interface ConnectDrag { kind: 'connect'; fromId: string; pointer: Point; targetId: string | null }
interface ResizeDrag { kind: 'resize-floor'; id: string; side: FloorResizeSide; start: Point; bounds: { gridX: number; gridY: number; width: number; depth: number } }
interface MarqueeDrag { kind: 'marquee'; start: Point; current: Point }
type Drag = PanDrag | MoveDrag | ConnectDrag | ResizeDrag | MarqueeDrag;
interface Clipboard { elements: ModelElement[]; ids: string[] }

const MIN_FLOOR_SIZE = 1;

function isFloorChild(el: ModelElement) {
  return el.kind === 'asset' || el.kind === 'tag' || el.kind === 'text';
}

function containsCell(bounds: { gridX: number; gridY: number; width: number; depth: number }, cell: Point): boolean {
  return cell.x >= bounds.gridX && cell.x < bounds.gridX + bounds.width &&
    cell.y >= bounds.gridY && cell.y < bounds.gridY + bounds.depth;
}

function floorDropTargetAtCell(els: ModelElement[], cell: Point, ignoreIds = new Set<string>()): string | null {
  const floors = els
    .filter((el): el is FloorEl => el.kind === 'floor' && !ignoreIds.has(el.id))
    .filter((floor) => containsCell(floorBounds(els, floor), cell))
    .sort((a, b) => {
      const ab = floorBounds(els, a);
      const bb = floorBounds(els, b);
      return ab.width * ab.depth - bb.width * bb.depth;
    });
  return floors[0]?.id ?? null;
}

function floorDropTargetForElements(els: ModelElement[], ids: string[]): string | null {
  const ignoreIds = new Set(ids);
  for (const id of ids) {
    const el = els.find((candidate) => candidate.id === id);
    if (el && isFloorChild(el)) {
      const targetId = floorDropTargetAtCell(els, { x: el.gridX, y: el.gridY }, ignoreIds);
      if (targetId) return targetId;
    }
  }
  return null;
}

function canPlaceOnFloor(placing: string | null): boolean {
  return !!placing && placing !== 'floor' && !placing.startsWith('connector');
}

function resizeFloorPatch(drag: ResizeDrag, pointer: Point): Partial<FloorEl> {
  const dx = Math.round(pointer.x - drag.start.x);
  const dy = Math.round(pointer.y - drag.start.y);
  const b = drag.bounds;
  if (drag.side === 'left') {
    const width = Math.max(MIN_FLOOR_SIZE, b.width - dx);
    return { sizeMode: 'manual', gridX: b.gridX + (b.width - width), gridY: b.gridY, width, depth: b.depth };
  }
  if (drag.side === 'right') {
    return { sizeMode: 'manual', gridX: b.gridX, gridY: b.gridY, width: Math.max(MIN_FLOOR_SIZE, b.width + dx), depth: b.depth };
  }
  if (drag.side === 'top') {
    const depth = Math.max(MIN_FLOOR_SIZE, b.depth - dy);
    return { sizeMode: 'manual', gridX: b.gridX, gridY: b.gridY + (b.depth - depth), width: b.width, depth };
  }
  return { sizeMode: 'manual', gridX: b.gridX, gridY: b.gridY, width: b.width, depth: Math.max(MIN_FLOOR_SIZE, b.depth + dy) };
}

function rectFromPoints(a: Point, b: Point) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

function hullIntersectsRect(hull: Point[] | null, rect: ReturnType<typeof rectFromPoints>): boolean {
  if (!hull || hull.length === 0) return false;
  const xs = hull.map((point) => point.x);
  const ys = hull.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return right >= rect.x && left <= rect.x + rect.width &&
    bottom >= rect.y && top <= rect.y + rect.height;
}

export function CanvasView() {
  const doc = useDocStore((s) => s.doc);
  const selection = useDocStore((s) => s.selection);
  const placing = useDocStore((s) => s.placing);
  const tool = useDocStore((s) => s.tool);
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hoverCell, setHoverCell] = useState<Point | null>(null);
  const [hoverTargetId, setHoverTargetId] = useState<string | null>(null);
  const [floorDropTargetId, setFloorDropTargetId] = useState<string | null>(null);
  const [labelEditId, setLabelEditId] = useState<string | null>(null);
  const [spacePan, setSpacePan] = useState(false);
  const clipboardRef = useRef<Clipboard>({ elements: [], ids: [] });

  const cam = doc?.camera ?? { x: 0, y: 0, zoom: 1 };
  const effectiveTool = spacePan ? 'pan' : tool;

  const toWorld = (e: { clientX: number; clientY: number }): Point => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left - cam.x) / cam.zoom, y: (e.clientY - r.top - cam.y) / cam.zoom };
  };
  const cellAt = (e: { clientX: number; clientY: number }): Point => {
    const g = unproject(toWorld(e), doc!.view);
    return { x: Math.round(g.x), y: Math.round(g.y) };
  };
  const targetAt = (e: { clientX: number; clientY: number }, ignoreId?: string): ModelElement | null =>
    elementAtProjectedPoint(doc!.elements, doc!.view, toWorld(e), ignoreId);

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
      if (e.code === 'Space') {
        e.preventDefault();
        setSpacePan(true);
        return;
      }
      const s = useDocStore.getState();
      const meta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (!meta && !e.altKey && !e.shiftKey && key === 'v') {
        e.preventDefault();
        s.setTool('select');
      } else if (!meta && !e.altKey && !e.shiftKey && key === 'h') {
        e.preventDefault();
        s.setTool('pan');
      } else if (!meta && !e.altKey && !e.shiftKey && key === 'a') {
        e.preventDefault();
        s.setTool('connect');
      } else if (meta && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo(); else s.undo();
      } else if (meta && key === 'c') {
        if (s.selection.length) {
          e.preventDefault();
          clipboardRef.current = {
            elements: s.doc?.elements ?? [],
            ids: [...s.selection],
          };
        }
      } else if (meta && key === 'v') {
        if (clipboardRef.current.ids.length) {
          e.preventDefault();
          const clipboard = clipboardRef.current;
          let created: string[] = [];
          s.apply((els) => {
            const r = duplicateElementsToRight(clipboard.elements, clipboard.ids);
            created = r.newIds;
            if (created.length === 0) return els;
            return [...els, ...r.elements.slice(clipboard.elements.length)];
          });
          if (created.length) {
            const pasted = useDocStore.getState().doc?.elements.filter((el) => created.includes(el.id)) ?? [];
            clipboardRef.current = { elements: pasted, ids: created };
            s.select(created);
          }
        }
      } else if (meta && key === 'd') {
        e.preventDefault();
        if (s.selection.length) {
          let created: string[] = [];
          s.apply((els) => {
            const r = duplicateElementsToRight(els, s.selection);
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
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePan(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
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
    if (spacePan) {
      setDrag({ kind: 'pan', sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y });
      return;
    }
    if (s.placing) {
      const cell = cellAt(e);
      const created = createFromPlacing(s.placing, cell);
      s.apply((els) => addElementWithFloorMembership(els, created));
      s.select([created.id]);
      setFloorDropTargetId(null);
      if (!e.shiftKey) s.setPlacing(null);
      return;
    }
    const el = doc.elements.find((x) => x.id === id);
    if (!el) return;
    if (s.tool === 'pan') {
      setDrag({ kind: 'pan', sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y });
      return;
    }
    if (s.tool === 'connect') {
      if (el.kind === 'connector') return;
      setDrag({ kind: 'connect', fromId: id, pointer: toWorld(e), targetId: null });
      setHoverTargetId(id);
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

  const onFloorResizePointerDown = (e: React.PointerEvent, id: string, side: FloorResizeSide) => {
    const s = useDocStore.getState();
    const floor = doc.elements.find((x): x is FloorEl => x.kind === 'floor' && x.id === id);
    if (!floor) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    s.select([id]);
    s.beginTransient();
    const bounds = floorBounds(doc.elements, floor);
    setDrag({ kind: 'resize-floor', id, side, start: unproject(toWorld(e), doc.view), bounds });
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
      className={`bp-canvas bp-tool-${effectiveTool}${drag?.kind === 'pan' ? ' bp-is-panning' : ''}`}
      onPointerDown={(e) => {
        const s = useDocStore.getState();
        (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
        if (spacePan) {
          setDrag({ kind: 'pan', sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y });
          return;
        }
        if (placing) {
          const cell = cellAt(e);
          const created = createFromPlacing(placing, cell);
          s.apply((els) => addElementWithFloorMembership(els, created));
          s.select([created.id]);
          setFloorDropTargetId(null);
          if (!e.shiftKey) s.setPlacing(null);
          return;
        }
        if (s.tool === 'pan') {
          setDrag({ kind: 'pan', sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y });
          return;
        }
        s.select([]);
        if (s.tool === 'select') {
          const point = toWorld(e);
          setDrag({ kind: 'marquee', start: point, current: point });
        }
      }}
      onPointerMove={(e) => {
        const s = useDocStore.getState();
        if (placing) {
          const cell = cellAt(e);
          setHoverCell(cell);
          setFloorDropTargetId(canPlaceOnFloor(placing) ? floorDropTargetAtCell(doc.elements, cell) : null);
          return;
        }
        if (!spacePan && s.tool === 'connect') {
          setFloorDropTargetId(null);
          const ignoreId = drag?.kind === 'connect' ? drag.fromId : undefined;
          const target = targetAt(e, ignoreId);
          const targetId = target?.id ?? null;
          setHoverTargetId(targetId ?? (drag?.kind === 'connect' ? drag.fromId : null));
          if (drag?.kind === 'connect') {
            setDrag({ ...drag, pointer: toWorld(e), targetId });
          }
          return;
        }
        if (!drag) return;
        if (drag.kind === 'pan') {
          s.setCamera({ ...cam, x: drag.cx + e.clientX - drag.sx, y: drag.cy + e.clientY - drag.sy });
        } else if (drag.kind === 'move') {
          const c = cellAt(e);
          const currentElements = s.doc?.elements ?? doc.elements;
          if (c.x !== drag.last.x || c.y !== drag.last.y) {
            const nextElements = moveElements(currentElements, drag.ids, c.x - drag.last.x, c.y - drag.last.y);
            s.applyTransient(() => nextElements);
            setFloorDropTargetId(floorDropTargetForElements(nextElements, drag.ids));
            setDrag({ ...drag, last: c, moved: true });
          } else {
            setFloorDropTargetId(floorDropTargetForElements(currentElements, drag.ids));
          }
        } else if (drag.kind === 'resize-floor') {
          const pointer = unproject(toWorld(e), doc.view);
          s.applyTransient((els) => els.map((el) => (
            el.id === drag.id && el.kind === 'floor'
              ? { ...el, ...resizeFloorPatch(drag, pointer) }
              : el
          )));
        } else if (drag.kind === 'marquee') {
          setDrag({ ...drag, current: toWorld(e) });
        }
      }}
      onPointerUp={() => {
        const s = useDocStore.getState();
        if (drag?.kind === 'move' || drag?.kind === 'resize-floor') s.commitTransient();
        if (drag?.kind === 'marquee') {
          const rect = rectFromPoints(drag.start, drag.current);
          if (rect.width >= 4 || rect.height >= 4) {
            const selected = doc.elements
              .filter((el) => el.kind !== 'connector')
              .filter((el) => hullIntersectsRect(projectedElementHull(el, doc.elements, doc.view), rect))
              .map((el) => el.id);
            s.select(selected);
          }
        }
        if (drag?.kind === 'connect' && drag.targetId && drag.targetId !== drag.fromId) {
          const fromId = drag.fromId;
          const toId = drag.targetId;
          s.apply((els) => addElement(els, {
            kind: 'connector', id: uid(), fromId, toId, style: 'solid', color: '#425066',
          }));
        }
        setDrag(null);
        setFloorDropTargetId(null);
      }}
      onPointerLeave={() => {
        if (!drag) {
          setHoverTargetId(null);
          setFloorDropTargetId(null);
        }
      }}
    >
      <g transform={`translate(${cam.x} ${cam.y}) scale(${cam.zoom})`}>
        <Grid view={doc.view} />
        <Scene
          elements={doc.elements}
          view={doc.view}
          selection={new Set(hoverTargetId ? [...selection, hoverTargetId] : selection)}
          highlightedFloorId={floorDropTargetId}
          onElementPointerDown={onElementPointerDown}
          onFloorResizePointerDown={onFloorResizePointerDown}
          onElementDoubleClick={onElementDoubleClick}
          ghost={placing && hoverCell ? (
            <g opacity={0.5} style={{ pointerEvents: 'none' }}>
              <Scene elements={[createFromPlacing(placing, hoverCell)]} view={doc.view} />
            </g>
          ) : null}
        />
        {drag?.kind === 'connect' && (
          <ConnectorPreview
            fromId={drag.fromId}
            targetId={drag.targetId}
            pointer={drag.pointer}
            elements={doc.elements}
            view={doc.view}
          />
        )}
        {drag?.kind === 'marquee' && (() => {
          const rect = rectFromPoints(drag.start, drag.current);
          return (
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              fill="#7C5CFF"
              fillOpacity={0.08}
              stroke="#7C5CFF"
              strokeWidth={1.5 / cam.zoom}
              strokeDasharray={`${5 / cam.zoom} ${4 / cam.zoom}`}
              pointerEvents="none"
            />
          );
        })()}
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

function ConnectorPreview({
  fromId, targetId, pointer, elements, view,
}: {
  fromId: string;
  targetId: string | null;
  pointer: Point;
  elements: ModelElement[];
  view: NonNullable<ReturnType<typeof useDocStore.getState>['doc']>['view'];
}) {
  const from = elements.find((el) => el.id === fromId);
  const to = targetId ? elements.find((el) => el.id === targetId) : null;
  if (!from) return null;
  const fa = anchorOfElement(from, elements);
  if (!fa) return null;
  const fromCenter = project(fa, view);
  const toAnchor = to ? anchorOfElement(to, elements) : null;
  const toPoint = to && toAnchor ? project(toAnchor, view) : pointer;
  const start = edgePoint(fromCenter, toPoint, projectedElementHull(from, elements, view));
  const end = to && toAnchor
    ? edgePoint(toPoint, fromCenter, projectedElementHull(to, elements, view))
    : toPoint;
  return (
    <g pointerEvents="none">
      <defs>
        <marker id="arrow-preview" viewBox="0 0 10 10" refX="8" refY="5"
          markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="#425066" />
        </marker>
      </defs>
      <line x1={start.x} y1={start.y} x2={end.x} y2={end.y}
        stroke="#425066" strokeWidth={3} strokeLinecap="round"
        markerEnd="url(#arrow-preview)" opacity={0.78} />
    </g>
  );
}
