import { useEffect } from 'react';
import { createDoc, latestOpenedDocId } from '../storage/local';
import { useAppStore } from '../store/appStore';
import { useDocStore } from '../store/docStore';
import { CanvasView } from './CanvasView';
import { Inspector } from './Inspector';
import { Palette } from './Palette';
import { ToolDock } from './ToolDock';
import { TopBar } from './TopBar';

export function Editor({ docId }: { docId: string }) {
  const doc = useDocStore((s) => s.doc);
  const openStoreDoc = useDocStore((s) => s.openDoc);
  const closeDoc = useDocStore((s) => s.closeDoc);
  const openAppDoc = useAppStore((s) => s.openDoc);

  useEffect(() => {
    openStoreDoc(docId);
    if (!useDocStore.getState().doc) {
      openAppDoc(latestOpenedDocId() ?? createDoc().id);
      return;
    }
    return () => closeDoc();
  }, [docId, openStoreDoc, closeDoc, openAppDoc]);

  if (!doc) return <div className="bp-loading">Loading…</div>;

  return (
    <div className="bp-editor">
      <div className="bp-body">
        <div className="bp-canvas-wrap">
          <Palette />
          <TopBar />
          <CanvasView />
          <Inspector />
          <ToolDock />
        </div>
      </div>
    </div>
  );
}
