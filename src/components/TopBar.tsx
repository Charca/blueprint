import { useRef, useState } from 'react';
import { FileCode2, FileDown, ImageDown, Menu, MoreVertical, Pencil, Plus, Redo2, Trash2, Undo2, Upload } from 'lucide-react';
import { buildSvg } from '../export/svg';
import { download, svgToPngBlob } from '../export/png';
import { BlueprintImportError, parseBlueprint, serializeBlueprint } from '../importExport/blueprint';
import { createDoc, deleteDoc, latestOpenedDocId, listDocs, renameDoc, saveDoc } from '../storage/local';
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
  const closeDoc = useDocStore((s) => s.closeDoc);
  const openDoc = useAppStore((s) => s.openDoc);
  const [menuOpen, setMenuOpen] = useState(false);
  const [docs, setDocs] = useState(() => listDocs());
  const [importError, setImportError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  if (!doc) return null;

  const refresh = () => setDocs(listDocs());
  const openCanvas = (id: string) => {
    setMenuOpen(false);
    openDoc(id);
  };
  const createCanvas = () => {
    openCanvas(createDoc().id);
  };
  const deleteCanvas = (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    deleteDoc(id);
    if (id === doc.id) {
      closeDoc(false);
      openDoc(latestOpenedDocId() ?? createDoc().id);
      setMenuOpen(false);
      return;
    }
    refresh();
  };
  const shownDocs = docs.map((meta) => meta.id === doc.id ? { ...meta, name: doc.name } : meta);

  return (
    <div className="bp-topbar">
      <div className="bp-menu-wrap">
        <button
          className="bp-icon-btn"
          title="Canvas menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => { refresh(); setMenuOpen((open) => !open); }}
        >
          <Menu size={16} />
        </button>
        {menuOpen && (
          <div className="bp-canvas-menu" role="menu">
            <button className="bp-menu-item" role="menuitem" onClick={createCanvas}><Plus size={15} /> New Canvas</button>
            <button className="bp-menu-item" role="menuitem" onClick={() => inputRef.current?.click()}><Upload size={15} /> Import JSON</button>
            {importError && <p className="bp-menu-error" role="alert">{importError}</p>}
            <div className="bp-menu-separator" />
            <div className="bp-menu-docs">
              {shownDocs.map((meta) => (
                <button
                  key={meta.id}
                  className={`bp-menu-doc ${meta.id === doc.id ? 'bp-active' : ''}`}
                  role="menuitem"
                  onClick={() => openCanvas(meta.id)}
                >
                  <span className="bp-menu-doc-name">{meta.name}</span>
                  <span className="bp-menu-doc-actions" onClick={(event) => event.stopPropagation()}>
                    <span className="bp-kebab"><MoreVertical size={15} /></span>
                    <span className="bp-doc-action-menu">
                      <span
                        className="bp-doc-action"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          const name = window.prompt('Canvas name', meta.name);
                          if (name) { renameDoc(meta.id, name); refresh(); }
                        }}
                      ><Pencil size={13} /> Rename</span>
                      <span
                        className="bp-doc-action bp-danger"
                        role="button"
                        tabIndex={0}
                        onClick={() => deleteCanvas(meta.id, meta.name)}
                      ><Trash2 size={13} /> Delete</span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".json,.blueprint.json,application/json"
          hidden
          onChange={async (event) => {
            setImportError(null);
            const file = event.target.files?.[0];
            event.currentTarget.value = '';
            if (!file) return;
            try {
              const imported = parseBlueprint(await file.text());
              if (!saveDoc(imported)) {
                setImportError('Could not save the imported canvas.');
                return;
              }
              setImportError(null);
              setMenuOpen(false);
              openDoc(imported.id);
            } catch (error) {
              setImportError(error instanceof BlueprintImportError ? error.message : 'Could not read this file.');
            }
          }}
        />
      </div>
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
