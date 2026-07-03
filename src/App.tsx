import { useAppStore } from './store/appStore';
import { Editor } from './components/Editor';
import { Home } from './components/Home';

export function App() {
  const docId = useAppStore((s) => s.docId);
  return docId ? <Editor docId={docId} key={docId} /> : <Home />;
}
