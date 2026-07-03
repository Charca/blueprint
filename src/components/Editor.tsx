import { useEffect } from 'react';
import { useDocStore } from '../store/docStore';
import { CanvasView } from './CanvasView';

export function Editor({ docId }: { docId: string }) {
  const doc = useDocStore((s) => s.doc);
  const openDoc = useDocStore((s) => s.openDoc);
  const closeDoc = useDocStore((s) => s.closeDoc);

  useEffect(() => {
    openDoc(docId);
    return () => closeDoc();
  }, [docId, openDoc, closeDoc]);

  if (!doc) return <div className="bp-loading">Loading…</div>;

  return (
    <div className="bp-editor">
      <div className="bp-topbar">{doc.name}</div>
      <div className="bp-body">
        <CanvasView />
      </div>
    </div>
  );
}
