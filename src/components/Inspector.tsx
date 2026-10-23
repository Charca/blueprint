import type { ComponentType } from 'react';
import { ArrowRight, Circle, CornerDownRight, Minus, Square, Trash2, Triangle } from 'lucide-react';
import { PRESETS } from '../lib/color';
import { connectorEndHead, connectorRoute, connectorStartHead } from '../lib/connectorGeometry';
import { deleteElements, floorBounds, floorChildren, setLabel, updateElement } from '../model/ops';
import type { ConnectorEl, ConnectorHead, ConnectorRoute, FloorEl, Label, TagEl } from '../model/types';
import { useDocStore } from '../store/docStore';

const CONNECTOR_HEADS: { value: ConnectorHead; label: string; icon: ComponentType<{ size?: number }> }[] = [
  { value: 'none', label: 'No head', icon: Minus },
  { value: 'triangle', label: 'Triangle arrow', icon: Triangle },
  { value: 'arrow', label: 'Arrow', icon: ArrowRight },
  { value: 'circle', label: 'Circle', icon: Circle },
  { value: 'square', label: 'Square', icon: Square },
];

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
      {single?.kind === 'floor' && (
        <FloorControls
          el={single}
          childCount={floorChildren(doc.elements, single.id).length}
          bounds={floorBounds(doc.elements, single)}
          onPatch={(patch) => apply((els) => updateElement(els, single.id, patch))}
        />
      )}
      {single && (single.kind === 'asset' || single.kind === 'floor') && (
        <LabelControls
          el={single}
          onText={(text) => apply((els) => setLabel(els, single.id, text))}
          onPatch={(patch) => {
            const current = single.label;
            if (!current) return;
            if (Object.entries(patch).every(
              ([k, v]) => current[k as keyof Label] === v,
            )) return;
            apply((els) => els.map((e) =>
              e.id === single.id && (e.kind === 'asset' || e.kind === 'floor') && e.label
                ? { ...e, label: { ...e.label, ...patch } }
                : e));
          }}
        />
      )}
      {single?.kind === 'connector' && (
        <ConnectorControls
          el={single}
          onPatch={(patch) => apply((els) => updateElement(els, single.id, patch))}
        />
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

function ConnectorControls({ el, onPatch }: { el: ConnectorEl; onPatch: (p: Partial<ConnectorEl>) => void }) {
  const HeadButtons = ({ value, field }: { value: ConnectorHead; field: 'startHead' | 'endHead' }) => (
    <>
      {CONNECTOR_HEADS.map(({ value: head, label, icon: Icon }) => (
        <button key={head} title={label}
          className={`bp-chip${value === head ? ' bp-active' : ''}`}
          onClick={() => onPatch({ [field]: head } as Partial<ConnectorEl>)}>
          <Icon size={14} />
        </button>
      ))}
    </>
  );
  return (
    <>
      <div className="bp-insp-section">Connector</div>
      <div className="bp-insp-row">
        {(['solid', 'dashed', 'dotted'] as const).map((style) => (
          <button key={style}
            className={`bp-chip${el.style === style ? ' bp-active' : ''}`}
            onClick={() => onPatch({ style })}
          >{style}</button>
        ))}
      </div>
      <div className="bp-insp-row">
        {(['sharp', 'elbow'] as ConnectorRoute[]).map((route) => (
          <button key={route}
            className={`bp-chip${connectorRoute(el) === route ? ' bp-active' : ''}`}
            onClick={() => onPatch({ route })}
          >{route === 'elbow' && <CornerDownRight size={14} />}{route}</button>
        ))}
      </div>
      <div className="bp-insp-section">Start head</div>
      <div className="bp-insp-row"><HeadButtons value={connectorStartHead(el)} field="startHead" /></div>
      <div className="bp-insp-section">End head</div>
      <div className="bp-insp-row"><HeadButtons value={connectorEndHead(el)} field="endHead" /></div>
    </>
  );
}

function FloorControls({
  el, childCount, bounds, onPatch,
}: { el: FloorEl; childCount: number; bounds: Pick<FloorEl, 'gridX' | 'gridY' | 'width' | 'depth'>; onPatch: (p: Partial<FloorEl>) => void }) {
  const mode = el.sizeMode ?? 'auto';
  const manual = mode === 'manual' || childCount === 0;
  const num = (v: string, fallback: number) =>
    Math.max(1, parseInt(v, 10) || fallback);
  const switchMode = (sizeMode: 'auto' | 'manual') => {
    if (sizeMode === 'manual') onPatch({ sizeMode, ...bounds });
    else onPatch({ sizeMode });
  };
  return (
    <>
      <div className="bp-insp-row">
        {(['auto', 'manual'] as const).map((sizeMode) => (
          <button key={sizeMode} className={`bp-chip${mode === sizeMode ? ' bp-active' : ''}`}
            onClick={() => switchMode(sizeMode)}>{sizeMode}</button>
        ))}
        {mode === 'auto' && childCount > 0 && (
          <span className="bp-insp-note">Sized around {childCount} item{childCount === 1 ? '' : 's'}</span>
        )}
      </div>
      {manual && (
        <div className="bp-insp-row">
          <label>W <input type="number" min={1} value={el.width}
            onChange={(e) => onPatch({ sizeMode: 'manual', width: num(e.target.value, el.width) })} /></label>
          <label>D <input type="number" min={1} value={el.depth}
            onChange={(e) => onPatch({ sizeMode: 'manual', depth: num(e.target.value, el.depth) })} /></label>
        </div>
      )}
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
  el: { id: string; label?: Label };
  onText: (text: string) => void;
  onPatch: (patch: Partial<Label>) => void;
}) {
  const label = el.label;
  return (
    <>
      <div className="bp-insp-section">Label</div>
      <div className="bp-insp-row">
        <input
          key={`${el.id}:${label?.text ?? ''}`}
          className="bp-insp-input"
          placeholder="Add a label…"
          defaultValue={label?.text ?? ''}
          onBlur={(e) => onText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          maxLength={40}
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
