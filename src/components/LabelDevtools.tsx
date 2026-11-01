import { ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import type { LabelTuning } from '../store/labelTuningStore';
import { useLabelTuningStore } from '../store/labelTuningStore';

interface Control {
  key: keyof LabelTuning;
  label: string;
  min: number;
  max: number;
  step?: number;
}

const GROUPS: { title: string; controls: Control[] }[] = [
  {
    title: 'Graphics',
    controls: [
      { key: 'assetAnchorX', label: 'Anchor X', min: 0, max: 120 },
      { key: 'assetAnchorY', label: 'Anchor Y', min: 70, max: 180 },
      { key: 'assetEdgeOffset', label: 'Edge center', min: 0, max: 60 },
      { key: 'assetAwayX', label: 'Outward X', min: -30, max: 30, step: 0.5 },
      { key: 'assetAwayY', label: 'Outward Y', min: -30, max: 50, step: 0.5 },
    ],
  },
  {
    title: 'Floors',
    controls: [
      { key: 'floorGap', label: 'Edge gap', min: 0, max: 120 },
      { key: 'floorOffsetX', label: 'Fine X', min: -60, max: 60, step: 0.5 },
      { key: 'floorOffsetY', label: 'Fine Y', min: -60, max: 60, step: 0.5 },
    ],
  },
  {
    title: 'Tag',
    controls: [
      { key: 'tagInlinePadding', label: 'Side padding', min: 0, max: 40 },
      { key: 'tagOneLineHeight', label: '1-line height', min: 16, max: 60 },
      { key: 'tagTwoLineHeight', label: '2-line height', min: 28, max: 90 },
      { key: 'tagOutlineWidth', label: 'White outline', min: 0, max: 12, step: 0.5 },
      { key: 'tagTextBaseline', label: 'Text baseline', min: -10, max: 18, step: 0.5 },
      { key: 'labelLineHeight', label: 'Line spacing', min: 10, max: 28, step: 0.5 },
      { key: 'labelWrapAt', label: 'Wrap at chars', min: 8, max: 60 },
      { key: 'textBaseline', label: 'Plain baseline', min: -10, max: 18, step: 0.5 },
    ],
  },
];

function Slider({ control }: { control: Control }) {
  const value = useLabelTuningStore((state) => state[control.key]);
  const setValue = useLabelTuningStore((state) => state.setValue);
  const update = (raw: string) => {
    const next = Number(raw);
    if (Number.isFinite(next)) setValue(control.key, next);
  };
  return (
    <label className="bp-label-devtools-control">
      <span>{control.label}</span>
      <input type="range" min={control.min} max={control.max} step={control.step ?? 1}
        value={value} onChange={(event) => update(event.target.value)} />
      <input type="number" min={control.min} max={control.max} step={control.step ?? 1}
        value={value} onChange={(event) => update(event.target.value)} />
    </label>
  );
}

export function LabelDevtools() {
  const [open, setOpen] = useState(false);
  const reset = useLabelTuningStore((state) => state.reset);

  if (!open) {
    return (
      <button className="bp-label-devtools-toggle" onClick={() => setOpen(true)}
        title="Open label tuning" aria-label="Open label tuning">
        <SlidersHorizontal size={18} />
        Label tuning
      </button>
    );
  }

  return (
    <aside className="bp-label-devtools" aria-label="Label tuning">
      <header>
        <div><strong>Label tuning</strong><small>Local development only</small></div>
        <div className="bp-label-devtools-actions">
          <button onClick={reset} title="Reset label tuning" aria-label="Reset label tuning"><RotateCcw size={15} /></button>
          <button onClick={() => setOpen(false)} title="Collapse label tuning" aria-label="Collapse label tuning"><ChevronDown size={17} /></button>
        </div>
      </header>
      <div className="bp-label-devtools-scroll">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h3>{group.title}</h3>
            {group.controls.map((control) => <Slider key={control.key} control={control} />)}
          </section>
        ))}
      </div>
    </aside>
  );
}
