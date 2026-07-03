# Shape Labels + View Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the top-view/rotation UI (default iso becomes the only view) and add customizable per-shape labels (inline double-click editing, text/tag styles, left/right tag orientation, Inspector controls).

**Architecture:** Labels live as an optional embedded field on `AssetEl` — move/duplicate/delete/undo/persist/export need no extra wiring. Rendering happens inside `AssetShape` (so `Scene` reuse carries labels into exports). The inline editor is a `foreignObject` inside the camera transform (editor-only chrome). The projection engine keeps its rotation/mode machinery dormant; only UI and the top-view render path are removed.

**Tech Stack:** Existing stack (React 18+ + TS strict + Vite + Zustand + lucide-react, Vitest).

**Spec:** `docs/superpowers/specs/2026-07-03-shape-labels-design.md`

## Global Constraints

- Strict TS: `npm run typecheck` passes at the end of every task; no new dependencies.
- Element shapes use inline SVG presentation attributes; chrome (Inspector, inline editor) may use CSS classes.
- Label defaults on creation: `style: 'text'`, `color: '#2A3242'`, `orientation: 'right'`.
- Empty/whitespace label text is never stored — committing it removes the `label` field.
- Every label mutation goes through `apply` (one undo step per commit).
- `loadDoc` normalizes every loaded doc's view to `{ rotation: 0, mode: 'iso' }`; `schemaVersion` stays 1.
- `src/lib/projection.ts`'s existing exports must NOT change (dormant machinery stays).
- Commit at the end of every task with the message given in the task.

## File Structure

```
Modify: src/components/TopBar.tsx        # remove rotate + Iso/Top controls
Modify: src/components/shapes/AssetShape.tsx  # remove top branch; render label; onDoubleClick
Delete: src/components/shapes/TopTile.tsx, src/lib/topIcons.ts
Modify: src/storage/local.ts             # loadDoc view normalization
Modify: src/model/types.ts               # AssetLabel + AssetEl.label
Modify: src/model/ops.ts                 # makeLabel, setAssetLabel
Modify: src/lib/projection.ts            # ADD labelPlaneMatrix (additive only)
Modify: src/export/svg.tsx               # label extents in contentBounds
Create: src/components/LabelEditor.tsx   # inline on-canvas editor
Modify: src/components/CanvasView.tsx    # dblclick asset -> editor; render editor
Modify: src/components/Inspector.tsx     # Label section
Modify: src/styles.css                   # editor + inspector-section styles
Modify: README.md                        # drop top-view/rotation, mention labels
```

---

### Task 1: Remove top view and rotation

**Files:**
- Modify: `src/components/TopBar.tsx`, `src/components/shapes/AssetShape.tsx`, `src/storage/local.ts`
- Delete: `src/components/shapes/TopTile.tsx`, `src/lib/topIcons.ts`
- Test: `src/storage/local.test.ts`

**Interfaces:**
- Consumes: existing `loadDoc`/`saveDoc`, `Doc`.
- Produces: `loadDoc` that always returns `view: { rotation: 0, mode: 'iso' }`. `AssetShape` with NO top-mode branch (later tasks edit it further). TopBar keeps: back, name, undo/redo, connect, export buttons. Do NOT touch `src/lib/projection.ts`.

- [ ] **Step 1: Write the failing normalization test**

Append inside the describe block of `src/storage/local.test.ts`:
```ts
  it('normalizes the saved view back to default iso on load', () => {
    const doc = createDoc('V');
    saveDoc({ ...doc, view: { rotation: 2, mode: 'top' } });
    expect(loadDoc(doc.id)?.view).toEqual({ rotation: 0, mode: 'iso' });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/storage/local.test.ts`
Expected: FAIL — loaded view is `{ rotation: 2, mode: 'top' }`.

- [ ] **Step 3: Normalize in loadDoc**

