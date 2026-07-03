# Floor Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give floor objects the same label feature shapes (assets) already have — double-click to edit, `text`/`tag` styles, left/right position for tags — and make `left` the default tag position for all labels.

**Architecture:** Generalize the existing asset-label code rather than duplicating it. The label type becomes the neutral `Label` (with an `AssetLabel` alias for back-compat); the `setAssetLabel` op becomes a kind-agnostic `setLabel` covering `asset` and `floor`; a shared `LabelView` SVG component replaces the asset-only `AssetLabelView`; and the editor, Inspector, and export bounds are widened to accept floors.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest (+ jsdom, @testing-library/react), SVG rendering, Zustand store.

## Global Constraints

- Labels are single-line, `maxLength={40}` everywhere (existing behavior — do not change).
- `orientation` names the SIDE the tag pill sits on; it only affects rendering when `style === 'tag'`.
- Ops that return unchanged data MUST return the same array reference (existing convention, asserted by tests).
- Keep the pill/text visual identical to the current asset label (font sizes/weights, pill width formula `text.length * 8 + 28`, white border rect, drop shadow, HSL-lightness text color).
- Verification commands for every task: `npm run typecheck`, `npm test`, `npm run build`.

---

### Task 1: Generalize the label model (`Label`, `FloorEl.label`, `setLabel`, default `left`)

**Files:**
- Modify: `src/model/types.ts:14-35`
- Modify: `src/model/ops.ts:4`, `src/model/ops.ts:89-110`
- Modify: `src/model/ops.test.ts` (imports + label tests)
- Modify (mechanical rename only): `src/components/CanvasView.tsx:6`, `src/components/CanvasView.tsx:228`
- Modify (mechanical rename only): `src/components/Inspector.tsx:3`, `src/components/Inspector.tsx:41`

**Interfaces:**
- Produces: `Label` (interface), `AssetLabel` (alias of `Label`), `FloorEl.label?: Label`, `setLabel(els: Element[], id: string, text: string): Element[]`, `makeLabel(text: string): Label` (default `orientation: 'left'`).
- Consumes: nothing new.

- [ ] **Step 1: Update the failing tests first**

In `src/model/ops.test.ts`, update the import line (currently line 2-6) so the type import includes `FloorEl` and the ops import uses `setLabel`:

```ts
import { describe, expect, it } from 'vitest';
import type { AssetEl, ConnectorEl, Element, FloorEl, TagEl } from './types';
import {
  addElement, anchorOf, createFromPlacing, deleteElements, duplicateElements,
  moveElements, updateElement, setLabel,
} from './ops';
```

Add a `floor` factory next to the existing `asset`/`conn` factories:

```ts
const floor = (id: string, x = 0, y = 0): FloorEl =>
  ({ kind: 'floor', id, gridX: x, gridY: y, width: 4, depth: 3, corners: 'sharp', color: '#C9D2E3' });
```

Replace the four existing label tests (the `setAssetLabel ...` and `duplicateElements carries labels` blocks) with these:

```ts
  it('setLabel creates with defaults (orientation left), updates text, and removes on empty', () => {
    let els: Element[] = [asset('a')];
    els = setLabel(els, 'a', 'API');
    expect((els[0] as AssetEl).label).toEqual({
      text: 'API', style: 'text', color: '#2A3242', orientation: 'left',
    });
    els = updateElement(els, 'a', {
      label: { ...(els[0] as AssetEl).label!, style: 'tag' as const },
    });
    els = setLabel(els, 'a', '  API v2  ');
    expect((els[0] as AssetEl).label).toMatchObject({ text: 'API v2', style: 'tag' });
    els = setLabel(els, 'a', '   ');
    expect((els[0] as AssetEl).label).toBeUndefined();
  });

  it('setLabel applies to floor elements', () => {
    let els: Element[] = [floor('f')];
    els = setLabel(els, 'f', 'Zone A');
    expect((els[0] as FloorEl).label).toMatchObject({
      text: 'Zone A', style: 'text', orientation: 'left',
    });
    els = setLabel(els, 'f', '   ');
    expect((els[0] as FloorEl).label).toBeUndefined();
  });

  it('setLabel ignores unsupported kinds', () => {
    const els: Element[] = [conn('c', 'a', 'b')];
    expect(setLabel(els, 'c', 'X')).toEqual(els);
  });

  it('duplicateElements carries labels', () => {
    const labeled = setLabel([asset('a')], 'a', 'DB');
    const { elements } = duplicateElements(labeled, ['a']);
    expect((elements[1] as AssetEl).label?.text).toBe('DB');
  });

  it('setLabel returns the same array when nothing changes', () => {
    const els = setLabel([asset('a')], 'a', 'DB');
    expect(setLabel(els, 'a', 'DB')).toBe(els);
    expect(setLabel(els, 'a', '  DB ')).toBe(els);
    const unlabeled: Element[] = [asset('b')];
    expect(setLabel(unlabeled, 'b', '   ')).toBe(unlabeled);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `setLabel` is not exported from `./ops` (and `FloorEl` may be reported unused until the model is updated).

- [ ] **Step 3: Update the model types**

In `src/model/types.ts`, replace the `AssetLabel` interface (lines 14-19) with:

```ts
export interface Label {
  text: string;
  style: 'text' | 'tag';
  color: string;                  // text color for 'text', pill color for 'tag'
  orientation: 'left' | 'right';  // rendered only for 'tag'
}

