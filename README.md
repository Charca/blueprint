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
