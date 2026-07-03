import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { createDoc, deleteDoc, listDocs, renameDoc } from '../storage/local';
import { useAppStore } from '../store/appStore';

export function Home() {
  const [docs, setDocs] = useState(() => listDocs());
  const openDoc = useAppStore((s) => s.openDoc);

  const refresh = () => setDocs(listDocs());

  return (
    <div className="bp-home">
      <header className="bp-home-header">
        <h1>Blueprint</h1>
        <button
          className="bp-btn bp-btn-primary"
          onClick={() => openDoc(createDoc().id)}
        >
          <Plus size={16} /> New canvas
        </button>
      </header>
      {docs.length === 0 ? (
        <p className="bp-empty">No canvases yet. Create one to get started.</p>
      ) : (
        <div className="bp-cards">
          {docs.map((m) => (
            <div key={m.id} className="bp-card" onClick={() => openDoc(m.id)}>
              <div className="bp-card-name">{m.name}</div>
              <div className="bp-card-date">
                {new Date(m.updatedAt).toLocaleString()}
              </div>
              <div className="bp-card-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="bp-icon-btn"
                  title="Rename"
                  onClick={() => {
                    const name = window.prompt('Canvas name', m.name);
                    if (name) { renameDoc(m.id, name); refresh(); }
                  }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="bp-icon-btn"
                  title="Delete"
                  onClick={() => {
                    if (window.confirm(`Delete "${m.name}"?`)) { deleteDoc(m.id); refresh(); }
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
