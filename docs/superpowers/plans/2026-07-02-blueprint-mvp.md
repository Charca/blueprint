# Blueprint MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Blueprint, a local-first isometric architecture diagramming tool (Excalidraw-style) with multiple canvases, grid-snapped kit assets, programmatic recoloring, connectors, tags, floors, 90° rotation, top-down view, and SVG/PNG export.

**Architecture:** One document model in logical grid coordinates; isometric and top-down views are pure re-projections (`src/lib/projection.ts`). Kit SVGs are transformed at build time (id namespacing) and recolored at render time by replacing the kit's closed 9-color palette with shades derived from any base color. Scene renders to a single SVG; the same Scene component is reused for SVG export via `renderToStaticMarkup`.

**Tech Stack:** React 18 + TypeScript + Vite, Zustand, lucide-react, Vitest (+ jsdom, @testing-library/react).

**Spec:** `docs/superpowers/specs/2026-07-02-blueprint-isometric-diagram-tool-design.md`

## Global Constraints

- Runtime dependencies limited to: `react`, `react-dom`, `zustand`, `lucide-react`. Nothing else.
- TypeScript `strict: true`. `npx tsc --noEmit` must pass at the end of every task.
- localStorage keys: `blueprint:index` (doc metadata list) and `blueprint:doc:<id>`.
- Documents carry `schemaVersion: 1`.
- Kit palette (exact, order matters — index N = CSS role `c0..c8`): `#3258C2 #3261E4 #618AFF #5983F8 #7394F3 #7D9EFC #88A7FF #A3BBFF #D6E0FF`. Reference base color: `#618AFF`.
- Element shapes must use inline SVG presentation attributes (fontSize, fill, etc.), NOT CSS classes, for anything that must survive standalone SVG export. Classes are allowed only for editor-only chrome (grid, selection, canvas layout).
- Generated code lives in `src/generated/` and IS committed. Rerun `npm run assets` after adding SVGs to `assets/graphics/`.
- Commit at the end of every task (messages given per task).

## File Structure

```
package.json, tsconfig.json, vite.config.ts, index.html
scripts/build-assets.mjs        # asset pipeline: id-namespace kit SVGs, emit manifest module
src/generated/assets.ts         # AUTO-GENERATED asset defs (committed)
src/main.tsx, src/App.tsx, src/styles.css
src/lib/ids.ts                  # uid()
src/lib/color.ts                # hex<->HSL, derivePalette, PRESETS
src/lib/projection.ts           # CELL, rotateGrid, project, unproject, depth, planeMatrix
src/lib/assetInstance.ts        # instanceMarkup(def, instanceId, color) with memo cache
src/lib/wrap.ts                 # wrapText for callout bodies
src/lib/topIcons.ts             # assetId -> lucide icon component
src/model/types.ts              # Doc, Element union
src/model/ops.ts                # addElement, moveElements, deleteElements, duplicateElements, anchorOf, createFromPlacing
src/storage/local.ts            # localStorage CRUD (listDocs, createDoc, saveDoc, loadDoc, deleteDoc, renameDoc)
src/store/appStore.ts           # which screen (home vs editor docId)
src/store/docStore.ts           # open doc, selection, tool, undo/redo, debounced persist
src/components/Home.tsx
src/components/Editor.tsx
src/components/TopBar.tsx
src/components/Palette.tsx
src/components/Inspector.tsx
src/components/CanvasView.tsx   # camera, pointer interactions, keyboard, ghost
src/components/Scene.tsx        # pure layered renderer (shared with export)
src/components/Grid.tsx
src/components/shapes/AssetShape.tsx
src/components/shapes/TopTile.tsx
src/components/shapes/FloorShape.tsx
src/components/shapes/ConnectorShape.tsx
src/components/shapes/TagShape.tsx
src/components/shapes/TextShape.tsx
src/export/svg.tsx              # contentBounds, buildSvg
src/export/png.ts               # svgToPngBlob, download
```

Tests are colocated: `src/lib/color.test.ts`, `src/lib/projection.test.ts`, `src/lib/buildAssets.test.js`, `src/model/ops.test.ts`, `src/storage/local.test.ts`, `src/store/docStore.test.ts`, `src/lib/wrap.test.ts`, `src/export/svg.test.tsx`, `src/components/Home.test.tsx`.

---

### Task 1: Scaffold the Vite app

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`
- Modify: `.gitignore`

**Interfaces:**
- Produces: a running dev server and passing (empty) test suite; `src/App.tsx` default export replaced in Task 8.

- [ ] **Step 1: Write package.json**

```json
{
  "name": "blueprint",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "assets": "node scripts/build-assets.mjs"
  }
}
```

- [ ] **Step 2: Install dependencies (gets current versions)**

Run:
```bash
npm i react react-dom zustand lucide-react
npm i -D vite @vitejs/plugin-react typescript vitest jsdom @testing-library/react @types/react @types/react-dom
```
Expected: both commands exit 0, `dependencies` has exactly the 4 runtime packages.

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Write vite.config.ts**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: false },
});
```

- [ ] **Step 5: Write index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Blueprint</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Write src/main.tsx, src/App.tsx, src/styles.css**

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx`:
```tsx
export function App() {
  return <h1>Blueprint</h1>;
}
```

`src/styles.css`:
```css
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body { font-family: system-ui, -apple-system, sans-serif; color: #1d2433; background: #f5f7fb; }
```

- [ ] **Step 7: Update .gitignore**

Append `node_modules/` and `dist/` if not present (`.gitignore` already has them from the initial commit — verify).

- [ ] **Step 8: Verify**

Run: `npm run typecheck && npm test -- --passWithNoTests`
Expected: tsc clean; vitest reports "no test files found" but exits 0.
Run: `npm run dev` — open http://localhost:5173, see the "Blueprint" heading. Stop the server.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + React + TS app with vitest"
```

---

### Task 2: Color utilities (derivePalette)

**Files:**
- Create: `src/lib/color.ts`, `src/lib/ids.ts`
- Test: `src/lib/color.test.ts`

**Interfaces:**
- Produces: `KIT_COLORS: readonly string[]` (9 uppercase hexes), `KIT_BASE = '#618AFF'`, `PRESETS = { gray, blue, teal }`, `hexToHsl(hex): {h,s,l}`, `hslToHex(h,s,l): string` (lowercase output), `derivePalette(base: string): Record<string, string>` (keys = kit hexes LOWERCASE, values = derived lowercase hexes), `uid(): string`.

- [ ] **Step 1: Write the failing test**

`src/lib/color.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { KIT_COLORS, KIT_BASE, derivePalette, hexToHsl, hslToHex } from './color';

function channelDelta(a: string, b: string): number {
  const ca = a.replace('#', ''), cb = b.replace('#', '');
  let max = 0;
  for (let i = 0; i < 6; i += 2) {
    max = Math.max(max, Math.abs(parseInt(ca.slice(i, i + 2), 16) - parseInt(cb.slice(i, i + 2), 16)));
  }
  return max;
}

describe('color', () => {
  it('round-trips hex through HSL within 1/channel', () => {
    for (const hex of KIT_COLORS) {
      const { h, s, l } = hexToHsl(hex);
      expect(channelDelta(hslToHex(h, s, l), hex)).toBeLessThanOrEqual(1);
    }
  });

  it('derivePalette of the kit base reproduces the kit palette', () => {
    const pal = derivePalette(KIT_BASE);
    for (const hex of KIT_COLORS) {
      expect(channelDelta(pal[hex.toLowerCase()], hex)).toBeLessThanOrEqual(1);
    }
  });

  it('derivePalette of a red base shifts every color toward red hue', () => {
    const pal = derivePalette('#E05252');
    for (const hex of KIT_COLORS) {
      const out = hexToHsl(pal[hex.toLowerCase()]);
      const src = hexToHsl(hex);
      expect(out.h).not.toBeCloseTo(src.h, 0);
    }
  });

  it('derivePalette of a gray base yields desaturated shades', () => {
    const pal = derivePalette('#9AA0AB');
    for (const hex of KIT_COLORS) {
      expect(hexToHsl(pal[hex.toLowerCase()]).s).toBeLessThan(0.25);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/color.test.ts`
Expected: FAIL — cannot resolve `./color`.

- [ ] **Step 3: Write the implementation**

`src/lib/ids.ts`:
```ts
export const uid = (): string =>
  Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
```

`src/lib/color.ts`:
```ts
export const KIT_COLORS = [
  '#3258C2', '#3261E4', '#618AFF', '#5983F8', '#7394F3',
  '#7D9EFC', '#88A7FF', '#A3BBFF', '#D6E0FF',
] as const;

export const KIT_BASE = '#618AFF';

export const PRESETS = {
  gray: '#A9B4CC',
  blue: '#618AFF',
  teal: '#1FD9C6',
} as const;

export interface Hsl { h: number; s: number; l: number }

export function hexToHsl(hex: string): Hsl {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return { h, s, l };
}

export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Map each kit color to a shade derived from `base`, preserving the kit's
 * hue offsets and saturation/lightness ratios relative to KIT_BASE. */
export function derivePalette(base: string): Record<string, string> {
  const refBase = hexToHsl(KIT_BASE);
  const b = hexToHsl(base);
  const out: Record<string, string> = {};
  for (const ref of KIT_COLORS) {
    const r = hexToHsl(ref);
    const h = b.h + (r.h - refBase.h);
    const s = clamp01((r.s / refBase.s) * b.s);
    const l = clamp01((r.l / refBase.l) * b.l);
    out[ref.toLowerCase()] = hslToHex(h, s, l);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/color.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/lib
git commit -m "feat: kit palette derivation from any base color"
```

---

### Task 3: Asset build script + generated module

**Files:**
- Create: `scripts/build-assets.mjs`
- Create (generated): `src/generated/assets.ts`
- Test: `src/lib/buildAssets.test.js` (plain JS so tsc ignores it; vitest runs it)

**Interfaces:**
- Produces: `transformSvg(source: string): { viewBox: string, markup: string }` and `titleCase(id: string): string` exported from the script for tests; generated module exports `interface AssetDef { id; name; category; viewBox; markup }`, `ASSETS: Record<string, AssetDef>`, `ASSET_LIST: AssetDef[]`.
- Markup contract: inner SVG only (no `<svg>` wrapper); every `id="X"`, `url(#X)`, `href="#X"` rewritten to `__BP__X`. Renderers replace `__BP__` with a per-instance prefix so multiple instances never share gradient/mask ids.

- [ ] **Step 1: Write the failing test**

`src/lib/buildAssets.test.js`:
```js
import { describe, expect, it } from 'vitest';
import { transformSvg, titleCase } from '../../scripts/build-assets.mjs';

const FIXTURE = `<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M0 0h10" fill="#3258C2" stroke="#3258C2"/>
<rect width="5" height="5" fill="url(#paint0_linear_1_2)" mask="url(#mask0_1_2)"/>
<use href="#shape1"/>
<defs><linearGradient id="paint0_linear_1_2"><stop stop-color="#618AFF"/></linearGradient>
<mask id="mask0_1_2"/><path id="shape1"/></defs>
</svg>`;

describe('build-assets', () => {
  it('extracts viewBox and strips the svg wrapper', () => {
    const { viewBox, markup } = transformSvg(FIXTURE);
    expect(viewBox).toBe('0 0 120 120');
    expect(markup).not.toContain('<svg');
    expect(markup).not.toContain('</svg>');
  });

  it('namespaces ids and all references with the __BP__ token', () => {
    const { markup } = transformSvg(FIXTURE);
    expect(markup).toContain('id="__BP__paint0_linear_1_2"');
    expect(markup).toContain('url(#__BP__paint0_linear_1_2)');
    expect(markup).toContain('url(#__BP__mask0_1_2)');
    expect(markup).toContain('href="#__BP__shape1"');
    expect(markup).not.toMatch(/id="(?!__BP__)/);
  });

  it('title-cases kebab ids', () => {
    expect(titleCase('cube-infra-filled')).toBe('Cube Infra Filled');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/buildAssets.test.js`
Expected: FAIL — cannot resolve the script module.

- [ ] **Step 3: Write scripts/build-assets.mjs**

```js
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export function transformSvg(source) {
  const vb = /viewBox="([^"]+)"/.exec(source);
  if (!vb) throw new Error('SVG missing viewBox');
  let inner = source
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '');
  inner = inner
    .replace(/id="([^"]+)"/g, 'id="__BP__$1"')
    .replace(/url\(#([^)]+)\)/g, 'url(#__BP__$1)')
    .replace(/href="#([^"]+)"/g, 'href="#__BP__$1"');
  return { viewBox: vb[1], markup: inner.trim() };
}

export function titleCase(id) {
  return id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function buildModule(dir, category) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.svg')).sort();
  const entries = files.map((f) => {
    const id = basename(f, '.svg');
    const { viewBox, markup } = transformSvg(readFileSync(join(dir, f), 'utf8'));
    return [id, { id, name: titleCase(id), category, viewBox, markup }];
  });
  return [
    '// AUTO-GENERATED by scripts/build-assets.mjs — do not edit. Run `npm run assets`.',
    'export interface AssetDef {',
    '  id: string; name: string; category: string; viewBox: string; markup: string;',
    '}',
    `export const ASSETS: Record<string, AssetDef> = ${JSON.stringify(Object.fromEntries(entries), null, 2)};`,
    'export const ASSET_LIST: AssetDef[] = Object.values(ASSETS);',
    '',
  ].join('\n');
}

const isMain = process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]));
if (isMain) {
  mkdirSync('src/generated', { recursive: true });
  writeFileSync('src/generated/assets.ts', buildModule('assets/graphics', 'graphics'));
  console.log(`Wrote src/generated/assets.ts`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/buildAssets.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Generate the real module**

Run: `npm run assets && npm run typecheck`
Expected: `src/generated/assets.ts` exists, contains keys `cube-plain`, `cube-server`, `cube-pc`, `cube-box`, `cube-documents`, `cube-monolith`, `cube-infra`, `cube-infra-filled`, `cube-tree`; tsc clean.

- [ ] **Step 6: Commit**

```bash
git add scripts src/generated src/lib/buildAssets.test.js
git commit -m "feat: asset build pipeline generating namespaced kit markup"
```

---

### Task 4: Projection module

**Files:**
- Create: `src/lib/projection.ts`
- Test: `src/lib/projection.test.ts`

**Interfaces:**
- Produces: `CELL = 50`, `ISO_X = Math.sqrt(3)/2 * CELL`, `ISO_Y = CELL/2`, `type Rotation = 0|1|2|3`, `interface Point { x; y }`, `interface ViewState { rotation: Rotation; mode: 'iso'|'top' }`, `rotateGrid(p, r): Point`, `unrotateGrid(p, r): Point`, `project(p, view): Point`, `unproject(pt, view): Point` (fractional — callers round), `depth(p, r): number`, `planeMatrix(corner: Point, view): string` (SVG `matrix(...)` mapping 1 grid cell to CELL px in "plane space").

- [ ] **Step 1: Write the failing test**

`src/lib/projection.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  CELL, ISO_X, ISO_Y, depth, planeMatrix, project, rotateGrid, unproject, unrotateGrid,
} from './projection';
import type { Rotation, ViewState } from './projection';

