# JSON import and export design

**Date:** 2026-07-10

**Status:** Approved

## Goal

Allow a user to export a complete Blueprint canvas to a portable JSON file and
import that file as a new local canvas. The imported canvas must restore the
diagram and its view exactly: element data and ordering, labels, connections,
floor membership, view mode, rotation, and camera position and zoom.

## File format

Files use the `.blueprint.json` extension and contain a versioned envelope:

```json
{
  "format": "blueprint",
  "formatVersion": 1,
  "document": {
    "schemaVersion": 1,
    "name": "Production network",
    "view": { "mode": "iso", "rotation": 0 },
    "camera": { "x": 736, "y": 412, "zoom": 1.25 },
    "elements": []
  }
}
```

`formatVersion` versions the portable-file contract. `document.schemaVersion`
continues to version Blueprint's diagram data model. Keeping these separate
allows file-envelope and model changes to be migrated independently.

The `document` object is a `Doc` snapshot with one deliberate omission:
`id`. A document ID is local storage identity, not canvas content. Importing
always generates a fresh ID, making every import a new canvas and avoiding a
collision with an existing document.

The exported document includes:

- `name`
- `schemaVersion`
- `view.mode` (`iso` or `top`)
- `view.rotation` (`0`, `1`, `2`, or `3`)
- `camera.x`, `camera.y`, and `camera.zoom`
- `elements`, in their existing array order, including all optional properties
  such as labels, asset/floor parent references, connector labels, tag icons,
  text titles, and floor sizing mode

The export intentionally excludes ephemeral editor state: selection, active
tool, connection/placement state, clipboard contents, hover state, in-progress
drags, and undo/redo history.

## Export behavior

Add an `Export JSON` action to the editor's top bar beside the existing SVG and
PNG exports. It serializes the envelope with two-space indentation, creates an
`application/json` blob, and downloads it as a sanitized document-name file
with the `.blueprint.json` extension. If the name is empty, use `Untitled`.

The export reads the current `doc` from the store, so it captures the same
document state that will be persisted locally. It must not mutate the document
or its IDs.

## Import behavior

Add an `Import JSON` action on the home screen, where creating a new canvas is
already possible. The action opens an accept-filtered hidden file input for
`.json` and `.blueprint.json` files. A successful import:

1. Reads the selected file as text and parses its JSON.
2. Validates and converts the envelope into a new `Doc` with a generated ID.
3. Saves the new document through the existing local-storage API.
4. Opens the new document in the editor.

The importer preserves source element IDs because connector `fromId`/`toId`
and `parentId` relationships depend on them. Since the import is a separate
canvas, those IDs do not conflict with elements in other documents.

If a user cancels the chooser, no action is taken. The input resets after every
attempt so importing the same file again works.

## Validation and errors

Parsing JSON alone is insufficient. Treat imported data as untrusted and
perform structural validation before writing to local storage. Validation must
confirm:

- The root is an object with `format: "blueprint"` and `formatVersion: 1`.
- `document` is an object with `schemaVersion: 1`, a string name, a valid view,
  a valid camera, and an element array.
- Camera fields are finite numbers and zoom is within the editor's supported
  range of `0.2` through `4`.
- Every element has a supported kind and its required fields have the correct
  primitive types and allowed enum values.
- Element IDs are non-empty strings and unique.
- A connector's `fromId` and `toId` each reference an existing, non-connector
  element.
- An asset, tag, or text `parentId`, when supplied, references an existing
  floor. A tag's `attachedTo`, when supplied, references an existing element.

The initial importer ignores unknown fields and imports only the documented
schema-version-1 properties. It rejects an unsupported `formatVersion` or
`schemaVersion` rather than guessing how to migrate it. Optional known fields
remain optional to preserve existing schema-version-1 compatibility.

Any parse, file-read, or validation failure displays a concise user-facing
error and does not create or open a document. Errors should identify whether
the file is malformed, from an unsupported Blueprint version, or has invalid
diagram data without exposing raw implementation errors to the user.

## Persistence correction

`loadDoc` currently replaces each saved document's view with `{ rotation: 0,
mode: 'iso' }`. Remove this reset so locally persisted and imported documents
retain the exported view mode and rotation when reopened. Existing documents
already contain `view`; a defensive default is only needed for malformed or
legacy data lacking it.

## Boundaries

Create a focused import/export model module responsible for the portable
envelope, serialization, parsing, validation, and conversion to a fresh `Doc`.
It depends on model types and `uid`, but not React, Zustand, or local storage.
The UI components only handle download/upload and surface results. The storage
layer remains responsible for saving and indexing the resulting `Doc`.

## Verification

Add focused unit tests for:

- Exporting a document produces the specified envelope, omits document ID, and
  preserves the full view, camera, element order, and optional element fields.
- Importing a valid envelope generates a new document ID while preserving all
  other canvas data and cross-element references.
- Re-importing the same file produces another distinct local document ID.
- Rejection of malformed JSON, unknown format/version, invalid camera values,
  duplicate element IDs, dangling connector endpoints, and invalid parent or
  attachment references.
- Local document load preserves a saved non-default `view`.

Add component tests for successful file import opening a new canvas and for
the user-visible failure path. Run `npm test`, `npm run typecheck`, and
`npm run build` once implemented.

## Out of scope

- Merging a file's contents into the active canvas.
- Importing arbitrary third-party diagram formats.
- Embedding JSON into SVG or PNG exports.
- Carrying undo history or transient editor/UI state between canvases.
- Schema migrations beyond explicitly rejecting unsupported future versions.