In `src/storage/local.ts`, change the `try` body of `loadDoc` to:
```ts
    const doc = JSON.parse(raw) as Doc;
    return { ...doc, view: { rotation: 0, mode: 'iso' } };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/storage/local.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Remove the view controls from TopBar**

In `src/components/TopBar.tsx`:
- Remove the two rotate buttons and the `.bp-seg` block (the Iso/Top toggle) from the JSX.
- Remove the `rotate` helper function and the `const { view } = doc;` line.
- Remove `RotateCcw`, `RotateCw` from the lucide-react import and the `Rotation` type import.
- Keep everything else (back, name input, undo/redo, Connect tool, divider, export buttons) unchanged.

- [ ] **Step 6: Remove the top-view render path**

- In `src/components/shapes/AssetShape.tsx`: delete the `if (view.mode === 'top') { return <TopTile ... /> }` branch and the `TopTile` import.
- Delete files: `src/components/shapes/TopTile.tsx` and `src/lib/topIcons.ts`.

```bash
git rm src/components/shapes/TopTile.tsx src/lib/topIcons.ts
```

- [ ] **Step 7: Full verify**

Run: `npm run typecheck && npm test`
Expected: tsc clean (no unused-import errors remain), all tests pass. Note: `src/lib/projection.test.ts` still tests rotations/top mode — that is intentional (dormant engine).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: remove top view and rotation controls; normalize view on load"
```

---

### Task 2: Label model and plane matrix

**Files:**
- Modify: `src/model/types.ts`, `src/model/ops.ts`, `src/lib/projection.ts`
- Test: `src/model/ops.test.ts`, `src/lib/projection.test.ts`

**Interfaces:**
- Produces (later tasks rely on these exact names):
  - `AssetLabel { text: string; style: 'text' | 'tag'; color: string; orientation: 'left' | 'right' }` and `AssetEl.label?: AssetLabel` in types.ts.
  - `makeLabel(text: string): AssetLabel` (defaults: style 'text', color '#2A3242', orientation 'right') and `setAssetLabel(els: Element[], id: string, text: string): Element[]` in ops.ts — trims text; empty → removes the label field; existing label → updates text only; no label → creates via makeLabel.
  - `labelPlaneMatrix(origin: Point, orientation: 'left' | 'right'): string` in projection.ts — origin is a point in the CURRENT USER SPACE (not a grid cell); right basis = x'(0.866, 0.5), y'(−0.866, 0.5); left basis = x'(0.866, −0.5), y'(0.866, 0.5).

- [ ] **Step 1: Add the types**

In `src/model/types.ts`, add above `AssetEl`:
```ts
export interface AssetLabel {
  text: string;
  style: 'text' | 'tag';
  color: string;                  // text color for 'text', pill color for 'tag'
  orientation: 'left' | 'right';  // rendered only for 'tag'
}
```
and add to `AssetEl`:
```ts
  label?: AssetLabel;
```

- [ ] **Step 2: Write the failing tests**

Append inside the describe block of `src/model/ops.test.ts` (extend the type import with `AssetLabel` if needed — the tests below only need `AssetEl`):
```ts
  it('setAssetLabel creates with defaults, updates text, and removes on empty', () => {
    let els: Element[] = [asset('a')];
    els = setAssetLabel(els, 'a', 'API');
    expect((els[0] as AssetEl).label).toEqual({
      text: 'API', style: 'text', color: '#2A3242', orientation: 'right',
    });
    els = updateElement(els, 'a', {
      label: { ...(els[0] as AssetEl).label!, style: 'tag' as const },
    });
    els = setAssetLabel(els, 'a', '  API v2  ');
    expect((els[0] as AssetEl).label).toMatchObject({ text: 'API v2', style: 'tag' });
    els = setAssetLabel(els, 'a', '   ');
    expect((els[0] as AssetEl).label).toBeUndefined();
  });

  it('setAssetLabel ignores non-asset elements', () => {
    const els: Element[] = [conn('c', 'a', 'b')];
    expect(setAssetLabel(els, 'c', 'X')).toEqual(els);
  });

  it('duplicateElements carries labels', () => {
    const labeled = setAssetLabel([asset('a')], 'a', 'DB');
    const { elements } = duplicateElements(labeled, ['a']);
    expect((elements[1] as AssetEl).label?.text).toBe('DB');
  });
```

