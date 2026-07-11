# SaveDoc Index Rollback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent a failed index write from leaving a newly saved document orphaned in localStorage.

**Architecture:** `saveDoc` persists the document body before writing its index metadata. Capture the prior document-key value before that mutation and compensate only if the subsequent index write fails, preserving the existing boolean, non-throwing API.

**Tech Stack:** TypeScript, Vitest, JSDOM localStorage.

## Global Constraints

- Preserve `saveDoc(doc): boolean` and its existing logging and one-time alert behavior.
- Change only the index-write partial-failure path; retain normal successful persistence behavior.
- Prove the regression fails before production code is edited.

---

### Task 1: Roll Back A Newly Written Document When Index Persistence Fails

**Files:**
- Modify: `src/storage/local.test.ts`
- Modify: `src/storage/local.ts`
- Modify: `.superpowers/sdd/task-5-report.md`

**Interfaces:**
- Consumes: `saveDoc(doc: Doc): boolean`, `loadDoc(id: string): Doc | null`, and `listDocs(): DocMeta[]`.
- Produces: `saveDoc` returns `false` without leaving a document key when only `blueprint:index` writes fail.

- [x] **Step 1: Write the failing test**

```ts
it('rolls back a newly saved document when the index write fails', () => {
  // Make only blueprint:index writes throw, then save a previously absent doc.
  expect(saveDoc(doc)).toBe(false);
  expect(loadDoc(doc.id)).toBeNull();
  expect(listDocs()).not.toContainEqual(expect.objectContaining({ id: doc.id }));
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/storage/local.test.ts`

Expected: FAIL because `loadDoc(doc.id)` returns the just-written document.

- [x] **Step 3: Write minimal implementation**

```ts
const previous = localStorage.getItem(docKey(doc.id));
localStorage.setItem(docKey(doc.id), JSON.stringify(doc));
try {
  writeIndex(nextIndex);
} catch (err) {
  if (previous === null) localStorage.removeItem(docKey(doc.id));
  else localStorage.setItem(docKey(doc.id), previous);
  throw err;
}
```

- [x] **Step 4: Run focused tests to verify they pass**

Run: `npm test -- src/storage/local.test.ts`

Expected: PASS.

- [x] **Step 5: Run full verification and commit**

Run: `npm test && npm run typecheck && npm run build`

Expected: all commands exit 0; commit the test and implementation with a focused fix message.
