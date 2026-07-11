# Task 5 Verification Report

Worktree: `/Users/charca/Sites/blueprint/.worktrees/json-import-export`

## Workspace

Command:

```sh
git rev-parse --git-dir
```

Result: linked worktree (`.git/worktrees/json-import-export` differs from
common `.git` directory), on branch `feat/json-import-export`, and not a
submodule.

## Complete Test Suite

Command:

```sh
npm test
```

Result: exit 0. Vitest reported 17 passing test files and 103 passing tests;
no failures.

## Static Type Checking

Command:

```sh
npm run typecheck
```

Result: exit 0. `tsc --noEmit` reported no TypeScript errors.

## Production Build

Command:

```sh
npm run build
```

Result: exit 0. Vite production build completed after transforming 1,808
modules.

## Final Worktree And Commit Inspection

Commands:

```sh
git status --short
git diff HEAD~4..HEAD --stat
git log --oneline HEAD~4..HEAD
```

Results:

- `git status --short` produced no output before this report was written; no
  implementation files were uncommitted.
- The four expected focused commits are present:
  - `e70c23c Add JSON canvas import`
  - `16638df Add JSON export action`
  - `5014627 Preserve document view on load`
  - `12de5a4 Add Blueprint JSON file format`
- `git diff HEAD~4..HEAD --stat` reported 9 files changed, with 354 insertions
  and 8 deletions:

```text
 src/components/Home.test.tsx       |  24 ++++-
 src/components/Home.tsx            |  33 +++++-
 src/components/TopBar.test.tsx     |  37 +++++++
 src/components/TopBar.tsx          |  13 ++-
 src/importExport/blueprint.test.ts |  45 ++++++++
 src/importExport/blueprint.ts      | 203 +++++++++++++++++++++++++++++++++++++
 src/storage/local.test.ts          |   4 +-
 src/storage/local.ts               |   2 +-
 src/styles.css                     |   1 +
 9 files changed, 354 insertions(+), 8 deletions(-)
```

## Defects Fixed

None. All required verification commands passed, so no code was modified and
no commit was created.

## Concerns

Vite emitted its standard chunk-size warning: the generated JavaScript bundle
is 954.58 kB (268.07 kB gzip), exceeding the 500 kB warning threshold. This
did not fail the build and is not introduced or investigated by this
verification-only task.

## Final Review Fix Wave

### Scope

- Reject imported element IDs unless they match `^[a-z0-9]+$`, the lowercase
  base-36 grammar emitted by `uid()`, before any imported asset can reach SVG
  instance markup.
- Normalize JSON export filenames only: path/unsafe characters and C0, DEL,
  and C1 control characters are replaced with `_`; a blank trimmed basename
  remains `Untitled`.
- Make `saveDoc` return a boolean and keep Home on the import screen with an
  alert when an imported document cannot be persisted.
- Add direct regressions for legacy documents without `view`, persisted and
  reopened imports, distinct repeated imports, missing tag attachments, and
  unsupported document schemas.

### TDD Evidence

Baseline command:

```sh
npm install && npm test
```

Result: exit 0. Dependencies were current; 17 test files and 103 tests
passed before the fix wave.

Initial RED command:

```sh
npm test -- src/importExport/blueprint.test.ts src/components/TopBar.test.tsx src/storage/local.test.ts src/components/Home.test.tsx
```

Result: exit 1. After correcting two test fixtures that did not isolate the
intended behavior, the RED run reported the expected three failures: the
malicious element ID was accepted, the hostile JSON filename was unchanged,
and failed persistence produced no Home import alert.

Initial GREEN command:

```sh
npm test -- src/importExport/blueprint.test.ts src/components/TopBar.test.tsx src/storage/local.test.ts src/components/Home.test.tsx
```

Result: exit 0. Four test files and 29 tests passed after the minimal parser,
JSON filename, and persistence-result changes.

Control-character RED command:

```sh
npm test -- src/components/TopBar.test.tsx
```

Result: exit 1. The filename retained DEL (`U+007F`), demonstrating the
initial sanitizer did not cover all requested control characters.

