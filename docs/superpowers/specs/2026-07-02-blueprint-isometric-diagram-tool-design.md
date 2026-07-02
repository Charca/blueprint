# Blueprint — Isometric Architecture Diagram Tool

**Date:** 2026-07-02
**Status:** Approved design

## Overview

Blueprint is a local-first diagramming tool in the spirit of Excalidraw, but for
isometric architecture diagrams built from the GT Diagram Kit (Isometric Style)
asset library. Users compose diagrams by placing kit assets on an isometric
grid, connecting them with arrows, and labeling them with tags and text. The
same diagram can be viewed in isometric projection at four orientations (90°
steps) or as a flat top-down layout.

### Goals

- Create, rename, delete, and switch between multiple canvases.
- Place, move, recolor, connect, and label isometric assets on a snapping grid.
- Rotate the diagram in 90° steps and toggle a top-down view — both are pure
  re-projections of one underlying model; no element data changes.
- Recolor any asset to any color programmatically (kit presets + free picker).
- Export diagrams as SVG and PNG.
- Run locally with `npm run dev` for live testing.

### Non-goals (v1)

- No backend, accounts, sharing links, or real-time collaboration.
- No freeform drawing (pen/pencil) tools.
- No per-element rotation of asset artwork (the kit has one fixed iso angle).
- No mobile/touch optimization.

## Stack

- **React 18 + TypeScript + Vite** — app framework and dev server.
- **Zustand** — app and document state (small, no boilerplate, easy undo).
- **SVG rendering** — the scene renders to a single SVG element. Assets are
  SVG, projection is coordinate math, and SVG export falls out of the
  renderer for free. No canvas engine.
- **Vitest** — unit tests for the pure logic modules.
- No other runtime dependencies.

## Asset pipeline

Assets are individual SVG files exported from Figma, one file per shape, named
by shape (e.g. `cube-server.svg`), stored under `assets/<category>/`:

- `assets/graphics/` — isometric artwork (9 shapes present today; more later).
- `assets/icons/` — flat icons, used as top-view artwork (pending export).
- `assets/floor/` — floor/platform artwork (pending export).
- `assets/tags/` — tag/label artwork (pending export).

Only one color variant (blue) is exported per shape; all other colors are
derived programmatically.

### Palette normalization

Every kit SVG draws from a closed palette of exactly 9 colors (verified across
all current exports):

| Role         | Hex       |
| ------------ | --------- |
| outline      | `#3258C2` |
| face-left-lo | `#3261E4` |
| face-left-hi | `#618AFF` |
| accent       | `#5983F8` |
| face-right-lo| `#7394F3` |
| face-right-hi| `#7D9EFC` |
| face-top-lo  | `#88A7FF` |
| face-top-hi  | `#A3BBFF` |
| detail       | `#D6E0FF` |

A build-time script (`scripts/build-assets.ts`, run via a Vite plugin or npm
script) processes `assets/**/*.svg` into `src/generated/`:

1. Replace each palette hex with `var(--bp-c0)` … `var(--bp-c8)`.
2. Namespace all `id` attributes and references (gradients, clips) per asset so
   multiple assets can coexist in one document.
3. Strip the outer `<svg>` wrapper; emit inner markup + viewBox as a TS module.
4. Emit `manifest.ts`: `{ assetId, name, category, viewBox }[]` derived from
   filenames. Unknown (non-palette) colors in a file cause a build warning and
   are left untouched.

At runtime, a pure function `derivePalette(baseColor: string): string[]`
converts each of the 9 reference colors to HSL, measures its offset from the
reference base hue, and produces 9 shades from the requested base color,
preserving the saturation/lightness relationships. Each placed asset instance
sets `--bp-c0..8` on its group element. Kit-equivalent presets (gray, blue,
teal) plus a free color picker are exposed in the UI.

Adding a new asset later = drop the exported SVG into the right folder and
rebuild. No manual manifest editing.

## Data model

