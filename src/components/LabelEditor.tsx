import { useEffect, useRef, useState } from 'react';
import { project } from '../lib/projection';
import type { ViewState } from '../lib/projection';
import type { AssetEl, FloorEl } from '../model/types';

interface LabelEditorProps {
  el: AssetEl | FloorEl;
  view: ViewState;
  onCommit: (text: string) => void;
  onCancel: () => void;
}

export function LabelEditor({ el, view, onCommit, onCancel }: LabelEditorProps) {
  const anchor = el.kind === 'floor'
    ? { x: el.gridX + (el.width - 1) / 2, y: el.gridY + (el.depth - 1) / 2 }
    : { x: el.gridX, y: el.gridY };
  const pt = project(anchor, view);
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