/** Back-compat alias — labels are shared across asset and floor elements. */
export type AssetLabel = Label;
```

Change `AssetEl`'s label field (line 26) to reference `Label`:

```ts
  label?: Label;
```

Add a label field to `FloorEl` (after the `color: string;` on line 34):

```ts
export interface FloorEl {
  kind: 'floor'; id: string;
  gridX: number; gridY: number;
  width: number; depth: number;
  corners: 'sharp' | 'rounded' | 'pill';
  color: string;
  label?: Label;
}
```

- [ ] **Step 4: Update the ops**

In `src/model/ops.ts`, change the type import (line 4):

```ts
import type { Label, Element } from './types';
```

Change `makeLabel` (lines 91-93) to default `orientation: 'left'` and return `Label`:

```ts
export function makeLabel(text: string): Label {
  return { text, style: 'text', color: DEFAULT_LABEL_COLOR, orientation: 'left' };
}
```

Replace `setAssetLabel` (lines 95-110) with the kind-agnostic `setLabel`:

```ts
/** Create (with defaults), retext, or remove (empty text) an asset's or floor's
 * label. Returns `els` unchanged (same reference) when nothing would change. */
export function setLabel(els: Element[], id: string, text: string): Element[] {
  const target = els.find((el) => el.id === id);
  if (!target || (target.kind !== 'asset' && target.kind !== 'floor')) return els;
  const trimmed = text.trim();
  if (trimmed === (target.label?.text ?? '')) return els;
  return els.map((el) => {
    if (el.id !== id || (el.kind !== 'asset' && el.kind !== 'floor')) return el;
    if (!trimmed) {
      const { label: _label, ...rest } = el;
      return rest;
    }
    return { ...el, label: el.label ? { ...el.label, text: trimmed } : makeLabel(trimmed) };
  });
}
```

- [ ] **Step 5: Rename the two call sites (mechanical, no behavior change)**

In `src/components/CanvasView.tsx` line 6, change `setAssetLabel` to `setLabel` in the import list. On line 228 change `setAssetLabel(els, editing.id, text)` to `setLabel(els, editing.id, text)`.

In `src/components/Inspector.tsx` line 3, change `setAssetLabel` to `setLabel` in the import list. On line 41 change `setAssetLabel(els, single.id, text)` to `setLabel(els, single.id, text)`.

(Inspector still imports `AssetLabel` on line 4 — leave it; the alias keeps it valid. It is replaced in Task 5.)

- [ ] **Step 6: Run tests + typecheck + build to verify green**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS — all ops tests green (including the new floor test), no type errors, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/model/types.ts src/model/ops.ts src/model/ops.test.ts src/components/CanvasView.tsx src/components/Inspector.tsx
git commit -m "feat: generalize label model to floors; default tag position left

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Extract shared `LabelView` and use it in `AssetShape`

**Files:**
- Create: `src/components/shapes/LabelView.tsx`
- Modify: `src/components/shapes/AssetShape.tsx:1-9`, `src/components/shapes/AssetShape.tsx:31-65`, `src/components/shapes/AssetShape.tsx:79`

**Interfaces:**
- Produces: `LabelView({ label, anchor }: { label: Label; anchor: Point })` — renders text/tag exactly like the old `AssetLabelView`, anchored at `anchor` (user-space point) instead of a hardcoded constant.
- Consumes: `Label` (Task 1), `Point` from `../../lib/projection`, `hexToHsl`, `labelPlaneMatrix`.

- [ ] **Step 1: Create the shared component**

Create `src/components/shapes/LabelView.tsx`:

```tsx
import { hexToHsl } from '../../lib/color';
import { labelPlaneMatrix } from '../../lib/projection';
import type { Point } from '../../lib/projection';
import type { Label } from '../../model/types';

