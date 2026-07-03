import { useState } from 'react';
import { MessageSquare, Square, StickyNote, Type } from 'lucide-react';
import { ASSET_LIST } from '../generated/assets';
import { instanceMarkup } from '../lib/assetInstance';
import { PRESETS } from '../lib/color';
import { useDocStore } from '../store/docStore';

const EXTRAS = [
  { key: 'floor', name: 'Floor', icon: Square },
  { key: 'tag:bubble', name: 'Bubble tag', icon: MessageSquare },
  { key: 'tag:tips', name: 'Tips tag', icon: StickyNote },
  { key: 'text:plain', name: 'Text', icon: Type },
  { key: 'text:callout', name: 'Callout', icon: StickyNote },
];

export function Palette() {
  const placing = useDocStore((s) => s.placing);
  const setPlacing = useDocStore((s) => s.setPlacing);
  const [q, setQ] = useState('');

  const toggle = (key: string) => setPlacing(placing === key ? null : key);
  const assets = ASSET_LIST.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <aside className="bp-palette">
      <input
        className="bp-search"
        placeholder="Search shapes…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="bp-palette-section">Graphics</div>
      <div className="bp-palette-grid">
        {assets.map((def) => (
          <button
            key={def.id}
            title={def.name}
            className={`bp-palette-item${placing === `asset:${def.id}` ? ' bp-active' : ''}`}
            onClick={() => toggle(`asset:${def.id}`)}
          >
            <svg viewBox={def.viewBox} width={48} height={48}>
              <g dangerouslySetInnerHTML={{
                __html: instanceMarkup(def, `pv-${def.id}`, PRESETS.blue),
              }} />
            </svg>
          </button>
        ))}
      </div>
      <div className="bp-palette-section">Building blocks</div>
      <div className="bp-palette-list">
        {EXTRAS.map(({ key, name, icon: Icon }) => (
          <button
            key={key}
            className={`bp-palette-row${placing === key ? ' bp-active' : ''}`}
            onClick={() => toggle(key)}
          >
            <Icon size={15} /> {name}
          </button>
        ))}
      </div>
    </aside>
  );
}