```ts
type Doc = {
  id: string;
  name: string;
  schemaVersion: 1;
  view: { rotation: 0 | 1 | 2 | 3; mode: 'iso' | 'top' };
  camera: { x: number; y: number; zoom: number };
  elements: Element[];
};

type Element = Asset | Floor | Connector | Tag | Text;

type Asset = {
  kind: 'asset'; id: string;
  gridX: number; gridY: number;      // integer cells
  assetId: string;                    // manifest key
  color: string;                      // base hex, palette derived
};

type Floor = {
  kind: 'floor'; id: string;
  gridX: number; gridY: number;       // top-left cell
  width: number; depth: number;       // in cells
  color: string;
};

type Connector = {
  kind: 'connector'; id: string;
  fromId: string; toId: string;       // element ids
  style: 'solid' | 'dashed' | 'dotted';
  color: string;
  label?: string;                     // pill label at midpoint
};

type Tag = {
  kind: 'tag'; id: string;
  attachedTo?: string;                // element id, else free at gridX/gridY
  gridX: number; gridY: number;
  text: string; color: string;
};

type Text = {
  kind: 'text'; id: string;
  gridX: number; gridY: number;
  content: string;
  variant: 'plain' | 'callout';       // callout = boxed note
};
```

All positions are logical grid coordinates. Nothing in the model encodes a
projection.

## Projection & view system

A pure module `src/lib/projection.ts`:

- `rotateGrid(pos, rotation, ...)` — remaps grid coords 90° per step around the
  content center. Applied before projecting.
- `isoProject(pos)` — grid → screen for 2:1-style isometric matching the kit's
  angle (derived from the artwork: 120px tile with 30° faces).
- `topProject(pos)` — grid → screen for the flat top-down layout (plain 2D
  grid, same rotation applied).
- Inverse functions for hit-testing/drop-snapping in both modes.

Switching rotation or mode only changes `doc.view`; the renderer re-projects.
Connectors recompute their routes from their endpoints' projected anchors.

**Top-view artwork:** flat icons from `assets/icons/` matched to graphics by
name. Until icons are exported, top view renders a rounded rect + the asset
name as fallback.

## Rendering

One `<svg>` scene, layered bottom to top:

1. Grid (subtle iso/top guide lines)
2. Floors
3. Connectors
4. Assets — painter's algorithm, sorted by rotated `(x + y)` in iso mode
5. Tags & text
6. Selection chrome (highlight, handles, ghost previews)

Asset instances render the generated markup via a shared `<defs>`/`<symbol>`
per assetId with per-instance CSS variables for color.

## UI

Two screens, React Router not needed (simple state switch):

- **Home** — grid of canvas cards (name, updated-at, thumbnail later). Create,
  open, rename, delete.
- **Editor**
  - Left sidebar: asset palette grouped by category, search box; drag out to
    place with a grid-snapped ghost preview.
  - Top bar: back to home, document name (inline edit), rotate ⟲/⟳, iso/top
    toggle, export menu (SVG/PNG).
  - Selection popover/inspector: color presets + custom picker, connector
    style, delete.
  - Canvas: pan (space-drag or two-finger scroll), zoom (pinch / ⌘-scroll),
    click select, shift-click multi-select, drag move (snapped), connector
    tool (click source, click target), double-click tag/text to edit.
  - Keys: `⌫` delete, `⌘Z`/`⇧⌘Z` undo/redo, `⌘D` duplicate, `Esc` cancel tool.

## Persistence & export

- Documents stored as JSON in `localStorage` (`blueprint:doc:<id>` plus a
  `blueprint:index` list). `schemaVersion` field for future migrations.
  Save on change (debounced).
- Undo/redo: per-document history of model snapshots (elements only, capped),
  in memory.
- **SVG export:** serialize the scene SVG minus grid/selection chrome, with
  used symbols and resolved color variables inlined.
- **PNG export:** rasterize that SVG string via an offscreen `<img>` + canvas
  at 2x.

## Testing

- Vitest unit tests for: `derivePalette` (round-trips kit blue → kit gray/teal
  approximations, arbitrary hues), `rotateGrid`/`isoProject`/`topProject`
  (including inverses), model operations (add/move/delete/duplicate,
  connector integrity when endpoints are deleted), undo/redo, and the asset
  build script (palette substitution, id namespacing).
- UI verified live via `npm run dev`.

## Open items

- `assets/icons/`, `assets/floor/`, `assets/tags/` exports pending from Figma;
  top view uses the fallback rendering and floors/tags use simple generated
  shapes until then.
- Canvas thumbnails on the home screen — nice-to-have, not v1-blocking.