Append inside the describe block of `src/lib/projection.test.ts`:
```ts
  it('labelPlaneMatrix anchors at the origin with rightward, unmirrored bases', () => {
    for (const orientation of ['left', 'right'] as const) {
      const m = labelPlaneMatrix({ x: 10, y: 20 }, orientation);
      const [a, b, c, d, e, f] = m.slice(7, -1).split(' ').map(Number);
      expect(a).toBeGreaterThan(0);          // text reads left-to-right
      expect(a * d - b * c).toBeGreaterThan(0); // not mirrored
      expect(e).toBe(10);
      expect(f).toBe(20);
    }
  });
```
(extend the imports of each test file accordingly: `setAssetLabel` from `./ops`, `labelPlaneMatrix` from `./projection`.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/model/ops.test.ts src/lib/projection.test.ts`
Expected: FAIL — `setAssetLabel` / `labelPlaneMatrix` not exported.

- [ ] **Step 4: Implement**

Append to `src/model/ops.ts`:
```ts
export const DEFAULT_LABEL_COLOR = '#2A3242';

export function makeLabel(text: string): AssetLabel {
  return { text, style: 'text', color: DEFAULT_LABEL_COLOR, orientation: 'right' };
}

/** Create (with defaults), retext, or remove (empty text) an asset's label. */
export function setAssetLabel(els: Element[], id: string, text: string): Element[] {
  return els.map((el) => {
    if (el.id !== id || el.kind !== 'asset') return el;
    const trimmed = text.trim();
    if (!trimmed) {
      const { label: _label, ...rest } = el;
      return rest;
    }
    return { ...el, label: el.label ? { ...el.label, text: trimmed } : makeLabel(trimmed) };
  });
}
```
(extend the types import in ops.ts with `AssetLabel`.)

Append to `src/lib/projection.ts` (do not modify existing exports):
```ts
/** Plane matrix for shape labels at the default orientation. `origin` is a
 * point in the current user space (NOT a grid cell). `right` lays text along
 * the down-right iso axis, `left` along the up-right axis. */
export function labelPlaneMatrix(origin: Point, orientation: 'left' | 'right'): string {
  const ux = Math.sqrt(3) / 2;
  return orientation === 'right'
    ? `matrix(${ux} 0.5 ${-ux} 0.5 ${origin.x} ${origin.y})`
    : `matrix(${ux} -0.5 ${ux} 0.5 ${origin.x} ${origin.y})`;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/model/ops.test.ts src/lib/projection.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck, full test, commit**

```bash
npm run typecheck && npm test
git add src/model src/lib
git commit -m "feat: asset label model and label plane matrix"
```

---

### Task 3: Render labels and include them in exports

**Files:**
- Modify: `src/components/shapes/AssetShape.tsx`, `src/export/svg.tsx`
- Test: `src/export/svg.test.tsx`

**Interfaces:**
- Consumes: `AssetLabel`, `labelPlaneMatrix`, `hexToHsl`.
- Produces: `AssetShape` renders `el.label` below the artwork and forwards double-clicks (`onDoubleClick?.(el.id)`); `contentBounds` covers label extents. Label anchor inside AssetShape's translated group: `(60, 129)` (artwork coords; equals projected point + (0, 44)).

- [ ] **Step 1: Write the failing export test**

Append inside the describe block of `src/export/svg.test.tsx`:
```tsx
  it('includes shape labels in the markup and bounds', () => {
    const labeled: Doc = {
      ...doc,
      elements: [{
        kind: 'asset', id: 'a1', gridX: 0, gridY: 0, assetId: 'cube-plain', color: '#E05252',
        label: { text: 'Gateway', style: 'tag', color: '#D6E0FF', orientation: 'left' },
      }],
    };
    expect(buildSvg(labeled)).toContain('Gateway');
    const b = contentBounds(labeled.elements, labeled.view);
    expect(b.minY + b.height).toBeGreaterThanOrEqual(74 + 80);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/export/svg.test.tsx`
Expected: FAIL — markup does not contain "Gateway".

- [ ] **Step 3: Render the label in AssetShape**

Replace `src/components/shapes/AssetShape.tsx` with:
```tsx
import type { PointerEvent } from 'react';
import { ASSETS } from '../../generated/assets';
import { instanceMarkup } from '../../lib/assetInstance';
import { hexToHsl } from '../../lib/color';
import { labelPlaneMatrix, project } from '../../lib/projection';
import type { ViewState } from '../../lib/projection';
import type { AssetEl, AssetLabel } from '../../model/types';

export interface ShapeProps<T> {
  el: T;
  view: ViewState;
  selected?: boolean;
  onPointerDown?: (e: PointerEvent, id: string) => void;
  onDoubleClick?: (id: string) => void;
}

const LABEL_ANCHOR = { x: 60, y: 129 }; // artwork coords: base vertex + 44px

function AssetLabelView({ label }: { label: AssetLabel }) {
  if (label.style === 'text') {
    return (
      <text x={LABEL_ANCHOR.x} y={LABEL_ANCHOR.y + 5} textAnchor="middle"
        fontSize={15} fontWeight={600} fill={label.color}>
        {label.text}
      </text>
    );
  }
  const w = label.text.length * 8 + 28;
  const dark = hexToHsl(label.color).l <= 0.7;
  return (
    <g transform={labelPlaneMatrix(LABEL_ANCHOR, label.orientation)}>
      <rect x={-w / 2} y={-14} width={w} height={28} rx={14} fill={label.color} />
      <text y={4.5} textAnchor="middle" fontSize={13} fontWeight={700}
        fill={dark ? '#ffffff' : '#2a3242'}>
        {label.text}
      </text>
    </g>
  );
}

export function AssetShape({ el, view, selected, onPointerDown, onDoubleClick }: ShapeProps<AssetEl>) {
  const def = ASSETS[el.assetId];
  if (!def) return null;
  const pt = project({ x: el.gridX, y: el.gridY }, view);
  return (
    <g
      transform={`translate(${pt.x - 60} ${pt.y - 85})`}
      onPointerDown={(e) => onPointerDown?.(e, el.id)}
      onDoubleClick={() => onDoubleClick?.(el.id)}
      style={onPointerDown ? { cursor: 'move' } : undefined}
    >
      <g dangerouslySetInnerHTML={{ __html: instanceMarkup(def, el.id, el.color) }} />
      {el.label && <AssetLabelView label={el.label} />}
      {selected && (
        <rect x={2} y={-4} width={116} height={124} rx={10}
          fill="none" stroke="#7C5CFF" strokeWidth={1.5} strokeDasharray="5 4" />
      )}
    </g>
  );
}
```

- [ ] **Step 4: Extend contentBounds**

In `src/export/svg.tsx`, inside the non-floor branch (after `pts.push(pt);`), add BEFORE the existing `if (el.kind === 'text')` block:
```ts
      if (el.kind === 'asset' && el.label) {
        const halfW = (el.label.text.length * 8 + 28) / 2 + 12;
        pts.push({ x: pt.x - halfW, y: pt.y }, { x: pt.x + halfW, y: pt.y + 74 });
      }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/export/svg.test.tsx`
Expected: PASS.

- [ ] **Step 6: Typecheck, full test, commit**

```bash
npm run typecheck && npm test
git add src/components/shapes/AssetShape.tsx src/export
git commit -m "feat: render asset labels and cover them in export bounds"
```

---

### Task 4: Inline label editor

**Files:**
- Create: `src/components/LabelEditor.tsx`
- Modify: `src/components/CanvasView.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `setAssetLabel`, `project`, docStore `apply`.
- Produces: double-clicking an asset opens the editor; Enter/blur commits once (one undo step), Esc cancels, empty removes. `LabelEditor({ el, view, onCommit, onCancel })`.

- [ ] **Step 1: Write LabelEditor**

`src/components/LabelEditor.tsx`:
```tsx
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
      />
    </foreignObject>
  );
}
```

- [ ] **Step 2: Wire into CanvasView**

In `src/components/CanvasView.tsx`:
- Add imports: `import { LabelEditor } from './LabelEditor';` and extend the ops import with `setAssetLabel`.
- Add state next to the other useState calls: `const [labelEditId, setLabelEditId] = useState<string | null>(null);`
- In `onElementDoubleClick`, add as the FIRST kind branch:
```ts
    if (el.kind === 'asset') {
      setLabelEditId(id);
      return;
    }