Control-character GREEN command:

```sh
npm test -- src/components/TopBar.test.tsx
```

Result: exit 0. Two TopBar tests passed after adding DEL/C1 control ranges to
the JSON-only sanitizer.

### Final Verification

Commands:

```sh
npm run typecheck
npm run build
npm test
```

Results:

- `npm run typecheck`: exit 0, `tsc --noEmit` reported no errors.
- `npm run build`: exit 0, Vite built 1,808 modules.
- `npm test`: exit 0, 17 test files and 111 tests passed.

### Changed Files

- `src/importExport/blueprint.ts`
- `src/importExport/blueprint.test.ts`
- `src/components/TopBar.tsx`
- `src/components/TopBar.test.tsx`
- `src/storage/local.ts`
- `src/storage/local.test.ts`
- `src/components/Home.tsx`
- `src/components/Home.test.tsx`
- `docs/superpowers/plans/2026-07-10-final-review-fixes.md`
- `.superpowers/sdd/task-5-report.md`

### Commit

Implementation commit: `9382f2c Fix JSON import and export review findings`.

### Self-Review

- Confirmed imported valid IDs and references remain unmodified; malformed IDs
  fail in the parser before document persistence or rendering.
- Confirmed SVG and PNG export callbacks are unchanged; normalization is
  scoped to JSON export.
- Confirmed Home branches on the persistence result before calling `openDoc`.
- Ran `git diff --check`; it reported no whitespace errors.

### Concerns

- A failure writing the document index after a document-key write can leave an
  unindexed document in localStorage. `saveDoc` reports failure and Home does
  not open the import, which satisfies this fix wave; cleanup of that existing
  partial-write case is intentionally out of scope.
- Vite continues to report its pre-existing bundle-size warning; the build
  exits successfully.

## SaveDoc Index Rollback Fix

### Root Cause

`saveDoc` wrote `blueprint:doc:<id>` before `blueprint:index`. When only the
index write threw, its catch preserved the non-throwing `false` result but left
the completed document-key write behind, making the document loadable but
absent from the index.

### TDD Evidence

RED command:

```sh
npm test -- src/storage/local.test.ts
```

Result: exit 1. The new index-only-write failure regression returned `false`
from `saveDoc` as expected, but failed because `loadDoc('index-write-failure')`
returned the written document rather than `null`.

GREEN command:

```sh
npm test -- src/storage/local.test.ts
```

Result: exit 0. The focused storage suite passed 8 tests after `saveDoc`
snapshotted the prior document value and restored it (or removed a new key)
when a later storage operation failed.

### Final Verification

Commands:

```sh
npm test
npm run typecheck
npm run build
```

Results:

- `npm test`: exit 0, 17 test files and 112 tests passed.
- `npm run typecheck`: exit 0, `tsc --noEmit` reported no errors.
- `npm run build`: exit 0, Vite built 1,808 modules. It retained the existing
  chunk-size warning for a 954.89 kB JavaScript bundle.

### Changed Files

- `src/storage/local.ts`
- `src/storage/local.test.ts`
- `docs/superpowers/plans/2026-07-10-save-doc-index-rollback.md`
- `.superpowers/sdd/task-5-report.md`

### Commit

Implementation commit: `2c89e47 Fix save document index rollback`.

### Self-Review

- The regression makes only `blueprint:index` writes fail and verifies the
  boolean failure result, `loadDoc` null result, absent document key, and absent
  index metadata.
- Successful save behavior remains unchanged, and all existing callers retain
  the boolean, non-throwing API.
- A failed document-key write does not trigger compensation because rollback is
  attempted only after the document write completed.
- If the document already existed, its exact stored bytes are restored when the
  later index write fails.
- `git diff --check` passed before the implementation commit.

### Concerns

- If localStorage also rejects the compensating `removeItem` or `setItem`, the
  API still returns `false` without throwing, but physical rollback cannot be
  guaranteed by an unavailable storage backend.
- The production build has the pre-existing chunk-size warning noted above.
