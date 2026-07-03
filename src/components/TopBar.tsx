import { ArrowLeft, Redo2, RotateCcw, RotateCw, Spline, Undo2 } from 'lucide-react';
import type { Rotation } from '../lib/projection';
import { useAppStore } from '../store/appStore';
import { useDocStore } from '../store/docStore';

export function TopBar() {
  const doc = useDocStore((s) => s.doc);
  const setName = useDocStore((s) => s.setName);
  const setView = useDocStore((s) => s.setView);
  const undo = useDocStore((s) => s.undo);
  const redo = useDocStore((s) => s.redo);
  const tool = useDocStore((s) => s.tool);
  const setTool = useDocStore((s) => s.setTool);
  const goHome = useAppStore((s) => s.goHome);
  if (!doc) return null;
  const { view } = doc;
  const rotate = (steps: number) =>
    setView({ ...view, rotation: (((view.rotation + steps) % 4) + 4) % 4 as Rotation });

  return (
    <div className="bp-topbar">
      <button className="bp-icon-btn" title="All canvases" onClick={goHome}>
        <ArrowLeft size={16} />
      </button>
      <input
        className="bp-name"
        value={doc.name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="bp-topbar-spacer" />
      <button className="bp-icon-btn" title="Undo (⌘Z)" onClick={undo}><Undo2 size={16} /></button>
      <button className="bp-icon-btn" title="Redo (⇧⌘Z)" onClick={redo}><Redo2 size={16} /></button>
      <button
        className={`bp-icon-btn${tool === 'connect' ? ' bp-tool-active' : ''}`}
        title="Connect elements"
        onClick={() => setTool(tool === 'connect' ? 'select' : 'connect')}
      >
        <Spline size={16} />
      </button>
      <div className="bp-divider" />
      <button className="bp-icon-btn" title="Rotate left" onClick={() => rotate(-1)}>
        <RotateCcw size={16} />
      </button>
      <button className="bp-icon-btn" title="Rotate right" onClick={() => rotate(1)}>
        <RotateCw size={16} />
      </button>
      <div className="bp-seg">
        <button
          className={view.mode === 'iso' ? 'bp-seg-active' : ''}
          onClick={() => setView({ ...view, mode: 'iso' })}
        >Iso</button>
        <button
          className={view.mode === 'top' ? 'bp-seg-active' : ''}
          onClick={() => setView({ ...view, mode: 'top' })}
        >Top</button>
      </div>
    </div>
  );
}