/** Renders a shape/floor label. `anchor` is a point in the enclosing group's
 * user space; the pill/text is centered on it. `orientation` names the side the
 * tag pill sits on (only relevant for `style === 'tag'`). */
export function LabelView({ label, anchor }: { label: Label; anchor: Point }) {
  if (label.style === 'text') {
    return (
      <text x={anchor.x} y={anchor.y + 5} textAnchor="middle"
        fontSize={15} fontWeight={600} fill={label.color}>
        {label.text}
      </text>
    );
  }
  const w = label.text.length * 8 + 28;
  const dark = hexToHsl(label.color).l <= 0.7;
  const dir = label.orientation === 'right' ? 1 : -1;
  const axis = label.orientation === 'left' ? 'right' : 'left'; // labelPlaneMatrix's text-tilt axis
  const shift = (w / 2 + 10) * dir;
  const away = { x: 5 * dir, y: 8.7 };
  return (
    <g transform={`translate(${away.x} ${away.y})`}
      style={{ filter: 'drop-shadow(0 2px 3px rgba(29, 36, 51, 0.28))' }}>
      <g transform={labelPlaneMatrix(anchor, axis)}>
        <g transform={`translate(${shift} 0)`}>
          <rect x={-w / 2 - 3} y={-17} width={w + 6} height={34} rx={17} fill="#ffffff" />
          <rect x={-w / 2} y={-14} width={w} height={28} rx={14} fill={label.color} />
          <text y={4.5} textAnchor="middle" fontSize={13} fontWeight={700}
            fill={dark ? '#ffffff' : '#2a3242'}>
            {label.text}
          </text>
        </g>
      </g>
    </g>
  );
}
```

- [ ] **Step 2: Refactor `AssetShape` to use it**

In `src/components/shapes/AssetShape.tsx`, replace the import block (lines 1-9) with (drops `hexToHsl` and `labelPlaneMatrix` and the `AssetLabel` type; adds `LabelView`):

```tsx
import { memo } from 'react';
import type { PointerEvent } from 'react';
import { ASSETS } from '../../generated/assets';
import type { AssetDef } from '../../generated/assets';
import { instanceMarkup } from '../../lib/assetInstance';
import { project } from '../../lib/projection';
import type { ViewState } from '../../lib/projection';
import type { AssetEl } from '../../model/types';
import { LabelView } from './LabelView';
```

Delete the entire `AssetLabelView` function (lines 31-65). Keep `LABEL_ANCHOR` (line 19), `ShapeProps` (lines 11-17), and `ArtworkGlyph` (lines 25-29).

Change the label render (line 79) from `{el.label && <AssetLabelView label={el.label} />}` to:

```tsx
      {el.label && <LabelView label={el.label} anchor={LABEL_ANCHOR} />}
```

- [ ] **Step 3: Verify typecheck + build + tests**

Run: `npm run typecheck && npm run build && npm test`
Expected: PASS — no type errors, build succeeds, tests still green.

- [ ] **Step 4: Manual visual check (asset labels unchanged)**

Run: `npm run dev`, open the app, add an asset, double-click it, type a label, switch it to `tag` style in the Inspector. Confirm the text label and the tag pill look exactly as before this task (this is a pure refactor of asset rendering). New labels now default to the `left` tag position (from Task 1).

- [ ] **Step 5: Commit**

```bash
git add src/components/shapes/LabelView.tsx src/components/shapes/AssetShape.tsx
git commit -m "refactor: extract shared LabelView from AssetShape

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Render the floor label and enable double-click on `FloorShape`

**Files:**
- Modify: `src/components/shapes/FloorShape.tsx` (whole file)

**Interfaces:**
- Consumes: `LabelView` (Task 2), `project` from `../../lib/projection`, `ShapeProps<FloorEl>` (already carries `onDoubleClick`).
- Produces: floor renders its `el.label` centered on the floor and fires `onDoubleClick(el.id)`.

- [ ] **Step 1: Rewrite `FloorShape.tsx`**

Replace the whole file with:

