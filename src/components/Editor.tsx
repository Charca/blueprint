import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { useDocStore } from '../store/docStore';
import { CanvasView } from './CanvasView';
import { Inspector } from './Inspector';
import { Palette } from './Palette';
import { TopBar } from './TopBar';

export function Editor({ docId }: { docId: string }) {
  const doc = useDocStore((s) => s.doc);
  const openDoc = useDocStore((s) => s.openDoc);
  const closeDoc = useDocStore((s) => s.closeDoc);
  const goHome = useAppStore((s) => s.goHome);

  useEffect(() => {
    openDoc(docId);
    if (!useDocStore.getState().doc) {
      goHome();
      return;
    }
    return () => closeDoc();
  }, [docId, openDoc, closeDoc, goHome]);

  if (!doc) return <div className="bp-loading">Loading…</div>;

  return (
    <div className="bp-editor">
      <div className="bp-body">
        <div className="bp-canvas-wrap">
          <Palette />
          <TopBar />
          <CanvasView />
          <Inspector />
        </div>
      </div>
    </div>
  );
}
