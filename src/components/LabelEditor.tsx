import { useEffect, useRef, useState } from 'react';
import { project } from '../lib/projection';
import type { ViewState } from '../lib/projection';
import type { AssetEl } from '../model/types';

interface LabelEditorProps {
  el: AssetEl;
  view: ViewState;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

export function LabelEditor({ el, view, onCommit, onCancel }: LabelEditorProps) {
  const pt = project({ x: el.gridX, y: el.gridY }, view);
  const [text, setText] = useState(el.label?.text ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    if (done.current) return;
    done.current = true;
    onCommit(text);
  };
  const cancel = () => {
    if (done.current) return;
    done.current = true;
    onCancel();
  };

  return (
    <foreignObject x={pt.x - 90} y={pt.y + 22} width={180} height={44}>
      <input
        ref={inputRef}
        className="bp-label-editor"
        value={text}
        placeholder="Text"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') cancel();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        maxLength={40}
      />
    </foreignObject>
  );
}
