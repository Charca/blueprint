# Floor labels design

**Date:** 2026-07-03
**Status:** Approved

## Goal

Give floor objects the same label feature that shapes (assets) already have:

- Double-click a floor to edit its label text.
- `text` and `tag` styles.
- `left` / `right` position for the `tag` style.
- Color swatches, matching the asset Inspector.

Plus one global change: **`left` becomes the default `tag` position** (currently `right`), affecting both shapes and floors.

## Background

"Shape labels" in this codebase are **asset labels**: an optional `AssetLabel` on
`AssetEl`. Floors are the `floor` element kind (`FloorEl` → `FloorShape`) and
currently have no label. This feature generalizes the existing asset-label code
so it works for floors too, rather than duplicating it.

Key geometric difference: an asset is a fixed-height artwork with a base vertex,
while a floor is a flat W×D plane on the ground. So the label anchor and the
iso-skew matrix used for asset pills do not transfer directly — the floor needs
its own anchor.

## Design

### 1. Model (`src/model/types.ts`, `src/model/ops.ts`)

- Rename `AssetLabel` → `Label` (neutral name), keeping `export type AssetLabel = Label`
  as an alias so existing references keep compiling.
- Add `label?: Label` to `FloorEl`.
- Generalize `setAssetLabel(els, id, text)` → `setLabel(els, id, text)`: drop the
  `kind !== 'asset'` guard so it applies to any label-bearing kind (asset, floor).
  Preserve behavior: create via `makeLabel`, retext, or remove the `label` key when
  text is empty; return the same array reference when nothing changes. Keep a
  `setAssetLabel` alias if convenient for minimal churn, or update call sites.
- Change `makeLabel`'s default `orientation` from `'right'` to `'left'` (`ops.ts:92`).
  This is the single source of the default; it affects new shape labels too.

### 2. Rendering (`src/components/shapes/FloorShape.tsx`)

- Add a `FloorLabelView({ label, ... })` that renders `text` and `tag` styles
  identically to `AssetLabelView` (font size/weight, pill width formula, white
  border rect + colored pill, drop shadow, HSL-lightness-based text color, left/right
  offset along the iso axes).
- Anchor at the **floor's center**, floating just above the plane. Derive the anchor
  from the floor plane geometry (`planeMatrix` / `width` / `depth`) rather than the
  fixed `LABEL_ANCHOR` constant used for assets.
- Consume the `onDoubleClick` prop already passed via `shared` (currently destructured
  out / ignored) on the floor's root `<g>`.

### 3. Double-click editing (`src/components/CanvasView.tsx`, `src/components/LabelEditor.tsx`)

- Add a `floor` branch to `onElementDoubleClick` that sets `labelEditId` (same as the
  asset branch), instead of the `window.prompt` fallback.
- Widen the editor IIFE gate (currently `editing.kind === 'asset'`) and the
  `LabelEditor` prop type (currently `el: AssetEl`) to accept `asset | floor`.
- Position the editor input over the floor's label anchor.

### 4. Inspector (`src/components/Inspector.tsx`)

- Add the `LabelControls` block (text field, style toggle, left/right toggle shown only
  for `tag`, color swatches) to `FloorControls`.
- Wire text through `setLabel` and style/orientation/color through the same inline
  `{ ...e.label, ...patch }` merge used for assets.

### 5. Export (`src/export/svg.tsx`)

- Add a floor-label branch to the export bounds calc so floor labels are not clipped in
  exported SVGs (mirrors the existing asset-label bounds expansion at `svg.tsx:25-28`).

## Out of scope

- Multi-line labels (labels remain single-line, `maxLength={40}`).
- Any label styling changes beyond reusing the current asset pill/text look.
- Labels on element kinds other than asset and floor.

## Verification

- Type/build passes; existing `ops.test.ts` still green (add coverage for `setLabel` on a
  floor and for the new `left` default).
- Manual/screenshot check: double-click a floor edits its label; text and tag render;
  left/right toggle moves the pill; the pill offset reads correctly on a flat floor plane;
  new labels default to `left`; export includes floor labels without clipping.
