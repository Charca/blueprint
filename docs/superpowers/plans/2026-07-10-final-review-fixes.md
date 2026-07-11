# Final Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the JSON import/export final-review findings without changing unrelated export behavior.

**Architecture:** The import parser rejects element IDs outside the locally generated lowercase base-36 grammar before documents can reach SVG rendering. JSON export normalizes only its own download basename. Persistence returns a boolean result so Home opens an imported document only after its save succeeds.

**Tech Stack:** TypeScript, React, Zustand, Vitest, Testing Library, browser localStorage.

## Global Constraints

- Imported element IDs must match `^[a-z0-9]+$`, the documented grammar emitted by `uid()`.
- Preserve valid imported IDs and their existing references; reject malformed IDs rather than remapping them.
- Filename normalization is scoped to the JSON export action; SVG and PNG exports remain unchanged.
- Preserve persisted `schemaVersion: 1` compatibility, including documents stored without `view`.
- Add tests before production code and capture RED/GREEN commands in `.superpowers/sdd/task-5-report.md`.

---

### Task 1: Validate Portable Blueprint Inputs

**Files:**
- Modify: `src/importExport/blueprint.test.ts`
- Modify: `src/importExport/blueprint.ts:107-110`

**Interfaces:**
- Produces: `parseBlueprint(serialized: string): Doc`, rejecting every element ID not matching `^[a-z0-9]+$` with `BlueprintImportError`.

- [ ] **Step 1: Write the failing parser regressions**

Add invalid input cases for an ID containing `"/><script` and a document with `schemaVersion: 2`, plus a tag whose `attachedTo` is `missing`:

```ts
['unsafe element ID', JSON.stringify({ format: 'blueprint', formatVersion: 1, document: { ...doc, id: undefined, elements: [{ ...doc.elements[0], id: 'x\"/><script' }, ...doc.elements.slice(1)] } })],
['unsupported document schema', JSON.stringify({ format: 'blueprint', formatVersion: 1, document: { ...doc, id: undefined, schemaVersion: 2 } })],
['invalid tag attachment', JSON.stringify({ format: 'blueprint', formatVersion: 1, document: { ...doc, id: undefined, elements: doc.elements.map((element) => element.kind === 'tag' ? { ...element, attachedTo: 'missing' } : element) } })],
```

- [ ] **Step 2: Run parser tests to verify the new unsafe-ID case fails**

Run: `npm test -- src/importExport/blueprint.test.ts`

Expected: FAIL because the unsafe element ID is currently accepted; the pre-existing schema and attachment cases pass.

- [ ] **Step 3: Add the strict ID check**

In `parseElement`, validate the string immediately after reading it:

```ts
// Imported IDs are embedded in asset SVG instance markup; uid() emits lowercase base-36 IDs.
if (!/^[a-z0-9]+$/.test(id)) fail('Invalid element.id.');
```

- [ ] **Step 4: Re-run parser tests to verify they pass**

Run: `npm test -- src/importExport/blueprint.test.ts`

Expected: PASS.

### Task 2: Safely Name JSON Downloads

**Files:**
- Modify: `src/components/TopBar.test.tsx`
- Modify: `src/components/TopBar.tsx:8-56`

**Interfaces:**
- Produces: JSON download filenames with unsafe/control/path characters replaced and an empty normalized basename falling back to `Untitled`.

- [ ] **Step 1: Write the failing JSON filename UI test**

Set the stored document name to `  release/../\u0000west  `, click `Export JSON`, and assert the mocked download call receives `release_.._west.blueprint.json`. Also test a whitespace-only unsafe name yields `Untitled.blueprint.json`.

- [ ] **Step 2: Run TopBar tests to verify filename tests fail**

Run: `npm test -- src/components/TopBar.test.tsx`

Expected: FAIL because the JSON export passes the unsanitized name through to `download`.

- [ ] **Step 3: Add a JSON-only filename normalizer**

Add a local helper that trims, replaces ASCII control characters and `/`, `\\`, `:`, `*`, `?`, `"`, `<`, `>`, `|` with `_`, trims again, and returns `Untitled` if empty. Use it only for the JSON export callback:

```ts
function jsonFilename(name: string): string {
  return name.trim().replace(/[\u0000-\u001f\\/:*?"<>|]+/g, '_').trim() || 'Untitled';
}
```

- [ ] **Step 4: Re-run TopBar tests to verify they pass**

Run: `npm test -- src/components/TopBar.test.tsx`

Expected: PASS.

### Task 3: Gate Import Navigation on Persistence

**Files:**
- Modify: `src/storage/local.ts:23-37`
- Modify: `src/components/Home.tsx:33-45`
- Modify: `src/components/Home.test.tsx`
- Modify: `src/storage/local.test.ts`

**Interfaces:**
- Changes: `saveDoc(doc: Doc): boolean`, returning `true` after both storage writes succeed and `false` after the existing non-throwing error path.
- Consumes: Home import branches on the `saveDoc` result before calling `openDoc`.

- [ ] **Step 1: Write failing storage and Home regressions**

Add a direct legacy load test that stores a `Doc` without `view` and expects `{ rotation: 0, mode: 'iso' }`. In Home, import a populated source document and assert the opened document is loadable with unchanged canvas data and indexed metadata; import the same file twice and assert distinct IDs and two independently loadable docs. Mock `Storage.prototype.setItem` to throw only for the imported document key, then assert no document is opened and an alert reports the import failure.

- [ ] **Step 2: Run focused storage and Home tests to verify save-failure UI coverage fails**

Run: `npm test -- src/storage/local.test.ts src/components/Home.test.tsx`

Expected: FAIL because `saveDoc` returns no result and Home opens the imported document despite a failed save.

- [ ] **Step 3: Return persistence success and display an import failure**

Return `true` at the end of `saveDoc`'s `try` block and `false` in its `catch` block. In Home, replace unconditional navigation with:

```ts
if (!saveDoc(doc)) {
  setImportError('Could not save the imported canvas.');
  return;
}
openDoc(doc.id);
```

Keep existing parser/read error behavior and refresh the Home document list after successful import.

- [ ] **Step 4: Re-run focused storage and Home tests to verify they pass**

Run: `npm test -- src/storage/local.test.ts src/components/Home.test.tsx`

Expected: PASS.

### Task 4: Verify and Commit the Fix Wave

**Files:**
- Modify: `.superpowers/sdd/task-5-report.md`
- Modify: all files above

**Interfaces:**
- Produces: a final report containing RED/GREEN evidence, verification results, changed files, self-review, concerns, and commit hash.

- [ ] **Step 1: Run the combined focused regression suite**

Run: `npm test -- src/importExport/blueprint.test.ts src/components/TopBar.test.tsx src/storage/local.test.ts src/components/Home.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run repository verification**

Run: `npm run typecheck && npm run build && npm test`

Expected: all commands exit 0.

- [ ] **Step 3: Append the report and inspect the diff**

Append the exact RED/GREEN and verification command results to `.superpowers/sdd/task-5-report.md`. Inspect `git status --short`, `git diff --check`, and `git diff` before staging only this fix wave.

- [ ] **Step 4: Commit the complete fix wave**

```bash
git add src/importExport/blueprint.ts src/importExport/blueprint.test.ts src/components/TopBar.tsx src/components/TopBar.test.tsx src/storage/local.ts src/storage/local.test.ts src/components/Home.tsx src/components/Home.test.tsx docs/superpowers/plans/2026-07-10-final-review-fixes.md .superpowers/sdd/task-5-report.md
```