```
- Inside the camera `<g>`, AFTER `<Scene ... />`, render:
```tsx
        {(() => {
          const editing = labelEditId ? doc.elements.find((x) => x.id === labelEditId) : null;
          if (!editing || editing.kind !== 'asset') return null;
          return (
            <LabelEditor
              el={editing}
              view={doc.view}
              onCommit={(text) => {
                useDocStore.getState().apply((els) => setAssetLabel(els, editing.id, text));
                setLabelEditId(null);
              }}
              onCancel={() => setLabelEditId(null)}
            />
          );
        })()}
```

- [ ] **Step 3: Editor styles**

Append to `src/styles.css`:
```css
.bp-label-editor { width: 100%; padding: 6px 10px; border: 2px dashed #7C5CFF; border-radius: 6px; background: #fff; font: 600 15px system-ui, -apple-system, sans-serif; text-align: center; color: #2a3242; outline: none; }
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm test`
Expected: clean. Interactive behavior (focus, commit-once on Enter+blur, Esc, empty-removes) is verified by the controller in Chrome.

- [ ] **Step 5: Commit**

```bash
git add src/components src/styles.css
git commit -m "feat: inline label editor on shape double-click"
```

---

### Task 5: Inspector label section

**Files:**
- Modify: `src/components/Inspector.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `AssetEl`, `AssetLabel`, `setAssetLabel`, `updateElement`, `PRESETS`, docStore `apply`.
- Produces: a Label section when the selection is exactly one asset: text input (creates label with defaults when typing into an unlabeled asset; empty on blur removes), Text/Tag chips, left/right chips (tag only), label color swatches + picker (shown only when a label exists).

- [ ] **Step 1: Add LabelControls to Inspector**

In `src/components/Inspector.tsx`:
- Extend imports: `setAssetLabel` from `../model/ops`, `AssetEl, AssetLabel` types from `../model/types`.
- After the colorable row block and BEFORE the floor block, add:
```tsx
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
```
- Add the component at the bottom of the file:
```tsx
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
```

- [ ] **Step 2: Section style**

Append to `src/styles.css`:
```css
.bp-insp-section { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #8a93a6; margin-top: 2px; }
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm test`
Expected: clean. Note: `<input type="color">` requires a 6-digit hex — `DEFAULT_LABEL_COLOR` is `'#2A3242'`, uppercase is accepted by Chrome; controller verifies live.

- [ ] **Step 4: Commit**

```bash
git add src/components/Inspector.tsx src/styles.css
git commit -m "feat: label controls in the inspector"
```

---

### Task 6: Docs and final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

In `README.md`:
- In the intro paragraph, replace `one diagram model with isometric (4 orientations) and top-down projections` with `one diagram model rendered in isometric projection`.
- Remove the sentence in the asset-pipeline section that says to map a top-view icon in `src/lib/topIcons.ts` (the file no longer exists). Replace with: `Shapes can carry a customizable label (double-click a shape to edit it inline).`

- [ ] **Step 2: Full automated pass**

Run: `npm run typecheck && npm test && npm run build`
Expected: all clean.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: update README for labels and single-view simplification"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Part A (T1: TopBar controls, TopTile/topIcons deletion, AssetShape branch, loadDoc normalization + test). Part B model (T2), rendering + export (T3), inline editor (T4), Inspector (T5), docs (T6). Non-goals respected (no floor labels, no prompt migration).
- **Type consistency:** `AssetLabel`/`makeLabel`/`setAssetLabel`/`labelPlaneMatrix`/`LabelEditor` names used identically across T2–T5; `ShapeProps` unchanged shape; label anchor constant (60,129) = projected pt + (0,44) documented in T3.
- **Known simplifications:** Inspector text input uses `defaultValue` + blur-commit (keyed remount on label presence) rather than controlled two-way binding — deliberate, avoids fighting the store on every keystroke.
