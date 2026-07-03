# Shape Labels + View Simplification

**Date:** 2026-07-03
**Status:** Approved design
**Builds on:** `2026-07-02-blueprint-isometric-diagram-tool-design.md`

## Overview

Two changes in one feature branch:

1. **Remove top view and rotation** from the product (for now). The default
   isometric orientation becomes the only view. The projection engine keeps
   its rotation/mode machinery dormant so the feature can return later as a
   UI-level change.
2. **Per-shape labels.** Every asset shape gets an optional, customizable
   label: created/edited inline by double-clicking the shape, and editable
   (text, style, orientation, color) from the Inspector.

## Part A — Remove top view & rotation

- `TopBar`: remove the rotate ⟲/⟳ buttons and the Iso/Top segmented toggle
  (and their now-unused imports/styles).
- Delete `src/components/shapes/TopTile.tsx` and `src/lib/topIcons.ts`;
  remove the `view.mode === 'top'` branch from `AssetShape`.
- `src/lib/projection.ts` stays untouched (pure, tested, dormant).
  `ViewState` remains threaded through Scene/shape components.
- **Load normalization:** `loadDoc` forces `view = { rotation: 0, mode: 'iso' }`
  on every loaded doc, so canvases saved rotated or in top view snap back and
  are never stranded. `schemaVersion` stays 1 (the field's shape is
  unchanged; only its allowed value narrows).

## Part B — Shape labels

### Model

`AssetEl` gains one optional field (no new element kind):

```ts
export interface AssetLabel {
  text: string;
  style: 'text' | 'tag';
  color: string;                  // text color for 'text', pill color for 'tag'
  orientation: 'left' | 'right';  // rendered only for 'tag'
}

export interface AssetEl {
  // ...existing fields...
  label?: AssetLabel;
}
```

Defaults when a label is first created: `style: 'text'`, `color: '#2A3242'`,
`orientation: 'right'`. Because the label is embedded in the element,
move/duplicate/delete/undo/persistence/export all work with no extra wiring.
`duplicateElements` must carry the label through the spread (it already
does — spread copy). Empty label text is never stored: committing empty
text deletes the `label` field.

### Rendering (in `AssetShape`, below the artwork so exports get it free)

Label anchor: centered below the shape's base vertex — projected point
`pt` plus `(0, 44)` screen offset.

- **`text` style:** screen-aligned `<text>` — fontSize 15, fontWeight 600,
  fill = label color, textAnchor middle. Matches the reference screenshot.
- **`tag` style:** kit-style pill (rounded rect + auto-contrast text, same
  metrics as the existing bubble `TagShape`: height 28, width from text
  length) skewed onto the floor plane along a fixed axis:
  - `right` → text runs along the down-right iso axis, basis
    `x' = (0.866, 0.5)`, `y' = (-0.866, 0.5)` (the standard `planeMatrix`).
  - `left` → text runs along the up-right iso axis, basis
    `x' = (0.866, -0.5)`, `y' = (0.866, 0.5)`.
  - Pill fill = label color; text fill auto-contrasts via
    `hexToHsl(color).l > 0.7` (same rule as `TagShape`).
- Labels render for every asset that has one; no label field → nothing
  renders (current behavior unchanged).
- Selection ring and drag behavior are unchanged — the label is part of the
  shape's group and moves with it (pointer events on the label select/drag
  the shape).

### Inline editor (canvas chrome, never exported)

- Double-clicking an asset opens an on-canvas text input at the label
  anchor: a `foreignObject` rendered inside the camera transform (tracks
  pan/zoom), styled with a dashed purple border per the reference
  screenshot, pre-filled with the current label text (empty + placeholder
  "Text" when the label doesn't exist yet).
- Commit on Enter or blur; cancel on Esc. Commit semantics:
  - non-empty text, no existing label → create label with defaults
  - non-empty text, existing label → update `text` only
  - empty text → remove the label entirely
  - each commit is ONE undo step (`apply`); cancel touches nothing.
- Editing state is local to `CanvasView` (`useState<string | null>` holding
  the element id). Double-click on tags/texts/connectors keeps the existing
  prompt behavior (unchanged in this feature).

### Inspector

When the selection is exactly one asset, a **Label** section appears:

- Text input (updates label text; typing into it when no label exists creates
  one with defaults; emptying it removes the label on blur).
- Style chips: `Text` / `Tag`.
- Orientation chips: `left` / `right` — visible only when style is `tag`.
- Label color: the same preset swatches + free picker row used for shape
  color, but writing `label.color`. Only shown when a label exists.
- All Inspector label edits go through `apply` (undoable). The existing
  shape-color controls are unaffected.

### Export

- Labels are part of `Scene` output, so `buildSvg`/PNG include them
  automatically.
- `contentBounds` adds a vertical extent for labeled assets
  (`pt.y + 44 + 28` plus half the pill/text width horizontally, using the
  same `text.length`-based width heuristic as `TagShape`).

## Testing

- Model: label create/update/remove semantics (a `setLabel(els, id, patch)`
  style op or plain `updateElement` usage), duplicate carries the label.
- Projection/matrix: the `left`/`right` label bases produce the expected
  matrices (both with positive x-basis — no flip logic needed at fixed
  rotation 0).
- Storage: `loadDoc` normalizes a doc saved with `rotation: 2, mode: 'top'`
  back to `{ rotation: 0, mode: 'iso' }`.
- Export: `buildSvg` contains the label text; bounds cover a labeled asset's
  label extent.
- Inline editor + Inspector verified live in Chrome (controller).

## Non-goals

- Labels on floors, tags, texts, or connectors.
- Migrating existing prompt-based editing (tags/texts/connectors) to the
  inline editor.
- Re-adding rotation/top view (engine kept dormant on purpose).
