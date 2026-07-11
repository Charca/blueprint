import { ArrowLeft, FileCode2, FileDown, ImageDown, Redo2, Undo2 } from 'lucide-react';
import { buildSvg } from '../export/svg';
import { download, svgToPngBlob } from '../export/png';
import { serializeBlueprint } from '../importExport/blueprint';
import { useAppStore } from '../store/appStore';
import { useDocStore } from '../store/docStore';

function jsonFilename(name: string): string {
  return name.trim().replace(/[\u0000-\u001f\u007f-\u009f\\/:*?"<>|]+/g, '_').trim() || 'Untitled';
}

export function TopBar() {
  const doc = useDocStore((s) => s.doc);
  const setName = useDocStore((s) => s.setName);
  const undo = useDocStore((s) => s.undo);
  const redo = useDocStore((s) => s.redo);
  const goHome = useAppStore((s) => s.goHome);
  if (!doc) return null;

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
        className="bp-icon-btn"
        title="Export JSON"
        onClick={() => download(
          `${jsonFilename(doc.name)}.blueprint.json`,
          new Blob([serializeBlueprint(doc)], { type: 'application/json' }),
        )}
      >
        <FileDown size={16} />
      </button>
      <button className="bp-icon-btn" title="Export SVG"
        onClick={() => download(`${doc.name}.svg`, new Blob([buildSvg(doc)], { type: 'image/svg+xml' }))}>
        <FileCode2 size={16} />
      </button>
      <button className="bp-icon-btn" title="Export PNG"
        onClick={() => {
          svgToPngBlob(buildSvg(doc))
            .then((b) => download(`${doc.name}.png`, b))
            .catch((err) => {
              console.error('Blueprint: PNG export failed', err);
              window.alert('PNG export failed.');
            });
        }}>
        <ImageDown size={16} />
      </button>
    </div>
  );
}
