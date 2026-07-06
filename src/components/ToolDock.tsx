import { Hand, MousePointer2, MoveUpRight } from 'lucide-react';
import { useDocStore } from '../store/docStore';
import type { Tool } from '../store/docStore';

const TOOLS: { tool: Tool; label: string; icon: typeof MousePointer2 }[] = [
  { tool: 'select', label: 'Cursor', icon: MousePointer2 },
  { tool: 'pan', label: 'Hand', icon: Hand },
  { tool: 'connect', label: 'Arrow', icon: MoveUpRight },
];

export function ToolDock() {
  const tool = useDocStore((s) => s.tool);
  const setTool = useDocStore((s) => s.setTool);

  return (
    <div className="bp-tool-dock" aria-label="Canvas tools">
      {TOOLS.map(({ tool: value, label, icon: Icon }) => (
        <button
          key={value}
          className={`bp-tool-btn${tool === value ? ' bp-active' : ''}`}
          title={label}
          aria-label={label}
          onClick={() => setTool(value)}
        >
          <Icon size={22} strokeWidth={1.9} />
        </button>
      ))}
    </div>
  );
}