```tsx
import { CELL, planeMatrix, project } from '../../lib/projection';
import { derivePalette } from '../../lib/color';
import type { FloorEl } from '../../model/types';
import type { ShapeProps } from './AssetShape';
import { LabelView } from './LabelView';

export function FloorShape({ el, view, selected, onPointerDown, onDoubleClick }: ShapeProps<FloorEl>) {
  const corner = { x: el.gridX - 0.5, y: el.gridY - 0.5 };
  const m = planeMatrix(corner, view);
  const w = el.width * CELL, d = el.depth * CELL;
  const rx = el.corners === 'pill' ? Math.min(w, d) / 2 : el.corners === 'rounded' ? 18 : 0;
  const pal = derivePalette(el.color);
  const thickness = view.mode === 'iso' ? 6 : 0;
  const center = project({ x: el.gridX + (el.width - 1) / 2, y: el.gridY + (el.depth - 1) / 2 }, view);

  return (
    <g
      onPointerDown={(e) => onPointerDown?.(e, el.id)}
      onDoubleClick={() => onDoubleClick?.(el.id)}
      style={onPointerDown ? { cursor: 'move' } : undefined}
    >
      {thickness > 0 && (
        <g transform={`translate(0 ${thickness})`}>
          <g transform={m}>
            <rect width={w} height={d} rx={rx} fill={pal['#7394f3']} />
          </g>
        </g>
      )}
      <g transform={m}>
        <rect
          width={w} height={d} rx={rx} fill={pal['#d6e0ff']}
          stroke={selected ? '#7C5CFF' : 'none'} strokeWidth={2}
          strokeDasharray={selected ? '6 4' : undefined}
        />
      </g>
      {el.label && <LabelView label={el.label} anchor={center} />}
    </g>
  );
}
```

- [ ] **Step 2: Verify typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS. (No label appears yet in the UI because nothing sets `el.label` on a floor — that arrives in Tasks 4 & 5. This task only wires rendering + the double-click handler.)

- [ ] **Step 3: Commit**

```bash
git add src/components/shapes/FloorShape.tsx
git commit -m "feat: render floor labels and forward floor double-click

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Wire double-click-to-edit for floors (`CanvasView` + `LabelEditor`)

**Files:**
- Modify: `src/components/LabelEditor.tsx:1-14`
- Modify: `src/components/CanvasView.tsx:144-147`, `src/components/CanvasView.tsx:220-234`

**Interfaces:**
- Consumes: `setLabel` (Task 1), `FloorEl`.
- Produces: double-clicking a floor opens the `LabelEditor` positioned at the floor's center; committing calls `setLabel`.

- [ ] **Step 1: Widen `LabelEditor` to accept floors**

In `src/components/LabelEditor.tsx`, replace the import + props + anchor computation (lines 1-14) with:

```tsx
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
```

Leave the rest of the file (from `const [text, setText] = ...` through the `foreignObject`) unchanged.

- [ ] **Step 2: Add the floor branch to the double-click handler**

In `src/components/CanvasView.tsx`, change the asset-only check in `onElementDoubleClick` (lines 144-147) to include floors:

```tsx
    if (el.kind === 'asset' || el.kind === 'floor') {
      setLabelEditId(id);
      return;
    }
```

- [ ] **Step 3: Widen the editor gate**

In `src/components/CanvasView.tsx`, in the IIFE that renders the `LabelEditor` (line 222), change the guard so floors also render an editor:

```tsx
          if (!editing || (editing.kind !== 'asset' && editing.kind !== 'floor')) return null;
```

(The `onCommit` on line 228 already calls `setLabel` after Task 1 — no change needed.)

- [ ] **Step 4: Verify typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Manual check — floor editing works**

Run: `npm run dev`. Add a floor (Floor tool), double-click it, type "Zone A", press Enter. The label renders centered on the floor as plain text. Double-click again and clear the text to confirm it removes the label.

- [ ] **Step 6: Commit**

```bash
git add src/components/LabelEditor.tsx src/components/CanvasView.tsx
git commit -m "feat: double-click a floor to edit its label

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Add floor label controls to the Inspector

**Files:**
- Modify: `src/components/Inspector.tsx:4`, `src/components/Inspector.tsx:38-57`, `src/components/Inspector.tsx:111-115`