const ISO: ViewState = { rotation: 0, mode: 'iso' };
const TOP: ViewState = { rotation: 0, mode: 'top' };

describe('projection', () => {
  it('projects the origin to the origin in both modes', () => {
    expect(project({ x: 0, y: 0 }, ISO)).toEqual({ x: 0, y: 0 });
    expect(project({ x: 0, y: 0 }, TOP)).toEqual({ x: 0, y: 0 });
  });

  it('projects iso axes symmetrically', () => {
    expect(project({ x: 1, y: 0 }, ISO)).toEqual({ x: ISO_X, y: ISO_Y });
    expect(project({ x: 0, y: 1 }, ISO)).toEqual({ x: -ISO_X, y: ISO_Y });
  });

  it('projects top mode to a plain grid', () => {
    expect(project({ x: 2, y: 3 }, TOP)).toEqual({ x: 2 * CELL, y: 3 * CELL });
  });

  it('rotateGrid cycles back to identity after 4 steps', () => {
    let p = { x: 3, y: -2 };
    for (let i = 0; i < 4; i++) p = rotateGrid(p, 1);
    expect(p).toEqual({ x: 3, y: -2 });
  });

  it('unrotateGrid inverts rotateGrid for every rotation', () => {
    const p = { x: 5, y: 7 };
    for (const r of [0, 1, 2, 3] as Rotation[]) {
      expect(unrotateGrid(rotateGrid(p, r), r)).toEqual(p);
    }
  });

  it('unproject inverts project in every view', () => {
    const p = { x: 4, y: -3 };
    for (const mode of ['iso', 'top'] as const) {
      for (const rotation of [0, 1, 2, 3] as Rotation[]) {
        const view = { rotation, mode };
        const q = unproject(project(p, view), view);
        expect(q.x).toBeCloseTo(p.x, 6);
        expect(q.y).toBeCloseTo(p.y, 6);
      }
    }
  });

  it('depth increases toward the viewer along +x and +y', () => {
    expect(depth({ x: 1, y: 1 }, 0)).toBeGreaterThan(depth({ x: 0, y: 0 }, 0));
  });

  it('planeMatrix maps a unit cell onto projected basis vectors', () => {
    const m = planeMatrix({ x: 0, y: 0 }, ISO);
    const [a, b, c, d, e, f] = m.slice(7, -1).split(' ').map(Number);
    expect(a * CELL).toBeCloseTo(ISO_X, 4);
    expect(b * CELL).toBeCloseTo(ISO_Y, 4);
    expect(c * CELL).toBeCloseTo(-ISO_X, 4);
    expect(d * CELL).toBeCloseTo(ISO_Y, 4);
    expect(e).toBe(0);
    expect(f).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/projection.test.ts`
Expected: FAIL — cannot resolve `./projection`.

- [ ] **Step 3: Write the implementation**

`src/lib/projection.ts`:
```ts
export const CELL = 50;
export const ISO_X = (Math.sqrt(3) / 2) * CELL; // 43.301
export const ISO_Y = CELL / 2;                  // 25

export type Rotation = 0 | 1 | 2 | 3;
export interface Point { x: number; y: number }
export interface ViewState { rotation: Rotation; mode: 'iso' | 'top' }

export function rotateGrid(p: Point, r: Rotation): Point {
  switch (r) {
    case 0: return { x: p.x, y: p.y };
    case 1: return { x: -p.y, y: p.x };
    case 2: return { x: -p.x, y: -p.y };
    default: return { x: p.y, y: -p.x };
  }
}

export function unrotateGrid(p: Point, r: Rotation): Point {
  return rotateGrid(p, ((4 - r) % 4) as Rotation);
}

export function project(p: Point, view: ViewState): Point {
  const q = rotateGrid(p, view.rotation);
  return view.mode === 'iso'
    ? { x: (q.x - q.y) * ISO_X, y: (q.x + q.y) * ISO_Y }
    : { x: q.x * CELL, y: q.y * CELL };
}

export function unproject(pt: Point, view: ViewState): Point {
  const q = view.mode === 'iso'
    ? { x: (pt.x / ISO_X + pt.y / ISO_Y) / 2, y: (pt.y / ISO_Y - pt.x / ISO_X) / 2 }
    : { x: pt.x / CELL, y: pt.y / CELL };
  return unrotateGrid(q, view.rotation);
}

/** Painter's-algorithm sort key: larger = closer to the viewer. */
export function depth(p: Point, r: Rotation): number {
  const q = rotateGrid(p, r);
  return q.x + q.y;
}

/** SVG transform mapping "plane space" (CELL px per grid cell, origin at
 * `corner`) onto the projected view. Lets us draw rounded rects/text flat
 * and have them lie on the floor plane in iso mode. */
export function planeMatrix(corner: Point, view: ViewState): string {
  const o = project(corner, view);
  const u = project({ x: corner.x + 1, y: corner.y }, view);
  const v = project({ x: corner.x, y: corner.y + 1 }, view);
  const a = (u.x - o.x) / CELL, b = (u.y - o.y) / CELL;
  const c = (v.x - o.x) / CELL, d = (v.y - o.y) / CELL;
  return `matrix(${a} ${b} ${c} ${d} ${o.x} ${o.y})`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/projection.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/lib/projection.ts src/lib/projection.test.ts
git commit -m "feat: grid projection with rotation, top view, and plane matrix"
```

---

### Task 5: Model types and operations

**Files:**
- Create: `src/model/types.ts`, `src/model/ops.ts`
- Test: `src/model/ops.test.ts`

**Interfaces:**
- Consumes: `uid()` from `src/lib/ids.ts`, `PRESETS` from `src/lib/color.ts`, `Point`, `Rotation`, `ViewState` from `src/lib/projection.ts`.
- Produces: the `Doc`/`Element` types below and ops: `addElement(els, el): Element[]`, `moveElements(els, ids, dx, dy): Element[]`, `deleteElements(els, ids): Element[]` (cascades to connectors touching deleted endpoints and tags attached to deleted elements), `duplicateElements(els, ids): { elements, newIds }` (offsets clones by +1,+1; remaps internal connector endpoints/attachments), `anchorOf(el): Point | null` (null for connectors), `updateElement(els, id, patch): Element[]`, `createFromPlacing(placing: string, cell: Point): Element`.
- Placing string values: `asset:<assetId>`, `floor`, `tag:bubble`, `tag:tips`, `text:plain`, `text:callout`.

- [ ] **Step 1: Write src/model/types.ts**

```ts
import type { Rotation } from '../lib/projection';

export interface Camera { x: number; y: number; zoom: number }

export interface Doc {
  id: string;
  name: string;
  schemaVersion: 1;
  view: { rotation: Rotation; mode: 'iso' | 'top' };
  camera: Camera;
  elements: Element[];
}

export interface AssetEl {
  kind: 'asset'; id: string;
  gridX: number; gridY: number;
  assetId: string;
  color: string;
}

export interface FloorEl {
  kind: 'floor'; id: string;
  gridX: number; gridY: number;
  width: number; depth: number;
  corners: 'sharp' | 'rounded' | 'pill';
  color: string;
}

export interface ConnectorEl {
  kind: 'connector'; id: string;
  fromId: string; toId: string;
  style: 'solid' | 'dashed' | 'dotted';
  color: string;
  label?: string;
}

export interface TagEl {
  kind: 'tag'; id: string;
  attachedTo?: string;
  gridX: number; gridY: number;
  text: string; color: string;
  style: 'bubble' | 'tips';
  icon?: string;
}

export interface TextEl {
  kind: 'text'; id: string;
  gridX: number; gridY: number;
  content: string;
  title?: string;
  variant: 'plain' | 'callout';
}

export type Element = AssetEl | FloorEl | ConnectorEl | TagEl | TextEl;
```

- [ ] **Step 2: Write the failing test**

`src/model/ops.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { AssetEl, ConnectorEl, Element, TagEl } from './types';
import {
  addElement, anchorOf, createFromPlacing, deleteElements, duplicateElements,
  moveElements, updateElement,
} from './ops';

const asset = (id: string, x = 0, y = 0): AssetEl =>
  ({ kind: 'asset', id, gridX: x, gridY: y, assetId: 'cube-plain', color: '#618AFF' });
const conn = (id: string, fromId: string, toId: string): ConnectorEl =>
  ({ kind: 'connector', id, fromId, toId, style: 'solid', color: '#425066' });

describe('ops', () => {
  it('addElement appends without mutating', () => {
    const els: Element[] = [];
    const next = addElement(els, asset('a'));
    expect(next).toHaveLength(1);
    expect(els).toHaveLength(0);
  });

  it('moveElements shifts targeted movable elements only', () => {
    const els = [asset('a', 1, 1), asset('b', 5, 5)];
    const next = moveElements(els, ['a'], 2, -1);
    expect(next[0]).toMatchObject({ gridX: 3, gridY: 0 });
    expect(next[1]).toMatchObject({ gridX: 5, gridY: 5 });
  });

  it('deleteElements cascades to connectors and attached tags', () => {
    const tag: TagEl = { kind: 'tag', id: 't', attachedTo: 'a', gridX: 0, gridY: 0, text: 'x', color: '#fff', style: 'bubble' };
    const els: Element[] = [asset('a'), asset('b'), conn('c', 'a', 'b'), tag];
    const next = deleteElements(els, ['a']);
    expect(next.map((e) => e.id)).toEqual(['b']);
  });

  it('duplicateElements clones with new ids, +1/+1 offset, remapped connectors', () => {
    const els: Element[] = [asset('a', 0, 0), asset('b', 2, 0), conn('c', 'a', 'b')];
    const { elements, newIds } = duplicateElements(els, ['a', 'b', 'c']);
    expect(elements).toHaveLength(6);
    expect(newIds).toHaveLength(3);
    const clones = elements.slice(3);
    const cloneA = clones.find((e) => e.kind === 'asset' && e.gridX === 1 && e.gridY === 1)!;
    const cloneConn = clones.find((e) => e.kind === 'connector') as ConnectorEl;
    expect(cloneConn.fromId).toBe(cloneA.id);
    expect(cloneConn.fromId).not.toBe('a');
  });

  it('duplicateElements drops connectors whose endpoints are not duplicated', () => {
    const els: Element[] = [asset('a'), asset('b'), conn('c', 'a', 'b')];
    const { elements } = duplicateElements(els, ['a', 'c']);
    expect(elements.filter((e) => e.kind === 'connector')).toHaveLength(1);
  });

  it('anchorOf centers floors and returns null for connectors', () => {
    const floor: Element = { kind: 'floor', id: 'f', gridX: 2, gridY: 4, width: 4, depth: 3, corners: 'sharp', color: '#fff' };
    expect(anchorOf(floor)).toEqual({ x: 3.5, y: 5 });
    expect(anchorOf(conn('c', 'a', 'b'))).toBeNull();
  });

  it('updateElement patches one element by id', () => {
    const next = updateElement([asset('a')], 'a', { color: '#ff0000' });
    expect((next[0] as AssetEl).color).toBe('#ff0000');
  });

  it('createFromPlacing builds each element kind at the cell', () => {
    expect(createFromPlacing('asset:cube-server', { x: 2, y: 3 })).toMatchObject({
      kind: 'asset', assetId: 'cube-server', gridX: 2, gridY: 3,
    });
    expect(createFromPlacing('floor', { x: 0, y: 0 })).toMatchObject({ kind: 'floor', width: 4, depth: 3 });
    expect(createFromPlacing('tag:bubble', { x: 0, y: 0 })).toMatchObject({ kind: 'tag', style: 'bubble' });
    expect(createFromPlacing('tag:tips', { x: 0, y: 0 })).toMatchObject({ kind: 'tag', style: 'tips' });
    expect(createFromPlacing('text:callout', { x: 0, y: 0 })).toMatchObject({ kind: 'text', variant: 'callout' });
    expect(createFromPlacing('text:plain', { x: 0, y: 0 })).toMatchObject({ kind: 'text', variant: 'plain' });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/model/ops.test.ts`
Expected: FAIL — cannot resolve `./ops`.

- [ ] **Step 4: Write src/model/ops.ts**

```ts
import { PRESETS } from '../lib/color';
import { uid } from '../lib/ids';
import type { Point } from '../lib/projection';
import type { Element } from './types';

export function addElement(els: Element[], el: Element): Element[] {
  return [...els, el];
}

export function moveElements(els: Element[], ids: string[], dx: number, dy: number): Element[] {
  const set = new Set(ids);
  return els.map((el) => {
    if (!set.has(el.id) || el.kind === 'connector') return el;
    return { ...el, gridX: el.gridX + dx, gridY: el.gridY + dy };
  });
}

export function deleteElements(els: Element[], ids: string[]): Element[] {
  const dead = new Set(ids);
  for (const el of els) {
    if (el.kind === 'connector' && (dead.has(el.fromId) || dead.has(el.toId))) dead.add(el.id);
    if (el.kind === 'tag' && el.attachedTo && dead.has(el.attachedTo)) dead.add(el.id);
  }
  return els.filter((el) => !dead.has(el.id));
}

export function duplicateElements(
  els: Element[], ids: string[],
): { elements: Element[]; newIds: string[] } {
  const idSet = new Set(ids);
  const map = new Map<string, string>();
  for (const el of els) if (idSet.has(el.id)) map.set(el.id, uid());
  const clones: Element[] = [];
  for (const el of els) {
    if (!idSet.has(el.id)) continue;
    if (el.kind === 'connector') {
      if (!map.has(el.fromId) || !map.has(el.toId)) continue;
      clones.push({ ...el, id: map.get(el.id)!, fromId: map.get(el.fromId)!, toId: map.get(el.toId)! });
    } else {
      const clone = { ...el, id: map.get(el.id)!, gridX: el.gridX + 1, gridY: el.gridY + 1 };
      if (clone.kind === 'tag' && clone.attachedTo) clone.attachedTo = map.get(clone.attachedTo);
      clones.push(clone);
    }
  }
  return { elements: [...els, ...clones], newIds: clones.map((c) => c.id) };
}

export function anchorOf(el: Element): Point | null {
  switch (el.kind) {
    case 'connector': return null;
    case 'floor': return { x: el.gridX + (el.width - 1) / 2, y: el.gridY + (el.depth - 1) / 2 };
    default: return { x: el.gridX, y: el.gridY };
  }
}

export function updateElement(els: Element[], id: string, patch: Partial<Element>): Element[] {
  return els.map((el) => (el.id === id ? ({ ...el, ...patch } as Element) : el));
}

export function createFromPlacing(placing: string, cell: Point): Element {
  const base = { id: uid(), gridX: cell.x, gridY: cell.y };
  if (placing.startsWith('asset:')) {
    return { kind: 'asset', ...base, assetId: placing.slice(6), color: PRESETS.blue };
  }
  switch (placing) {
    case 'floor':
      return { kind: 'floor', ...base, width: 4, depth: 3, corners: 'sharp', color: PRESETS.gray };
    case 'tag:bubble':
      return { kind: 'tag', ...base, text: 'Label', color: '#3479FF', style: 'bubble' };
    case 'tag:tips':
      return { kind: 'tag', ...base, text: 'Tip', color: '#FFFFFF', style: 'tips' };
    case 'text:callout':
      return { kind: 'text', ...base, title: 'Title', content: 'This is a short piece of text.', variant: 'callout' };
    default:
      return { kind: 'text', ...base, content: 'Text', variant: 'plain' };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/model/ops.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck
git add src/model
git commit -m "feat: document model types and pure element operations"
```

---

### Task 6: localStorage persistence

**Files:**
- Create: `src/storage/local.ts`
- Test: `src/storage/local.test.ts`

**Interfaces:**
- Consumes: `Doc` from `src/model/types.ts`, `uid()`.
- Produces: `interface DocMeta { id; name; updatedAt }`, `listDocs(): DocMeta[]` (most recently updated first), `createDoc(name?): Doc`, `saveDoc(doc): void`, `loadDoc(id): Doc | null`, `deleteDoc(id): void`, `renameDoc(id, name): void`.

- [ ] **Step 1: Write the failing test**

`src/storage/local.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createDoc, deleteDoc, listDocs, loadDoc, renameDoc, saveDoc } from './local';

describe('storage/local', () => {
  beforeEach(() => localStorage.clear());

  it('createDoc persists a loadable empty doc and indexes it', () => {
    const doc = createDoc('My canvas');
    expect(loadDoc(doc.id)).toEqual(doc);
    expect(listDocs()).toMatchObject([{ id: doc.id, name: 'My canvas' }]);
    expect(doc).toMatchObject({
      schemaVersion: 1,
      view: { rotation: 0, mode: 'iso' },
      camera: { x: 0, y: 0, zoom: 1 },
      elements: [],
    });
  });

  it('saveDoc updates the index entry (name, most-recent-first order)', () => {
    const a = createDoc('A');
    const b = createDoc('B');
    saveDoc({ ...a, name: 'A2' });
    const metas = listDocs();
    expect(metas[0]).toMatchObject({ id: a.id, name: 'A2' });
    expect(metas[1]).toMatchObject({ id: b.id });
  });

  it('deleteDoc removes doc and index entry', () => {
    const doc = createDoc('X');
    deleteDoc(doc.id);
    expect(loadDoc(doc.id)).toBeNull();
    expect(listDocs()).toHaveLength(0);
  });

  it('renameDoc renames doc and index', () => {
    const doc = createDoc('Old');
    renameDoc(doc.id, 'New');
    expect(loadDoc(doc.id)?.name).toBe('New');
    expect(listDocs()[0].name).toBe('New');
  });

  it('loadDoc returns null for unknown ids and corrupt JSON', () => {
    expect(loadDoc('nope')).toBeNull();
    localStorage.setItem('blueprint:doc:bad', '{oops');
    expect(loadDoc('bad')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/storage/local.test.ts`
Expected: FAIL — cannot resolve `./local`.

- [ ] **Step 3: Write src/storage/local.ts**

```ts
import { uid } from '../lib/ids';
import type { Doc } from '../model/types';

export interface DocMeta { id: string; name: string; updatedAt: number }

const INDEX_KEY = 'blueprint:index';
const docKey = (id: string) => `blueprint:doc:${id}`;

export function listDocs(): DocMeta[] {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]') as DocMeta[];
  } catch {
    return [];
  }
}

function writeIndex(metas: DocMeta[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(metas));
}

export function saveDoc(doc: Doc): void {
  localStorage.setItem(docKey(doc.id), JSON.stringify(doc));
  const rest = listDocs().filter((m) => m.id !== doc.id);
  writeIndex([{ id: doc.id, name: doc.name, updatedAt: Date.now() }, ...rest]);
}

export function createDoc(name = 'Untitled'): Doc {
  const doc: Doc = {
    id: uid(),
    name,
    schemaVersion: 1,
    view: { rotation: 0, mode: 'iso' },
    camera: { x: 0, y: 0, zoom: 1 },
    elements: [],
  };
  saveDoc(doc);
  return doc;
}

export function loadDoc(id: string): Doc | null {
  const raw = localStorage.getItem(docKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Doc;
  } catch {
    return null;
  }
}

export function deleteDoc(id: string): void {
  localStorage.removeItem(docKey(id));
  writeIndex(listDocs().filter((m) => m.id !== id));
}

export function renameDoc(id: string, name: string): void {
  const doc = loadDoc(id);
  if (doc) saveDoc({ ...doc, name });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/storage/local.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/storage
git commit -m "feat: localStorage document persistence with index"
```

---

### Task 7: Document store (Zustand) with undo/redo

**Files:**
- Create: `src/store/docStore.ts`, `src/store/appStore.ts`
- Test: `src/store/docStore.test.ts`

**Interfaces:**
- Consumes: storage functions, model ops, `Doc`/`Element`, `ViewState`, `Camera`.
- Produces:
  - `useAppStore`: `{ docId: string | null; openDoc(id): void; goHome(): void }`.
  - `useDocStore` state: `{ doc, selection: string[], placing: string | null, tool: 'select'|'connect', connectFrom: string | null }` and actions: `openDoc(id)`, `closeDoc()`, `setName(name)`, `setView(view)`, `setCamera(camera)`, `apply(fn)` (history), `applyTransient(fn)` (no history), `beginTransient()`, `commitTransient()`, `undo()`, `redo()`, `select(ids)`, `setPlacing(p)`, `setTool(t)`, `setConnectFrom(id)`.
  - History semantics: `apply` pushes the previous elements onto `past` (cap 50) and clears `future`. Drags call `beginTransient` → N× `applyTransient` → `commitTransient` (one history entry total). Camera/name/view changes are never in history.

- [ ] **Step 1: Write the failing test**

`src/store/docStore.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createDoc } from '../storage/local';
import { addElement } from '../model/ops';
import type { AssetEl } from '../model/types';
import { useDocStore } from './docStore';

const asset = (id: string): AssetEl =>
  ({ kind: 'asset', id, gridX: 0, gridY: 0, assetId: 'cube-plain', color: '#618AFF' });

describe('docStore', () => {
  beforeEach(() => {
    localStorage.clear();
    const doc = createDoc('T');
    useDocStore.getState().openDoc(doc.id);
  });

  it('apply mutates elements and enables undo/redo', () => {
    const s = () => useDocStore.getState();
    s().apply((els) => addElement(els, asset('a')));
    expect(s().doc?.elements).toHaveLength(1);
    s().undo();
    expect(s().doc?.elements).toHaveLength(0);
    s().redo();
    expect(s().doc?.elements).toHaveLength(1);
  });

  it('transient batch collapses to a single undo step', () => {
    const s = () => useDocStore.getState();
    s().apply((els) => addElement(els, asset('a')));
    s().beginTransient();
    s().applyTransient((els) => addElement(els, asset('b')));
    s().applyTransient((els) => addElement(els, asset('c')));
    s().commitTransient();
    expect(s().doc?.elements).toHaveLength(3);
    s().undo();
    expect(s().doc?.elements).toHaveLength(1);
  });

  it('a new apply clears the redo stack', () => {
    const s = () => useDocStore.getState();
    s().apply((els) => addElement(els, asset('a')));
    s().undo();
    s().apply((els) => addElement(els, asset('b')));
    s().redo();
    expect(s().doc?.elements.map((e) => e.id)).toEqual(['b']);
  });

  it('setView and setCamera do not touch history', () => {
    const s = () => useDocStore.getState();
    s().setView({ rotation: 1, mode: 'top' });
    s().setCamera({ x: 10, y: 20, zoom: 2 });
    s().undo();
    expect(s().doc?.view).toEqual({ rotation: 1, mode: 'top' });
    expect(s().doc?.camera).toEqual({ x: 10, y: 20, zoom: 2 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/docStore.test.ts`
Expected: FAIL — cannot resolve `./docStore`.

- [ ] **Step 3: Write the stores**

`src/store/appStore.ts`:
```ts
import { create } from 'zustand';

interface AppState {
  docId: string | null;
  openDoc: (id: string) => void;
  goHome: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  docId: null,
  openDoc: (docId) => set({ docId }),
  goHome: () => set({ docId: null }),
}));
```

`src/store/docStore.ts`:
```ts
import { create } from 'zustand';
import { loadDoc, saveDoc } from '../storage/local';
import type { Camera, Doc, Element } from '../model/types';
import type { ViewState } from '../lib/projection';

export type Tool = 'select' | 'connect';

interface DocState {
  doc: Doc | null;
  selection: string[];
  placing: string | null;
  tool: Tool;
  connectFrom: string | null;
  past: Element[][];
  future: Element[][];
  snapshot: Element[] | null;
  openDoc: (id: string) => void;
  closeDoc: () => void;
  setName: (name: string) => void;
  setView: (view: ViewState) => void;
  setCamera: (camera: Camera) => void;
  apply: (fn: (els: Element[]) => Element[]) => void;
  applyTransient: (fn: (els: Element[]) => Element[]) => void;
  beginTransient: () => void;
  commitTransient: () => void;
  undo: () => void;
  redo: () => void;
  select: (ids: string[]) => void;
  setPlacing: (placing: string | null) => void;
  setTool: (tool: Tool) => void;
  setConnectFrom: (id: string | null) => void;
}

const HISTORY_CAP = 50;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function persistSoon(doc: Doc): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveDoc(doc), 300);
}

export const useDocStore = create<DocState>((set, get) => ({
  doc: null,
  selection: [],
  placing: null,
  tool: 'select',
  connectFrom: null,
  past: [],
  future: [],
  snapshot: null,

  openDoc: (id) => set({
    doc: loadDoc(id), selection: [], placing: null, tool: 'select',
    connectFrom: null, past: [], future: [], snapshot: null,
  }),

  closeDoc: () => {
    const { doc } = get();
    if (doc) { clearTimeout(saveTimer); saveDoc(doc); }
    set({ doc: null, selection: [], past: [], future: [], snapshot: null });
  },

  setName: (name) => {
    const { doc } = get();
    if (!doc) return;
    const next = { ...doc, name };
    persistSoon(next);
    set({ doc: next });
  },

  setView: (view) => {
    const { doc } = get();
    if (!doc) return;
    const next = { ...doc, view };
    persistSoon(next);
    set({ doc: next });
  },

  setCamera: (camera) => {
    const { doc } = get();
    if (!doc) return;
    const next = { ...doc, camera };
    persistSoon(next);
    set({ doc: next });
  },

  apply: (fn) => {
    const { doc } = get();
    if (!doc) return;
    const elements = fn(doc.elements);
    if (elements === doc.elements) return;
    const next = { ...doc, elements };
    persistSoon(next);
    set((s) => ({ doc: next, past: [...s.past.slice(-(HISTORY_CAP - 1)), doc.elements], future: [] }));
  },

  applyTransient: (fn) => {
    const { doc } = get();
    if (!doc) return;
    const next = { ...doc, elements: fn(doc.elements) };
    persistSoon(next);
    set({ doc: next });
  },

  beginTransient: () => set((s) => ({ snapshot: s.doc?.elements ?? null })),

  commitTransient: () => set((s) => {
    const { snapshot } = s;
    if (!snapshot || !s.doc || snapshot === s.doc.elements) return { snapshot: null };
    return {
      snapshot: null,
      past: [...s.past.slice(-(HISTORY_CAP - 1)), snapshot],
      future: [],
    };
  }),

  undo: () => set((s) => {
    if (!s.doc || s.past.length === 0) return {};
    const prev = s.past[s.past.length - 1];
    const doc = { ...s.doc, elements: prev };
    persistSoon(doc);
    return { doc, past: s.past.slice(0, -1), future: [s.doc.elements, ...s.future], selection: [] };
  }),

  redo: () => set((s) => {
    if (!s.doc || s.future.length === 0) return {};
    const next = s.future[0];
    const doc = { ...s.doc, elements: next };
    persistSoon(doc);
    return { doc, past: [...s.past, s.doc.elements], future: s.future.slice(1), selection: [] };
  }),

  select: (selection) => set({ selection }),
  setPlacing: (placing) => set({ placing, tool: 'select', connectFrom: null }),
  setTool: (tool) => set({ tool, placing: null, connectFrom: null }),
  setConnectFrom: (connectFrom) => set({ connectFrom }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/docStore.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add src/store
git commit -m "feat: document store with undo/redo and debounced persistence"
```

---

### Task 8: App shell and Home screen

**Files:**
- Modify: `src/App.tsx`, `src/styles.css`
- Create: `src/components/Home.tsx`, `src/components/Editor.tsx` (placeholder shell for now)
- Test: `src/components/Home.test.tsx`

**Interfaces:**
- Consumes: `useAppStore`, `useDocStore`, storage functions.
- Produces: `Home` (canvas gallery), `Editor({ docId }: { docId: string })` — this task ships only the Editor's outer shell (top bar placeholder + empty main area); Tasks 9–14 fill it in.

- [ ] **Step 1: Write the failing test**

`src/components/Home.test.tsx`:
```tsx
import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createDoc } from '../storage/local';
import { useAppStore } from '../store/appStore';
import { Home } from './Home';

describe('Home', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    useAppStore.setState({ docId: null });
  });

  it('lists existing canvases', () => {
    createDoc('Payments infra');
    render(<Home />);
    expect(screen.getByText('Payments infra')).toBeTruthy();
  });

  it('creates and opens a new canvas', () => {
    render(<Home />);
    fireEvent.click(screen.getByText('New canvas'));
    expect(useAppStore.getState().docId).toBeTruthy();
  });

  it('opens a canvas on card click', () => {
    const doc = createDoc('Target');
    render(<Home />);
    fireEvent.click(screen.getByText('Target'));
    expect(useAppStore.getState().docId).toBe(doc.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/Home.test.tsx`
Expected: FAIL — cannot resolve `./Home`.

- [ ] **Step 3: Write Home, Editor shell, App**

`src/components/Home.tsx`:
```tsx
import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { createDoc, deleteDoc, listDocs, renameDoc } from '../storage/local';
import { useAppStore } from '../store/appStore';

export function Home() {
  const [docs, setDocs] = useState(() => listDocs());
  const openDoc = useAppStore((s) => s.openDoc);

  const refresh = () => setDocs(listDocs());

  return (
    <div className="bp-home">
      <header className="bp-home-header">
        <h1>Blueprint</h1>
        <button
          className="bp-btn bp-btn-primary"
          onClick={() => openDoc(createDoc().id)}
        >
          <Plus size={16} /> New canvas
        </button>
      </header>
      {docs.length === 0 ? (
        <p className="bp-empty">No canvases yet. Create one to get started.</p>
      ) : (
        <div className="bp-cards">
          {docs.map((m) => (
            <div key={m.id} className="bp-card" onClick={() => openDoc(m.id)}>
              <div className="bp-card-name">{m.name}</div>
              <div className="bp-card-date">
                {new Date(m.updatedAt).toLocaleString()}
              </div>
              <div className="bp-card-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="bp-icon-btn"
                  title="Rename"
                  onClick={() => {
                    const name = window.prompt('Canvas name', m.name);
                    if (name) { renameDoc(m.id, name); refresh(); }
                  }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="bp-icon-btn"
                  title="Delete"
                  onClick={() => {
                    if (window.confirm(`Delete "${m.name}"?`)) { deleteDoc(m.id); refresh(); }
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

`src/components/Editor.tsx` (shell only — filled in by later tasks):
```tsx
import { useEffect } from 'react';
import { useDocStore } from '../store/docStore';

export function Editor({ docId }: { docId: string }) {
  const doc = useDocStore((s) => s.doc);
  const openDoc = useDocStore((s) => s.openDoc);
  const closeDoc = useDocStore((s) => s.closeDoc);

  useEffect(() => {
    openDoc(docId);
    return () => closeDoc();
  }, [docId, openDoc, closeDoc]);

  if (!doc) return <div className="bp-loading">Loading…</div>;

  return (
    <div className="bp-editor">
      <div className="bp-topbar">{doc.name}</div>
      <div className="bp-body" />
    </div>
  );
}
```

`src/App.tsx`:
```tsx
import { useAppStore } from './store/appStore';
import { Editor } from './components/Editor';
import { Home } from './components/Home';

export function App() {
  const docId = useAppStore((s) => s.docId);
  return docId ? <Editor docId={docId} key={docId} /> : <Home />;
}
```

- [ ] **Step 4: Add layout styles**

Append to `src/styles.css`:
```css
button { font: inherit; cursor: pointer; }
.bp-btn { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #d4dae6; background: #fff; border-radius: 8px; padding: 8px 14px; }
.bp-btn-primary { background: #3479ff; border-color: #3479ff; color: #fff; }
.bp-icon-btn { display: inline-flex; padding: 6px; border: none; background: transparent; border-radius: 6px; color: #5a6579; }
.bp-icon-btn:hover { background: #eef1f7; }
.bp-home { max-width: 960px; margin: 0 auto; padding: 40px 24px; }
.bp-home-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.bp-home-header h1 { font-size: 22px; margin: 0; }
.bp-empty { color: #8a93a6; }
.bp-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.bp-card { position: relative; background: #fff; border: 1px solid #e3e8f2; border-radius: 12px; padding: 16px; cursor: pointer; }
.bp-card:hover { border-color: #3479ff; }
.bp-card-name { font-weight: 600; margin-bottom: 4px; }
.bp-card-date { font-size: 12px; color: #8a93a6; }
.bp-card-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 2px; }
.bp-editor { display: flex; flex-direction: column; height: 100%; }
.bp-topbar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #fff; border-bottom: 1px solid #e3e8f2; }
.bp-body { display: flex; flex: 1; min-height: 0; }
.bp-loading { padding: 40px; color: #8a93a6; }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/Home.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Verify manually**

Run: `npm run dev` — create a canvas from Home, see the editor shell with the doc name; reload → Home lists it; rename and delete work. Stop server.

- [ ] **Step 7: Typecheck and commit**

```bash
npm run typecheck && npm test
git add src
git commit -m "feat: app shell, home screen with canvas CRUD, editor shell"
```

---

### Task 9: Scene renderer + canvas with camera (assets render in iso)

**Files:**
- Create: `src/lib/assetInstance.ts`, `src/components/Scene.tsx`, `src/components/Grid.tsx`, `src/components/CanvasView.tsx`, `src/components/shapes/AssetShape.tsx`
- Modify: `src/components/Editor.tsx`, `src/styles.css`
- Test: `src/lib/assetInstance.test.ts`

**Interfaces:**
- Consumes: `ASSETS`/`AssetDef` from `src/generated/assets.ts`, `derivePalette`, projection module, docStore.
- Produces:
  - `instanceMarkup(def: AssetDef, instanceId: string, color: string): string` — replaces `__BP__` with `<instanceId>-` and the 9 kit hexes (case-insensitive) with the derived palette. Memoized.
  - `Scene({ elements, view, selection?, onElementPointerDown?, onElementDoubleClick?, ghost? })` — pure layered renderer usable by both CanvasView and export. Layers: floors → connectors → assets (sorted by `depth(anchor)` in iso) → tags → texts → ghost.
  - `AssetShape({ el, view, selected?, onPointerDown?, ... })` — artwork anchor convention: the kit's 120×120 art has its base-diamond center at (60, 85); the shape translates by `(pt.x - 60, pt.y - 85)`.
  - `CanvasView()` — full-viewport SVG. Camera transform `translate(cam.x cam.y) scale(cam.zoom)`. Wheel = pan; ⌘/ctrl+wheel = zoom to cursor (clamped 0.2–4). Drag on empty canvas = pan. `toWorld`/`cellAt` helpers.
  - Placeholder no-op interactions on elements for now (selection/move arrive in Task 10).

- [ ] **Step 1: Write the failing test**

`src/lib/assetInstance.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { AssetDef } from '../generated/assets';
import { instanceMarkup } from './assetInstance';

const def: AssetDef = {
  id: 'demo', name: 'Demo', category: 'graphics', viewBox: '0 0 120 120',
  markup: '<path fill="#3258C2" stroke="url(#__BP__g1)"/><linearGradient id="__BP__g1"><stop stop-color="#618AFF"/></linearGradient>',
};

describe('instanceMarkup', () => {
  it('prefixes ids with the instance id', () => {
    const m = instanceMarkup(def, 'el42', '#618AFF');
    expect(m).toContain('id="el42-g1"');
    expect(m).toContain('url(#el42-g1)');
    expect(m).not.toContain('__BP__');
  });

  it('recolors the kit palette from the base color', () => {
    const m = instanceMarkup(def, 'el42', '#E05252');
    expect(m).not.toContain('#3258C2');
    expect(m).not.toContain('#618AFF');
  });

  it('keeps kit colors when base is the kit blue', () => {
    const m = instanceMarkup(def, 'el43', '#618AFF');
    expect(m.toLowerCase()).toContain('#618aff');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/assetInstance.test.ts`
Expected: FAIL — cannot resolve `./assetInstance`.

- [ ] **Step 3: Write src/lib/assetInstance.ts**

```ts
import { derivePalette } from './color';
import type { AssetDef } from '../generated/assets';

const cache = new Map<string, string>();

export function instanceMarkup(def: AssetDef, instanceId: string, color: string): string {
  const key = `${def.id}|${instanceId}|${color}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let m = def.markup.replaceAll('__BP__', `${instanceId}-`);
  for (const [ref, out] of Object.entries(derivePalette(color))) {
    m = m.replace(new RegExp(ref, 'gi'), out);
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, m);
  return m;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/assetInstance.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write AssetShape, Grid, Scene**

`src/components/shapes/AssetShape.tsx`:
```tsx
import type { PointerEvent } from 'react';
import { ASSETS } from '../../generated/assets';
import { instanceMarkup } from '../../lib/assetInstance';
import { project } from '../../lib/projection';
import type { ViewState } from '../../lib/projection';
import type { AssetEl } from '../../model/types';

export interface ShapeProps<T> {
  el: T;
  view: ViewState;
  selected?: boolean;
  onPointerDown?: (e: PointerEvent, id: string) => void;
  onDoubleClick?: (id: string) => void;
}

export function AssetShape({ el, view, selected, onPointerDown }: ShapeProps<AssetEl>) {
  const def = ASSETS[el.assetId];
  if (!def) return null;
  const pt = project({ x: el.gridX, y: el.gridY }, view);
  return (
    <g
      transform={`translate(${pt.x - 60} ${pt.y - 85})`}
      onPointerDown={(e) => onPointerDown?.(e, el.id)}
      style={onPointerDown ? { cursor: 'move' } : undefined}
    >
      <g dangerouslySetInnerHTML={{ __html: instanceMarkup(def, el.id, el.color) }} />
      {selected && (
        <rect x={2} y={-4} width={116} height={124} rx={10}
          fill="none" stroke="#7C5CFF" strokeWidth={1.5} strokeDasharray="5 4" />
      )}
    </g>
  );
}
```
(Note: Task 11 adds the top-view branch to this component.)

`src/components/Grid.tsx`:
```tsx
import { project } from '../lib/projection';
import type { ViewState } from '../lib/projection';

const R = 24;

export function Grid({ view }: { view: ViewState }) {
  const lines = [];
  for (let i = -R; i <= R; i++) {
    const b = i + 0.5;
    const p1 = project({ x: b, y: -R }, view);
    const p2 = project({ x: b, y: R }, view);
    const q1 = project({ x: -R, y: b }, view);
    const q2 = project({ x: R, y: b }, view);
    lines.push(
      <line key={`x${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />,
      <line key={`y${i}`} x1={q1.x} y1={q1.y} x2={q2.x} y2={q2.y} />,
    );
  }
  return <g stroke="#e8ecf4" strokeWidth={1}>{lines}</g>;
}
```

`src/components/Scene.tsx`:
```tsx
import type { PointerEvent, ReactNode } from 'react';
import { depth } from '../lib/projection';
import type { ViewState } from '../lib/projection';
import { anchorOf } from '../model/ops';
import type { Element } from '../model/types';
import { AssetShape } from './shapes/AssetShape';

export interface SceneProps {
  elements: Element[];
  view: ViewState;
  selection?: Set<string>;
  onElementPointerDown?: (e: PointerEvent, id: string) => void;
  onElementDoubleClick?: (id: string) => void;
  ghost?: ReactNode;
}

export function Scene({
  elements, view, selection, onElementPointerDown, onElementDoubleClick, ghost,
}: SceneProps) {
  const assets = elements
    .filter((e) => e.kind === 'asset')
    .sort((a, b) => depth(anchorOf(a)!, view.rotation) - depth(anchorOf(b)!, view.rotation));
  const shared = {
    view,
    onPointerDown: onElementPointerDown,
    onDoubleClick: onElementDoubleClick,
  };
  return (
    <>
      {assets.map((el) => (
        <AssetShape key={el.id} el={el} selected={selection?.has(el.id)} {...shared} />
      ))}
      {ghost}
    </>
  );
}
```
(Note: Tasks 12–14 add the floor/connector/tag/text layers here.)

- [ ] **Step 6: Write CanvasView with camera**

`src/components/CanvasView.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react';
import { unproject } from '../lib/projection';
import type { Point } from '../lib/projection';
import { useDocStore } from '../store/docStore';
import { Grid } from './Grid';
import { Scene } from './Scene';

interface PanDrag { kind: 'pan'; sx: number; sy: number; cx: number; cy: number }
type Drag = PanDrag;

export function CanvasView() {
  const doc = useDocStore((s) => s.doc);
  const selection = useDocStore((s) => s.selection);
  const setCamera = useDocStore((s) => s.setCamera);
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const cam = doc?.camera ?? { x: 0, y: 0, zoom: 1 };

  const toWorld = (e: { clientX: number; clientY: number }): Point => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left - cam.x) / cam.zoom, y: (e.clientY - r.top - cam.y) / cam.zoom };
  };
  const cellAt = (e: { clientX: number; clientY: number }): Point => {
    const g = unproject(toWorld(e), doc!.view);
    return { x: Math.round(g.x), y: Math.round(g.y) };
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = useDocStore.getState();
      const d = s.doc;
      if (!d) return;
      const c = d.camera;
      if (e.ctrlKey || e.metaKey) {
        const r = svg.getBoundingClientRect();
        const px = e.clientX - r.left, py = e.clientY - r.top;
        const zoom = Math.min(4, Math.max(0.2, c.zoom * Math.exp(-e.deltaY * 0.002)));
        const k = zoom / c.zoom;
        s.setCamera({ x: px - (px - c.x) * k, y: py - (py - c.y) * k, zoom });
      } else {
        s.setCamera({ ...c, x: c.x - e.deltaX, y: c.y - e.deltaY });
      }
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  if (!doc) return null;

  return (
    <svg
      ref={svgRef}
      className="bp-canvas"
      onPointerDown={(e) => {
        (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
        setDrag({ kind: 'pan', sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y });
      }}
      onPointerMove={(e) => {
        if (drag?.kind === 'pan') {
          setCamera({ ...cam, x: drag.cx + e.clientX - drag.sx, y: drag.cy + e.clientY - drag.sy });
        }
      }}
      onPointerUp={() => setDrag(null)}
    >
      <g transform={`translate(${cam.x} ${cam.y}) scale(${cam.zoom})`}>
        <Grid view={doc.view} />
        <Scene elements={doc.elements} view={doc.view} selection={new Set(selection)} />
      </g>
    </svg>
  );
}
```
`cellAt` is unused until Task 10 — prefix it with `void cellAt;` OR export placement in Task 10; to keep tsc clean now, mark it: add line `void cellAt;` before the return. (Task 10 removes that line.)

- [ ] **Step 7: Wire Editor and styles**

In `src/components/Editor.tsx`, replace `<div className="bp-body" />` with:
```tsx
      <div className="bp-body">
        <CanvasView />
      </div>
```
and add `import { CanvasView } from './CanvasView';`.

Append to `src/styles.css`:
```css
.bp-canvas { flex: 1; display: block; background: #fbfcfe; touch-action: none; user-select: none; }
```

- [ ] **Step 8: Verify manually with seeded elements**

Run: `npm run dev`. In the browser devtools console of an open canvas, seed elements:
```js
const id = JSON.parse(localStorage.getItem('blueprint:index'))[0].id;
const raw = JSON.parse(localStorage.getItem('blueprint:doc:' + id));
raw.elements = [
  { kind: 'asset', id: 'a1', gridX: 0, gridY: 0, assetId: 'cube-server', color: '#618AFF' },
  { kind: 'asset', id: 'a2', gridX: 2, gridY: 0, assetId: 'cube-plain', color: '#E05252' },
  { kind: 'asset', id: 'a3', gridX: 0, gridY: 2, assetId: 'cube-tree', color: '#1FD9C6' },
];
localStorage.setItem('blueprint:doc:' + raw.id, JSON.stringify(raw));
location.reload();
```
Expected: three cubes on an iso grid — blue server, red cube, teal tree; red/teal look like proper kit shading (light top, dark outline). Two assets at different depths overlap correctly. Wheel pans; ⌘+wheel zooms toward cursor; dragging empty canvas pans.

- [ ] **Step 9: Typecheck, test, commit**

```bash
npm run typecheck && npm test
git add src
git commit -m "feat: SVG scene renderer with recolored kit assets and camera"
```

---

### Task 10: Palette, placement, selection, move, keyboard

**Files:**
- Create: `src/components/Palette.tsx`
- Modify: `src/components/CanvasView.tsx`, `src/components/Editor.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `ASSET_LIST`, `instanceMarkup`, docStore actions, model ops (`addElement`, `moveElements`, `deleteElements`, `duplicateElements`, `createFromPlacing`).
- Produces: `Palette()` — sidebar; clicking an entry arms `placing` (`asset:<id>`, `floor`, `tag:bubble`, `tag:tips`, `text:plain`, `text:callout`). CanvasView gains: ghost preview at hovered cell while placing; click to place (shift-click places repeatedly); element selection (click, shift-click multi); drag-move with grid snap as ONE undo step; keyboard: Delete/Backspace, ⌘Z, ⇧⌘Z, ⌘D, Escape.
- Produces for later tasks: `onElementPointerDown(e, id)` handler passed to Scene — Task 12 extends it for connect mode.

- [ ] **Step 1: Write Palette**

`src/components/Palette.tsx`:
```tsx
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
```

- [ ] **Step 2: Extend CanvasView with placement, selection, move, keys**

Replace `src/components/CanvasView.tsx` with:
```tsx
import { useEffect, useRef, useState } from 'react';
import { unproject } from '../lib/projection';
import type { Point } from '../lib/projection';
import {
  addElement, createFromPlacing, deleteElements, duplicateElements, moveElements,
} from '../model/ops';
import { useDocStore } from '../store/docStore';
import { Grid } from './Grid';
import { Scene } from './Scene';

interface PanDrag { kind: 'pan'; sx: number; sy: number; cx: number; cy: number }
interface MoveDrag { kind: 'move'; last: Point; ids: string[]; moved: boolean }
type Drag = PanDrag | MoveDrag;

export function CanvasView() {
  const doc = useDocStore((s) => s.doc);
  const selection = useDocStore((s) => s.selection);
  const placing = useDocStore((s) => s.placing);
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hoverCell, setHoverCell] = useState<Point | null>(null);

  const cam = doc?.camera ?? { x: 0, y: 0, zoom: 1 };

  const toWorld = (e: { clientX: number; clientY: number }): Point => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left - cam.x) / cam.zoom, y: (e.clientY - r.top - cam.y) / cam.zoom };
  };
  const cellAt = (e: { clientX: number; clientY: number }): Point => {
    const g = unproject(toWorld(e), doc!.view);
    return { x: Math.round(g.x), y: Math.round(g.y) };
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = useDocStore.getState();
      const d = s.doc;
      if (!d) return;
      const c = d.camera;
      if (e.ctrlKey || e.metaKey) {
        const r = svg.getBoundingClientRect();
        const px = e.clientX - r.left, py = e.clientY - r.top;
        const zoom = Math.min(4, Math.max(0.2, c.zoom * Math.exp(-e.deltaY * 0.002)));
        const k = zoom / c.zoom;
        s.setCamera({ x: px - (px - c.x) * k, y: py - (py - c.y) * k, zoom });
      } else {
        s.setCamera({ ...c, x: c.x - e.deltaX, y: c.y - e.deltaY });
      }
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      const s = useDocStore.getState();
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo(); else s.undo();
      } else if (meta && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (s.selection.length) {
          let created: string[] = [];
          s.apply((els) => {
            const r = duplicateElements(els, s.selection);
            created = r.newIds;
            return r.elements;
          });
          s.select(created);
        }
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (s.selection.length) {
          e.preventDefault();
          s.apply((els) => deleteElements(els, s.selection));
          s.select([]);
        }
      } else if (e.key === 'Escape') {
        s.setPlacing(null);
        s.setTool('select');
        s.select([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!doc) return null;
  const s = useDocStore.getState();

  const onElementPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    svgRef.current!.setPointerCapture(e.pointerId);
    if (placing) return;
    const el = doc.elements.find((x) => x.id === id);
    if (!el) return;
    const next = e.shiftKey
      ? selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id]
      : selection.includes(id) ? selection : [id];
    s.select(next);
    if (el.kind !== 'connector') {
      s.beginTransient();
      setDrag({ kind: 'move', last: cellAt(e), ids: next.length ? next : [id], moved: false });
    }
  };

  return (
    <svg
      ref={svgRef}
      className="bp-canvas"
      onPointerDown={(e) => {
        (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
        if (placing) {
          const cell = cellAt(e);
          s.apply((els) => addElement(els, createFromPlacing(placing, cell)));
          if (!e.shiftKey) s.setPlacing(null);
          return;
        }
        s.select([]);
        setDrag({ kind: 'pan', sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y });
      }}
      onPointerMove={(e) => {
        if (placing) { setHoverCell(cellAt(e)); return; }
        if (!drag) return;
        if (drag.kind === 'pan') {
          s.setCamera({ ...cam, x: drag.cx + e.clientX - drag.sx, y: drag.cy + e.clientY - drag.sy });
        } else {
          const c = cellAt(e);
          if (c.x !== drag.last.x || c.y !== drag.last.y) {
            s.applyTransient((els) => moveElements(els, drag.ids, c.x - drag.last.x, c.y - drag.last.y));
            setDrag({ ...drag, last: c, moved: true });
          }
        }
      }}
      onPointerUp={() => {
        if (drag?.kind === 'move') s.commitTransient();
        setDrag(null);
      }}
    >
      <g transform={`translate(${cam.x} ${cam.y}) scale(${cam.zoom})`}>
        <Grid view={doc.view} />
        <Scene
          elements={doc.elements}
          view={doc.view}
          selection={new Set(selection)}
          onElementPointerDown={onElementPointerDown}
          ghost={placing && hoverCell ? (
            <g opacity={0.5} style={{ pointerEvents: 'none' }}>
              <Scene elements={[createFromPlacing(placing, hoverCell)]} view={doc.view} />
            </g>
          ) : null}
        />
      </g>
    </svg>
  );
}
```
Note: the ghost creates a throwaway element each render — fine (pure data). `createFromPlacing` generates a fresh id per render; the ghost is never stored.

- [ ] **Step 3: Wire the Palette into Editor**

In `src/components/Editor.tsx` body:
```tsx
      <div className="bp-body">
        <Palette />
        <CanvasView />
      </div>
```
with `import { Palette } from './Palette';`.

- [ ] **Step 4: Add palette styles**

Append to `src/styles.css`:
```css
.bp-palette { width: 216px; background: #fff; border-right: 1px solid #e3e8f2; padding: 10px; overflow-y: auto; flex-shrink: 0; }
.bp-search { width: 100%; padding: 7px 10px; border: 1px solid #d4dae6; border-radius: 8px; margin-bottom: 10px; font: inherit; }
.bp-palette-section { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #8a93a6; margin: 10px 0 6px; }
.bp-palette-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.bp-palette-item { border: 1px solid transparent; background: transparent; border-radius: 8px; padding: 4px; }
.bp-palette-item:hover { background: #f0f4fb; }
.bp-palette-item.bp-active { border-color: #3479ff; background: #eaf1ff; }
.bp-palette-list { display: flex; flex-direction: column; gap: 2px; }
.bp-palette-row { display: flex; align-items: center; gap: 8px; border: 1px solid transparent; background: transparent; border-radius: 8px; padding: 7px 8px; text-align: left; }
.bp-palette-row:hover { background: #f0f4fb; }
.bp-palette-row.bp-active { border-color: #3479ff; background: #eaf1ff; }
```

- [ ] **Step 5: Verify manually**

Run: `npm run dev`. Expected:
- Sidebar shows 9 kit previews + building blocks; search filters.
- Click a graphic → ghost follows cursor snapped to grid → click places it; shift-click places several; Esc cancels.
- Click an element selects (dashed outline); shift-click adds to selection; drag moves the whole selection cell-by-cell; one ⌘Z undoes an entire drag.
- ⌘D duplicates offset by one cell; Delete removes; ⌘Z/⇧⌘Z cycle correctly.
- Reload — everything persisted.
(Floor/tag/text buttons place data but don't render yet — Tasks 12–14. Verify no crash when placing them: Scene simply skips unknown kinds.)

- [ ] **Step 6: Typecheck, test, commit**

```bash
npm run typecheck && npm test
git add src
git commit -m "feat: asset palette, placement with ghost, selection, drag-move, keyboard"
```

---

### Task 11: View controls — rotation and top view

**Files:**
- Create: `src/lib/topIcons.ts`, `src/components/shapes/TopTile.tsx`, `src/components/TopBar.tsx`
- Modify: `src/components/shapes/AssetShape.tsx`, `src/components/Editor.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `setView`, `ViewState`, `derivePalette`, `ASSETS`, lucide icons.
- Produces: `TOP_ICONS: Record<string, LucideIcon>` + `iconFor(assetId): LucideIcon`; `TopTile({ el, view, selected, onPointerDown })` (rounded tile + icon + label at the projected cell); `TopBar()` with back button, inline-editable name, rotate ⟲/⟳, iso/top segmented toggle, undo/redo buttons. Export buttons arrive in Task 15.

- [ ] **Step 1: Write src/lib/topIcons.ts**

```ts
import {
  Box, Boxes, Files, Layers, Network, Package, PcCase, Server,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const TOP_ICONS: Record<string, LucideIcon> = {
  'cube-plain': Box,
  'cube-server': Server,
  'cube-pc': PcCase,
  'cube-box': Package,
  'cube-documents': Files,
  'cube-monolith': Layers,
  'cube-infra': Boxes,
  'cube-infra-filled': Boxes,
  'cube-tree': Network,
};

export const iconFor = (assetId: string): LucideIcon => TOP_ICONS[assetId] ?? Box;
```

- [ ] **Step 2: Write TopTile and use it from AssetShape in top mode**

`src/components/shapes/TopTile.tsx`:
```tsx
import { ASSETS } from '../../generated/assets';
import { derivePalette } from '../../lib/color';
import { project } from '../../lib/projection';
import { iconFor } from '../../lib/topIcons';
import type { AssetEl } from '../../model/types';
import type { ShapeProps } from './AssetShape';

const S = 42;

export function TopTile({ el, view, selected, onPointerDown }: ShapeProps<AssetEl>) {
  const pt = project({ x: el.gridX, y: el.gridY }, view);
  const pal = derivePalette(el.color);
  const Icon = iconFor(el.assetId);
  const name = ASSETS[el.assetId]?.name ?? el.assetId;
  return (
    <g
      transform={`translate(${pt.x - S / 2} ${pt.y - S / 2})`}
      onPointerDown={(e) => onPointerDown?.(e, el.id)}
      style={onPointerDown ? { cursor: 'move' } : undefined}
    >
      <rect width={S} height={S} rx={10}
        fill={pal['#a3bbff']} stroke={pal['#3258c2']} strokeWidth={2} />
      <Icon x={9} y={9} width={24} height={24} color={pal['#3258c2']} />
      <text x={S / 2} y={S + 13} textAnchor="middle" fontSize={10} fill="#5a6579">{name}</text>
      {selected && (
        <rect x={-4} y={-4} width={S + 8} height={S + 8} rx={12}
          fill="none" stroke="#7C5CFF" strokeWidth={1.5} strokeDasharray="5 4" />
      )}
    </g>
  );
}
```

In `src/components/shapes/AssetShape.tsx`, add at the top of the component body (after the `def` guard):
```tsx
  if (view.mode === 'top') {
    return <TopTile el={el} view={view} selected={selected} onPointerDown={onPointerDown} />;
  }
```
with `import { TopTile } from './TopTile';`.

- [ ] **Step 3: Write TopBar**

`src/components/TopBar.tsx`:
```tsx
import { ArrowLeft, Redo2, RotateCcw, RotateCw, Undo2 } from 'lucide-react';
import type { Rotation } from '../lib/projection';
import { useAppStore } from '../store/appStore';
import { useDocStore } from '../store/docStore';

export function TopBar() {
  const doc = useDocStore((s) => s.doc);
  const setName = useDocStore((s) => s.setName);
  const setView = useDocStore((s) => s.setView);
  const undo = useDocStore((s) => s.undo);
  const redo = useDocStore((s) => s.redo);
  const goHome = useAppStore((s) => s.goHome);
  if (!doc) return null;
  const { view } = doc;
  const rotate = (steps: number) =>
    setView({ ...view, rotation: (((view.rotation + steps) % 4) + 4) % 4 as Rotation });

  return (
    <div className="bp-topbar">
      <button className="bp-icon-btn" title="All canvases" onClick={goHome}>
        <ArrowLeft size={16} />
      </button>
      <input
        className="bp-name"
        value={doc.name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="bp-topbar-spacer" />
      <button className="bp-icon-btn" title="Undo (⌘Z)" onClick={undo}><Undo2 size={16} /></button>
      <button className="bp-icon-btn" title="Redo (⇧⌘Z)" onClick={redo}><Redo2 size={16} /></button>
      <div className="bp-divider" />
      <button className="bp-icon-btn" title="Rotate left" onClick={() => rotate(-1)}>
        <RotateCcw size={16} />
      </button>
      <button className="bp-icon-btn" title="Rotate right" onClick={() => rotate(1)}>
        <RotateCw size={16} />
      </button>
      <div className="bp-seg">
        <button
          className={view.mode === 'iso' ? 'bp-seg-active' : ''}
          onClick={() => setView({ ...view, mode: 'iso' })}
        >Iso</button>
        <button
          className={view.mode === 'top' ? 'bp-seg-active' : ''}
          onClick={() => setView({ ...view, mode: 'top' })}
        >Top</button>
      </div>
    </div>
  );
}
```

In `src/components/Editor.tsx`, replace `<div className="bp-topbar">{doc.name}</div>` with `<TopBar />` (+ import).

- [ ] **Step 4: Styles**

Append to `src/styles.css`:
```css
.bp-name { border: 1px solid transparent; border-radius: 6px; padding: 5px 8px; font: inherit; font-weight: 600; width: 220px; background: transparent; }
.bp-name:hover, .bp-name:focus { border-color: #d4dae6; background: #fff; outline: none; }
.bp-topbar-spacer { flex: 1; }
.bp-divider { width: 1px; height: 20px; background: #e3e8f2; margin: 0 4px; }
.bp-seg { display: flex; border: 1px solid #d4dae6; border-radius: 8px; overflow: hidden; margin-left: 6px; }
.bp-seg button { border: none; background: #fff; padding: 6px 12px; font-size: 13px; }
.bp-seg .bp-seg-active { background: #3479ff; color: #fff; }
```

- [ ] **Step 5: Verify manually**

Run: `npm run dev` with a few placed assets. Expected:
- Rotate right: the whole arrangement rotates 90° (an element east of another moves south of it); artwork unchanged. Four clicks = back to start. Undo does NOT undo rotation.
- Top toggle: same elements as flat rounded tiles with the right lucide icon + name, on a square grid; rotation works there too; drag-move and selection still work in top view; placement ghost works in top view.
- Name edits persist after reload. Undo/redo buttons work.

- [ ] **Step 6: Typecheck, test, commit**

```bash
npm run typecheck && npm test
git add src
git commit -m "feat: 90-degree rotation and top-down view with lucide tiles"
```

---

### Task 12: Connectors

**Files:**
- Create: `src/components/shapes/ConnectorShape.tsx`
- Modify: `src/components/Scene.tsx`, `src/components/CanvasView.tsx`, `src/components/TopBar.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `anchorOf`, `project`, docStore (`tool`, `connectFrom`, `setTool`, `setConnectFrom`, `apply`), `addElement`, `uid`.
- Produces: `ConnectorShape({ el, elements, view, selected, onPointerDown, onDoubleClick })` — line between the projected anchors of `fromId`/`toId`, endpoints padded 38px (or len/3 if shorter), arrowhead marker `arrow-<el.id>`, dash styles solid/`10 6`/`0.1 9` (round caps), optional midpoint label pill, invisible 14px-wide hit line. Scene renders connectors between floors and assets. TopBar gains a Connect tool toggle (Spline icon); CanvasView handles connect-mode clicks: first element click sets `connectFrom` (highlight ring), second creates the connector and returns to select tool.

- [ ] **Step 1: Write ConnectorShape**

`src/components/shapes/ConnectorShape.tsx`:
```tsx
import { project } from '../../lib/projection';
import { anchorOf } from '../../model/ops';
import type { ConnectorEl, Element } from '../../model/types';
import type { ShapeProps } from './AssetShape';

interface ConnectorProps extends ShapeProps<ConnectorEl> {
  elements: Element[];
}

export function ConnectorShape({
  el, elements, view, selected, onPointerDown, onDoubleClick,
}: ConnectorProps) {
  const from = elements.find((x) => x.id === el.fromId);
  const to = elements.find((x) => x.id === el.toId);
  if (!from || !to) return null;
  const fa = anchorOf(from), ta = anchorOf(to);
  if (!fa || !ta) return null;
  const a = project(fa, view), b = project(ta, view);
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
  const pad = Math.min(38, len / 3);
  const A = { x: a.x + ux * pad, y: a.y + uy * pad };
  const B = { x: b.x - ux * pad, y: b.y - uy * pad };
  const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const dash = el.style === 'dashed' ? '10 6' : el.style === 'dotted' ? '0.1 9' : undefined;
  const markerId = `arrow-${el.id}`;
  const labelW = el.label ? el.label.length * 8 + 24 : 0;

  return (
    <g
      onPointerDown={(e) => onPointerDown?.(e, el.id)}
      onDoubleClick={() => onDoubleClick?.(el.id)}
      style={onPointerDown ? { cursor: 'pointer' } : undefined}
    >
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5"
          markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={el.color} />
        </marker>
      </defs>
      <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="transparent" strokeWidth={14} />
      <line
        x1={A.x} y1={A.y} x2={B.x} y2={B.y}
        stroke={selected ? '#7C5CFF' : el.color} strokeWidth={3}
        strokeDasharray={dash} strokeLinecap="round"
        markerEnd={`url(#${markerId})`}
      />
      {el.label && (
        <g transform={`translate(${mid.x} ${mid.y})`}>
          <rect x={-labelW / 2} y={-13} width={labelW} height={26} rx={13} fill={el.color} />
          <text y={4} textAnchor="middle" fontSize={12} fontWeight={700}
            fill="#ffffff" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            {el.label}
          </text>
        </g>
      )}
    </g>
  );
}
```

- [ ] **Step 2: Render connectors in Scene**

In `src/components/Scene.tsx`, add before the assets layer:
```tsx
      {elements.filter((e) => e.kind === 'connector').map((el) => (
        <ConnectorShape key={el.id} el={el} elements={elements}
          selected={selection?.has(el.id)} {...shared} />
      ))}
```
with `import { ConnectorShape } from './shapes/ConnectorShape';`.

- [ ] **Step 3: Add the Connect tool to TopBar**

In `src/components/TopBar.tsx`, next to undo/redo add:
```tsx
      <button
        className={`bp-icon-btn${tool === 'connect' ? ' bp-tool-active' : ''}`}
        title="Connect elements"
        onClick={() => setTool(tool === 'connect' ? 'select' : 'connect')}
      >
        <Spline size={16} />
      </button>
```
with `Spline` imported from lucide-react and `const tool = useDocStore((s) => s.tool); const setTool = useDocStore((s) => s.setTool);`.

Append to `src/styles.css`:
```css
.bp-tool-active { background: #eaf1ff; color: #3479ff; }
```

- [ ] **Step 4: Handle connect-mode clicks in CanvasView**

In `onElementPointerDown`, insert BEFORE the selection logic:
```tsx
    if (s.tool === 'connect') {
      const target = doc.elements.find((x) => x.id === id);
      if (!target || target.kind === 'connector') return;
      if (!s.connectFrom) {
        s.setConnectFrom(id);
      } else if (s.connectFrom !== id) {
        const fromId = s.connectFrom;
        s.apply((els) => addElement(els, {
          kind: 'connector', id: uid(), fromId, toId: id, style: 'solid', color: '#425066',
        }));
        s.setConnectFrom(null);
        s.setTool('select');
      }
      return;
    }
```
with `import { uid } from '../lib/ids';`. Also pass `connectFrom` into Scene's selection ring: change the Scene `selection` prop to `new Set(connectFrom ? [...selection, connectFrom] : selection)` and subscribe `const connectFrom = useDocStore((s) => s.connectFrom);`.

Connector double-click edits its label — add to CanvasView:
```tsx
  const onElementDoubleClick = (id: string) => {
    const el = doc.elements.find((x) => x.id === id);
    if (!el) return;
    if (el.kind === 'connector') {
      const label = window.prompt('Connector label (empty to remove)', el.label ?? '');
      if (label !== null) s.apply((els) => updateElement(els, id, { label: label || undefined }));
    }
  };
```
passed as `onElementDoubleClick={onElementDoubleClick}` on Scene, with `updateElement` imported from `../model/ops`. (Task 14 extends this handler for tags/texts.)

- [ ] **Step 5: Verify manually**

Run: `npm run dev`. Expected:
- Toggle Connect tool, click asset A (ring appears), click asset B → dark arrow from A to B, trimmed so it doesn't touch either shape, arrowhead at B; tool returns to select.
- Move A → the arrow follows. Rotate / switch to top view → the arrow re-routes between the new positions.
- Double-click the arrow → set label "TRANSFER" → dark pill at the midpoint.
- Click the arrow → selected (purple); Delete removes it. Deleting asset A removes its connectors too.
- Escape while a connect ring is showing cancels connect mode (already handled by the Escape key branch: `setTool('select')` clears `connectFrom`).

- [ ] **Step 6: Typecheck, test, commit**

```bash
npm run typecheck && npm test
git add src
git commit -m "feat: connector tool with arrows, dash styles, and labels"
```

---

### Task 13: Floors

**Files:**
- Create: `src/components/shapes/FloorShape.tsx`
- Modify: `src/components/Scene.tsx`

**Interfaces:**
- Consumes: `planeMatrix`, `derivePalette`, `CELL`.
- Produces: `FloorShape({ el, view, selected, onPointerDown })` — rounded/sharp/pill slab lying on the grid plane, with a 6px extruded edge in iso mode. Rendered as the bottom Scene layer. Sizing/corners editing arrives with the Inspector (Task 14).

- [ ] **Step 1: Write FloorShape**

`src/components/shapes/FloorShape.tsx`:
```tsx
import { CELL, planeMatrix } from '../../lib/projection';
import { derivePalette } from '../../lib/color';
import type { FloorEl } from '../../model/types';
import type { ShapeProps } from './AssetShape';

export function FloorShape({ el, view, selected, onPointerDown }: ShapeProps<FloorEl>) {
  const corner = { x: el.gridX - 0.5, y: el.gridY - 0.5 };
  const m = planeMatrix(corner, view);
  const w = el.width * CELL, d = el.depth * CELL;
  const rx = el.corners === 'pill' ? Math.min(w, d) / 2 : el.corners === 'rounded' ? 18 : 0;
  const pal = derivePalette(el.color);
  const thickness = view.mode === 'iso' ? 6 : 0;

  return (
    <g
      onPointerDown={(e) => onPointerDown?.(e, el.id)}
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
    </g>
  );
}
```

- [ ] **Step 2: Render floors as the bottom layer in Scene**

In `src/components/Scene.tsx`, add BEFORE the connectors layer:
```tsx
      {elements.filter((e) => e.kind === 'floor').map((el) => (
        <FloorShape key={el.id} el={el} selected={selection?.has(el.id)} {...shared} />
      ))}
```
with the import. Floors do not participate in asset depth sorting — they are always underneath.

- [ ] **Step 3: Verify manually**

Run: `npm run dev`. Expected:
- Place a Floor from the palette: a light 4×3 slab lies on the grid under the cursor cell; assets placed on top of it visually sit on the slab; the slab has a subtle darker 6px edge below (iso only).
- The default gray floor looks like the kit reference (near-white top, slightly darker edge). Recolor comes in Task 14.
- Rotate: the slab rotates with the diagram (a 4×3 slab becomes 3×4 visually). Top view: flat rectangle, no edge.
- Select and drag-move works; connectors can target floors (arrow anchors at slab center).

- [ ] **Step 4: Typecheck, test, commit**

```bash
npm run typecheck && npm test
git add src
git commit -m "feat: floor slabs with extruded edge and corner styles"
```

---

### Task 14: Tags, text, and the Inspector

**Files:**
- Create: `src/lib/wrap.ts`, `src/components/shapes/TagShape.tsx`, `src/components/shapes/TextShape.tsx`, `src/components/Inspector.tsx`
- Modify: `src/components/Scene.tsx`, `src/components/CanvasView.tsx`, `src/components/Editor.tsx`, `src/styles.css`
- Test: `src/lib/wrap.test.ts`

**Interfaces:**
- Consumes: `planeMatrix`, `project`, `hexToHsl`, `PRESETS`, `updateElement`, `icons` map from lucide-react, docStore.
- Produces:
  - `wrapText(text: string, maxChars?: number): string[]` (default 30; greedy word wrap; never returns empty array for non-empty text).
  - `TagShape` — bubble pill skewed onto the plane in iso (`planeMatrix`), screen-aligned in top view; tips style = small white/dark tooltip box with pointer, always screen-aligned. Text color auto-contrasts (light text on dark fills via `hexToHsl(color).l > 0.7`).
  - `TextShape` — plain: dark 14px text at the projected point; callout: white card (240px wide) with optional bold title and wrapped body, always screen-aligned.
  - `Inspector()` — floating panel (top-right of canvas area) when selection is non-empty: color presets (gray/blue/teal) + free `<input type="color">` applied to every selected element that has a `color`; single floor: width/depth steppers (1–12) and corners select; single connector: style segmented control; single tag with bubble style: icon name text input (lucide PascalCase, empty = none); Delete button.
  - CanvasView `onElementDoubleClick` extended: tag → prompt for text; text → prompt for content (and title when callout).

- [ ] **Step 1: Write the failing wrap test**

`src/lib/wrap.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { wrapText } from './wrap';

describe('wrapText', () => {
  it('keeps short text on one line', () => {
    expect(wrapText('hello world')).toEqual(['hello world']);
  });
  it('wraps greedily at the limit', () => {
    expect(wrapText('aaa bbb ccc', 7)).toEqual(['aaa bbb', 'ccc']);
  });
  it('does not split long single words', () => {
    expect(wrapText('supercalifragilistic', 5)).toEqual(['supercalifragilistic']);
  });
  it('returns empty array for empty text', () => {
    expect(wrapText('')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails, then implement**

Run: `npx vitest run src/lib/wrap.test.ts` → FAIL (cannot resolve `./wrap`).

`src/lib/wrap.ts`:
```ts
export function wrapText(text: string, maxChars = 30): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
```

Run: `npx vitest run src/lib/wrap.test.ts` → PASS (4 tests).

- [ ] **Step 3: Write TagShape**

`src/components/shapes/TagShape.tsx`:
```tsx
import { icons } from 'lucide-react';
import { hexToHsl } from '../../lib/color';
import { planeMatrix, project } from '../../lib/projection';
import type { TagEl } from '../../model/types';
import type { ShapeProps } from './AssetShape';

export function TagShape({ el, view, selected, onPointerDown, onDoubleClick }: ShapeProps<TagEl>) {
  const pt = project({ x: el.gridX, y: el.gridY }, view);
  const dark = hexToHsl(el.color).l <= 0.7;
  const textFill = dark ? '#ffffff' : '#2a3242';
  const Icon = el.icon ? icons[el.icon as keyof typeof icons] : null;
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => onPointerDown?.(e, el.id),
    onDoubleClick: () => onDoubleClick?.(el.id),
  };
  const cursor = onPointerDown ? { cursor: 'move' as const } : undefined;

  if (el.style === 'tips') {
    const w = el.text.length * 7.5 + 24;
    return (
      <g transform={`translate(${pt.x} ${pt.y})`} {...handlers} style={cursor}>
        <path d={`M${-w / 2} -14 h${w} a6 6 0 0 1 6 6 v16 a6 6 0 0 1 -6 6 h${w * 0.1}` +
          ` l-6 8 l-6 -8 h${-w * 0.8 - 12} a6 6 0 0 1 -6 -6 v-16 a6 6 0 0 1 6 -6 z`}
          transform={`translate(${-6} 0)`}
          fill={dark ? el.color : '#ffffff'} stroke={dark ? 'none' : '#d4dae6'} />
        <text y={4} textAnchor="middle" fontSize={12} fill={textFill}>{el.text}</text>
        {selected && (
          <rect x={-w / 2 - 10} y={-20} width={w + 20} height={44} rx={8}
            fill="none" stroke="#7C5CFF" strokeWidth={1.5} strokeDasharray="5 4" />
        )}
      </g>
    );
  }

  const w = el.text.length * 8 + (Icon ? 46 : 28);
  const h = 28;
  const transform = view.mode === 'iso'
    ? planeMatrix({ x: el.gridX, y: el.gridY }, view)
    : `translate(${pt.x} ${pt.y})`;

  return (
    <g transform={transform} {...handlers} style={cursor}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} fill={el.color} />
      {Icon && <Icon x={-w / 2 + 10} y={-8} width={16} height={16} color={textFill} />}
      <text x={Icon ? 9 : 0} y={4.5} textAnchor="middle" fontSize={13} fontWeight={700}
        fill={textFill}>{el.text}</text>
      {selected && (
        <rect x={-w / 2 - 5} y={-h / 2 - 5} width={w + 10} height={h + 10} rx={h / 2 + 5}
          fill="none" stroke="#7C5CFF" strokeWidth={1.5} strokeDasharray="5 4" />
      )}
    </g>
  );
}
```

- [ ] **Step 4: Write TextShape**

`src/components/shapes/TextShape.tsx`:
```tsx
import { project } from '../../lib/projection';
import { wrapText } from '../../lib/wrap';
import type { TextEl } from '../../model/types';
import type { ShapeProps } from './AssetShape';

export function TextShape({ el, view, selected, onPointerDown, onDoubleClick }: ShapeProps<TextEl>) {
  const pt = project({ x: el.gridX, y: el.gridY }, view);
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => onPointerDown?.(e, el.id),
    onDoubleClick: () => onDoubleClick?.(el.id),
  };
  const cursor = onPointerDown ? { cursor: 'move' as const } : undefined;

  if (el.variant === 'plain') {
    return (
      <g transform={`translate(${pt.x} ${pt.y})`} {...handlers} style={cursor}>
        <text textAnchor="middle" fontSize={15} fontWeight={600} fill="#2a3242">
          {el.content}
        </text>
        {selected && (
          <rect x={-el.content.length * 4.5 - 8} y={-16} width={el.content.length * 9 + 16}
            height={26} fill="none" stroke="#7C5CFF" strokeWidth={1.5} strokeDasharray="5 4" />
        )}
      </g>
    );
  }

  const W = 240;
  const lines = wrapText(el.content, 34);
  const titleH = el.title ? 24 : 0;
  const H = 20 + titleH + lines.length * 18;
  return (
    <g transform={`translate(${pt.x} ${pt.y})`} {...handlers} style={cursor}>
      <rect x={-W / 2} y={0} width={W} height={H} rx={8} fill="#ffffff"
        stroke={selected ? '#7C5CFF' : '#e3e8f2'} strokeWidth={selected ? 1.5 : 1} />
      {el.title && (
        <text x={-W / 2 + 14} y={26} fontSize={14} fontWeight={700} fill="#2a3242">
          {el.title}
        </text>
      )}
      {lines.map((line, i) => (
        <text key={i} x={-W / 2 + 14} y={titleH + 26 + i * 18} fontSize={12.5} fill="#5a6579">
          {line}
        </text>
      ))}
    </g>
  );
}
```

- [ ] **Step 5: Render tags and texts in Scene (top layer)**

In `src/components/Scene.tsx`, add AFTER the assets layer (before `{ghost}`):
```tsx
      {elements.filter((e) => e.kind === 'tag').map((el) => (
        <TagShape key={el.id} el={el} selected={selection?.has(el.id)} {...shared} />
      ))}
      {elements.filter((e) => e.kind === 'text').map((el) => (
        <TextShape key={el.id} el={el} selected={selection?.has(el.id)} {...shared} />
      ))}
```
with imports.

- [ ] **Step 6: Extend double-click editing in CanvasView**

In `onElementDoubleClick`, add after the connector branch:
```tsx
    if (el.kind === 'tag') {
      const text = window.prompt('Tag text', el.text);
      if (text) s.apply((els) => updateElement(els, id, { text }));
    }
    if (el.kind === 'text') {
      if (el.variant === 'callout') {
        const title = window.prompt('Title (empty to remove)', el.title ?? '');
        if (title === null) return;
        const content = window.prompt('Body', el.content);
        if (content === null) return;
        s.apply((els) => updateElement(els, id, { title: title || undefined, content }));
      } else {
        const content = window.prompt('Text', el.content);
        if (content) s.apply((els) => updateElement(els, id, { content }));
      }
    }
```

- [ ] **Step 7: Write the Inspector**

`src/components/Inspector.tsx`:
```tsx
import { Trash2 } from 'lucide-react';
import { PRESETS } from '../lib/color';
import { deleteElements, updateElement } from '../model/ops';
import type { ConnectorEl, FloorEl, TagEl } from '../model/types';
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
```

- [ ] **Step 8: Mount Inspector and style it**

In `src/components/Editor.tsx`:
```tsx
      <div className="bp-body">
        <Palette />
        <div className="bp-canvas-wrap">
          <CanvasView />
          <Inspector />
        </div>
      </div>
```
with the import.

Append to `src/styles.css`:
```css
.bp-canvas-wrap { position: relative; display: flex; flex: 1; min-width: 0; }
.bp-inspector { position: absolute; top: 12px; right: 12px; background: #fff; border: 1px solid #e3e8f2; border-radius: 12px; padding: 10px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 4px 16px rgba(29, 36, 51, 0.08); }
.bp-insp-row { display: flex; align-items: center; gap: 6px; }
.bp-insp-row label { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #5a6579; }
.bp-insp-row input[type='number'] { width: 52px; padding: 4px 6px; border: 1px solid #d4dae6; border-radius: 6px; font: inherit; }
.bp-insp-input { padding: 5px 8px; border: 1px solid #d4dae6; border-radius: 6px; font: inherit; font-size: 12px; width: 170px; }
.bp-swatch { width: 24px; height: 24px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px #d4dae6; padding: 0; }
.bp-swatch-custom { background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red); }
.bp-swatch-custom::-webkit-color-swatch-wrapper { opacity: 0; }
.bp-chip { border: 1px solid #d4dae6; background: #fff; border-radius: 999px; padding: 4px 10px; font-size: 12px; }
.bp-chip.bp-active { border-color: #3479ff; background: #eaf1ff; color: #3479ff; }
```

- [ ] **Step 9: Verify manually**

Run: `npm run dev`. Expected:
- Bubble tag lies skewed on the iso plane like the kit; flat in top view; double-click edits text; icon input "Server" adds the lucide glyph inside the pill.
- Tips tag renders as a white tooltip box with a pointer; recoloring it to a dark color flips it to dark with white text.
- Plain text and callout card render and edit via double-click (title + body for callout).
- Select an asset → Inspector shows presets + picker; teal preset makes it look like the kit's teal row; an arbitrary purple works too. Multi-select recolors everything colorable.
- Floor W/D steppers resize the slab live; corners chips switch sharp/rounded/pill; connector style chips switch dash patterns.
- Delete button works; Inspector disappears when nothing is selected.

- [ ] **Step 10: Typecheck, test, commit**

```bash
npm run typecheck && npm test
git add src
git commit -m "feat: tags, text callouts, and selection inspector"
```

---

### Task 15: SVG and PNG export

**Files:**
- Create: `src/export/svg.tsx`, `src/export/png.ts`
- Modify: `src/components/TopBar.tsx`
- Test: `src/export/svg.test.tsx`

**Interfaces:**
- Consumes: `Scene`, `project`, `anchorOf`, `renderToStaticMarkup` from `react-dom/server`, `Doc`.
- Produces: `contentBounds(elements, view): { minX, minY, width, height }` (projected extents + 80px padding; defaults to `{-400,-300,800,600}` for empty docs), `buildSvg(doc): string` (standalone SVG: xmlns, white background, system font-family attribute, Scene markup with NO selection/grid/chrome), `svgToPngBlob(svg, scale?): Promise<Blob>` (default scale 2), `download(filename, blob): void`. TopBar gains SVG/PNG export buttons.

- [ ] **Step 1: Write the failing test**

`src/export/svg.test.tsx`:
```tsx
import { describe, expect, it } from 'vitest';
import type { Doc } from '../model/types';
import { buildSvg, contentBounds } from './svg';

const doc: Doc = {
  id: 'd1', name: 'T', schemaVersion: 1,
  view: { rotation: 0, mode: 'iso' },
  camera: { x: 0, y: 0, zoom: 1 },
  elements: [
    { kind: 'asset', id: 'a1', gridX: 0, gridY: 0, assetId: 'cube-plain', color: '#E05252' },
    { kind: 'asset', id: 'a2', gridX: 3, gridY: 0, assetId: 'cube-server', color: '#618AFF' },
    { kind: 'connector', id: 'c1', fromId: 'a1', toId: 'a2', style: 'dashed', color: '#425066' },
  ],
};

describe('export/svg', () => {
  it('bounds cover all projected elements with padding', () => {
    const b = contentBounds(doc.elements, doc.view);
    expect(b.width).toBeGreaterThan(100);
    expect(b.minX).toBeLessThan(0);
  });

  it('defaults bounds for empty documents', () => {
    expect(contentBounds([], doc.view)).toEqual({ minX: -400, minY: -300, width: 800, height: 600 });
  });

  it('buildSvg emits a standalone recolored SVG', () => {
    const svg = buildSvg(doc);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox=');
    expect(svg.toLowerCase()).not.toContain('#3258c2'); // a1 kit hexes replaced (a2 keeps kit blue)
    expect(svg).toContain('stroke-dasharray');
    expect(svg).not.toContain('__BP__');
    expect(svg).not.toContain('class=');
  });
});
```
Note on the `#3258c2` assertion: element a2 uses the kit base color, whose derived palette IS the kit palette — so its markup legitimately contains kit hexes. Assert instead on a doc where every asset is non-kit-colored: change a2's color to `'#E05252'` in the fixture so the assertion holds for the whole document. (Do that — both assets `#E05252`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/export/svg.test.tsx`
Expected: FAIL — cannot resolve `./svg`.

- [ ] **Step 3: Write src/export/svg.tsx**

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { project } from '../lib/projection';
import type { ViewState } from '../lib/projection';
import { anchorOf } from '../model/ops';
import type { Doc, Element } from '../model/types';
import { Scene } from '../components/Scene';

const PAD = 80;

export interface Bounds { minX: number; minY: number; width: number; height: number }

export function contentBounds(elements: Element[], view: ViewState): Bounds {
  const pts: { x: number; y: number }[] = [];
  for (const el of elements) {
    if (el.kind === 'floor') {
      for (const [dx, dy] of [[-0.5, -0.5], [el.width - 0.5, -0.5], [-0.5, el.depth - 0.5], [el.width - 0.5, el.depth - 0.5]]) {
        pts.push(project({ x: el.gridX + dx, y: el.gridY + dy }, view));
      }
    } else {
      const a = anchorOf(el);
      if (a) pts.push(project(a, view));
    }
  }
  if (pts.length === 0) return { minX: -400, minY: -300, width: 800, height: 600 };
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs) - PAD, maxX = Math.max(...xs) + PAD;
  const minY = Math.min(...ys) - PAD - 40, maxY = Math.max(...ys) + PAD;
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

export function buildSvg(doc: Doc): string {
  const b = contentBounds(doc.elements, doc.view);
  const inner = renderToStaticMarkup(
    <Scene elements={doc.elements} view={doc.view} />,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.minX} ${b.minY} ${b.width} ${b.height}" width="${b.width}" height="${b.height}" font-family="system-ui, -apple-system, sans-serif">` +
    `<rect x="${b.minX}" y="${b.minY}" width="${b.width}" height="${b.height}" fill="#ffffff"/>` +
    inner +
    `</svg>`;
}
```

- [ ] **Step 4: Write src/export/png.ts**

```ts
export async function svgToPngBlob(svg: string, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load SVG image'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(img.naturalWidth * scale);
    canvas.height = Math.ceil(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function download(filename: string, blob: Blob): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/export/svg.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Add export buttons to TopBar**

In `src/components/TopBar.tsx` (after the seg control):
```tsx
      <div className="bp-divider" />
      <button className="bp-icon-btn" title="Export SVG"
        onClick={() => download(`${doc.name}.svg`, new Blob([buildSvg(doc)], { type: 'image/svg+xml' }))}>
        <FileCode2 size={16} />
      </button>
      <button className="bp-icon-btn" title="Export PNG"
        onClick={() => { void svgToPngBlob(buildSvg(doc)).then((b) => download(`${doc.name}.png`, b)); }}>
        <ImageDown size={16} />
      </button>
```
with imports: `FileCode2, ImageDown` from lucide-react; `buildSvg` from `../export/svg`; `download, svgToPngBlob` from `../export/png`.

- [ ] **Step 7: Verify manually**

Run: `npm run dev`. Build a small diagram (assets, floor, connector with label, bubble tag, callout; some custom colors). Export SVG → open the file in a browser tab: identical to the canvas minus grid/selection, custom colors intact, iso skews correct. Export PNG → sharp 2x raster. Repeat once in top view — export honors the current view.

- [ ] **Step 8: Typecheck, test, commit**

```bash
npm run typecheck && npm test
git add src
git commit -m "feat: standalone SVG and 2x PNG export"
```

---

### Task 16: README and final verification

**Files:**
- Create: `README.md`

**Interfaces:** none — documentation and a full pass over the app.

- [ ] **Step 1: Write README.md**

```markdown
# Blueprint

Local-first isometric architecture diagramming. Excalidraw-style editing,
GT Diagram Kit isometric artwork, one diagram model with isometric (4
orientations) and top-down projections.

## Run

    npm install
    npm run dev

## Test

    npm test
    npm run typecheck

## Adding kit assets

Export shapes from the Figma kit as individual SVGs (blue variant), drop
them in `assets/graphics/`, then:

    npm run assets

Names come from filenames (`cube-server.svg` → "Cube Server"). Map a
top-view icon in `src/lib/topIcons.ts` (defaults to a box).

## How color works

Every kit SVG uses the same closed 9-color palette. At render time those
hexes are swapped for shades derived from the element's base color
(hue-shifted, saturation/lightness-scaled in HSL). Any color works; the
gray/blue/teal presets approximate the kit's original variants.

## Storage

Documents are JSON in localStorage (`blueprint:index`,
`blueprint:doc:<id>`), `schemaVersion: 1`.
```

- [ ] **Step 2: Full manual pass**

Run: `npm run dev` and walk through: create canvas → place several assets → recolor (preset + custom) → floor under them (resize, rounded) → connectors with labels (all three styles) → bubble tag with icon + tips tag + callout → rotate through all four orientations → top view → back → undo/redo through ~10 steps → export SVG + PNG → back to Home → second canvas → switch between canvases → reload browser (everything persists) → delete second canvas.

- [ ] **Step 3: Full automated pass**

Run: `npm run typecheck && npm test && npm run build`
Expected: all clean; production build succeeds.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README with asset pipeline and architecture notes"
```

---

## Plan Self-Review Notes

- **Spec coverage:** canvases CRUD (T6/T8), grid placement + snap (T10), recolor any color (T2/T9/T14), connectors (T12), floors (T13), tags/text (T14), rotation + top view with lucide (T4/T11), export (T15), undo/redo + persistence (T7), testing (throughout). Home-screen thumbnails and Figma re-exports are spec "open items" — intentionally not in this plan.
- **Known simplifications (deliberate, spec-compatible):** tag `attachedTo` affects delete-cascade only (placement stays free); text editing uses `window.prompt` (inline editors are post-MVP polish); connectors are straight lines (kit's curved dotted routes are post-MVP).
- **Type consistency check:** `ShapeProps<T>` defined once in AssetShape and imported everywhere; `Element` union used in ops/store/scene; `Placing` strings match between Palette (`EXTRAS` keys / `asset:` prefix) and `createFromPlacing`.
