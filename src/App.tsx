import { useEffect } from 'react';
import { useAppStore } from './store/appStore';
import { Editor } from './components/Editor';
import { createDoc, latestOpenedDocId } from './storage/local';

export function App() {
  const docId = useAppStore((s) => s.docId);
  const openDoc = useAppStore((s) => s.openDoc);

  useEffect(() => {
    if (docId) return;
    openDoc(latestOpenedDocId() ?? createDoc().id);
  }, [docId, openDoc]);

  return docId ? <Editor docId={docId} key={docId} /> : <div className="bp-loading">Loading…</div>;
}