**Interfaces:**
- Consumes: `setLabel` (Task 1), `Label`, `updateElement`.
- Produces: the Inspector shows the full label controls (text field, style toggle, left/right toggle for tags, color swatches) for a single selected floor, in addition to the existing W/D/corners controls.

- [ ] **Step 1: Update the type import**

In `src/components/Inspector.tsx` line 4, replace `AssetLabel` with `Label`:

```tsx
import type { AssetEl, ConnectorEl, FloorEl, Label, TagEl } from '../model/types';
```

- [ ] **Step 2: Replace the asset + floor blocks with a shared label block**

In `src/components/Inspector.tsx`, replace the asset block and floor block (lines 38-57) with:

```tsx
      {single?.kind === 'floor' && (
        <FloorControls el={single} onPatch={(patch) => apply((els) => updateElement(els, single.id, patch))} />
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
```

- [ ] **Step 3: Generalize the `LabelControls` prop type**

In `src/components/Inspector.tsx`, change the `LabelControls` signature (lines 111-115) so it accepts any element with an id and optional label:

```tsx
function LabelControls({ el, onText, onPatch }: {
  el: { id: string; label?: Label };
  onText: (text: string) => void;
  onPatch: (patch: Partial<Label>) => void;
}) {
```

Leave the body of `LabelControls` unchanged.

- [ ] **Step 4: Verify typecheck + build + tests**

Run: `npm run typecheck && npm run build && npm test`
Expected: PASS.

- [ ] **Step 5: Manual check — floor Inspector**

Run: `npm run dev`. Select a floor. Confirm the Inspector shows: color swatches, W/D + corners chips, then a "Label" section with a text field. Type a label; the style toggle (`text`/`tag`) and color swatches appear. Switch to `tag`; the `left`/`right` toggle appears and defaults to `left`. Toggling `right` moves the pill to the other side. Confirm the same still works for a selected asset.

- [ ] **Step 6: Commit**

```bash
git add src/components/Inspector.tsx
git commit -m "feat: floor label controls in the Inspector

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Include floor labels in export bounds

**Files:**
- Modify: `src/export/svg.tsx:16-19`

**Interfaces:**
- Consumes: `project`, `el.label` on floors.
- Produces: exported SVG viewBox accounts for floor label extents so labels are not clipped.

- [ ] **Step 1: Extend the floor branch in `contentBounds`**

In `src/export/svg.tsx`, replace the floor branch (lines 16-19) with:

```tsx
    if (el.kind === 'floor') {
      for (const [dx, dy] of [[-0.5, -0.5], [el.width - 0.5, -0.5], [-0.5, el.depth - 0.5], [el.width - 0.5, el.depth - 0.5]]) {
        pts.push(project({ x: el.gridX + dx, y: el.gridY + dy }, view));
      }
      if (el.label) {
        const c = project({ x: el.gridX + (el.width - 1) / 2, y: el.gridY + (el.depth - 1) / 2 }, view);
        const halfW = (el.label.text.length * 8 + 28) / 2 + 12;
        pts.push({ x: c.x - halfW, y: c.y - 20 }, { x: c.x + halfW, y: c.y + 20 });
      }
    } else {
```

- [ ] **Step 2: Verify typecheck + build + tests**

Run: `npm run typecheck && npm run build && npm test`
Expected: PASS.

- [ ] **Step 3: Manual check — export**

Run: `npm run dev`. Add a floor with a `tag` label near the edge of the content, export to SVG (existing export action), and confirm the floor label is fully visible (not clipped) in the exported file.

- [ ] **Step 4: Commit**

```bash
git add src/export/svg.tsx
git commit -m "feat: account for floor labels in SVG export bounds

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** Model + default-left (Task 1); rendering (Tasks 2–3); double-click editing (Task 4); Inspector controls (Task 5); export bounds (Task 6). All five spec sections mapped.
- **Type consistency:** `Label` defined in Task 1 and used consistently in `LabelView` (Task 2), `LabelEditor`/`CanvasView` (Task 4), `Inspector` (Task 5), `svg.tsx` (Task 6). `setLabel` name is used identically across ops, tests, CanvasView, and Inspector. `AssetLabel` alias keeps `AssetShape`/`Inspector` compiling between tasks.
- **UI test note:** The codebase has unit tests only for `src/model` (`ops.test.ts`); shapes/components have none. Following that established pattern, UI tasks (2–6) are verified via `typecheck` + `build` + explicit manual checks rather than fabricated component tests. Task 1 carries the real TDD cycle for the model change.
