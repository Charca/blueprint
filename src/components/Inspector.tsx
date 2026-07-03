import { Trash2 } from 'lucide-react';
import { PRESETS } from '../lib/color';
import { deleteElements, setAssetLabel, updateElement } from '../model/ops';
import type { AssetEl, AssetLabel, ConnectorEl, FloorEl, TagEl } from '../model/types';
import { useDocStore } from '../store/docStore';

export function Inspector() {
  const doc = useDocStore((s) => s.doc);
  const selection = useDocStore((s) => s.selection);
  const apply = useDocStore((s) => s.apply);
  const select = useDocStore((s) => s.select);
  if (!doc || selection.length === 0) return null;

  const selected = doc.elements.filter((e) => selection.includes(e.id));
  const colorable = selected.filter((e) => 'color' in e);
  const single = selected.length === 1 ? selected[0] : null;

  const setColor = (color: string) =>
    apply((els) => colorable.reduce((acc, e) => updateElement(acc, e.id, { color }), els));

  return (
    <div className="bp-inspector">
      {colorable.length > 0 && (
        <div className="bp-insp-row">
          {Object.entries(PRESETS).map(([name, hex]) => (
            <button key={name} title={name} className="bp-swatch"
              style={{ background: hex }} onClick={() => setColor(hex)} />
          ))}
          <input
            type="color"
            className="bp-swatch bp-swatch-custom"
            value={(colorable[0] as { color: string }).color}
            onChange={(e) => setColor(e.target.value)}
            title="Custom color"
          />
        </div>
      )}
      {single?.kind === 'asset' && (
        <LabelControls
          el={single}
          onText={(text) => apply((els) => setAssetLabel(els, single.id, text))}
          onPatch={(patch) => apply((els) => els.map((e) =>
            e.id === single.id && e.kind === 'asset' && e.label
              ? { ...e, label: { ...e.label, ...patch } }
              : e))}
        />
      )}
      {single?.kind === 'floor' && (
        <FloorControls el={single} onPatch={(patch) => apply((els) => updateElement(els, single.id, patch))} />
      )}
      {single?.kind === 'connector' && (
        <div className="bp-insp-row">
          {(['solid', 'dashed', 'dotted'] as const).map((style) => (
            <button key={style}
              className={`bp-chip${(single as ConnectorEl).style === style ? ' bp-active' : ''}`}
              onClick={() => apply((els) => updateElement(els, single.id, { style }))}
            >{style}</button>
          ))}
        </div>
      )}
      {single?.kind === 'tag' && (single as TagEl).style === 'bubble' && (
        <div className="bp-insp-row">
          <input
            className="bp-insp-input"
            placeholder="Lucide icon (e.g. Server)"
            defaultValue={(single as TagEl).icon ?? ''}
            onBlur={(e) => apply((els) => updateElement(els, single.id, { icon: e.target.value || undefined }))}
          />
        </div>
      )}
      <div className="bp-insp-row">
        <button
          className="bp-btn"
          onClick={() => { apply((els) => deleteElements(els, selection)); select([]); }}
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  );
}

function FloorControls({ el, onPatch }: { el: FloorEl; onPatch: (p: Partial<FloorEl>) => void }) {
  const num = (v: string, fallback: number) =>
    Math.min(12, Math.max(1, parseInt(v, 10) || fallback));
  return (
    <>
      <div className="bp-insp-row">
        <label>W <input type="number" min={1} max={12} value={el.width}
          onChange={(e) => onPatch({ width: num(e.target.value, el.width) })} /></label>
        <label>D <input type="number" min={1} max={12} value={el.depth}
          onChange={(e) => onPatch({ depth: num(e.target.value, el.depth) })} /></label>
      </div>
      <div className="bp-insp-row">
        {(['sharp', 'rounded', 'pill'] as const).map((c) => (
          <button key={c} className={`bp-chip${el.corners === c ? ' bp-active' : ''}`}
            onClick={() => onPatch({ corners: c })}>{c}</button>
        ))}
      </div>
    </>
  );
}

function LabelControls({ el, onText, onPatch }: {
  el: AssetEl;
  onText: (text: string) => void;
  onPatch: (patch: Partial<AssetLabel>) => void;
}) {
  const label = el.label;
  return (
    <>
      <div className="bp-insp-section">Label</div>
      <div className="bp-insp-row">
        <input
          key={`${el.id}:${label ? 'y' : 'n'}`}
          className="bp-insp-input"
          placeholder="Add a label…"
          defaultValue={label?.text ?? ''}
          onBlur={(e) => onText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      </div>
      {label && (
        <>
          <div className="bp-insp-row">
            {(['text', 'tag'] as const).map((style) => (
              <button key={style}
                className={`bp-chip${label.style === style ? ' bp-active' : ''}`}
                onClick={() => onPatch({ style })}>{style}</button>
            ))}
            {label.style === 'tag' && (['left', 'right'] as const).map((orientation) => (
              <button key={orientation}
                className={`bp-chip${label.orientation === orientation ? ' bp-active' : ''}`}
                onClick={() => onPatch({ orientation })}>{orientation}</button>
            ))}
          </div>
          <div className="bp-insp-row">
            {Object.entries(PRESETS).map(([name, hex]) => (
              <button key={name} title={`Label ${name}`} className="bp-swatch"
                style={{ background: hex }} onClick={() => onPatch({ color: hex })} />
            ))}
            <input
              type="color"
              className="bp-swatch bp-swatch-custom"
              value={label.color}
              onChange={(e) => onPatch({ color: e.target.value })}
              title="Label color"
            />
          </div>
        </>
      )}
    </>
  );
}
