# Implementation plan — the Plot matrix view of StoryLines

Status: **Approved. Phase 1 (data layer) done: `Folder` removal, `Comments` / complete columns, `setOutlineCell` with `\|` escaping. `appendOutlineRow` moves to phase 4. Phases 2–4 built (model, registry, renderer, editing, Add row); needs a check in a real vault.** Decisions: rule amendment OK, literal table-mirror matrix, simple v1 scope, plus a new `Comments` column.
Branch (proposed): `feat/plot-matrix`.

A fifth option in the view selector, **Plot**: the Story Outline table drawn as a
matrix of big squares, in the same look as the line views. Unlike the
Characters / Locations / Chronological views it is **editable**, and what it
edits is the **Outline file**, not `Lines.md`.

## Goal

- A **mirror** of the Outline table: one matrix row per table row, one matrix
  column per table column. What the table says is what the matrix shows.
- Edit a square in the matrix → the matching cell of the table changes.
- Edit the table by hand → the matrix updates (the view already re-reads the
  outline on every index change).

## Decision needed first: this breaks a standing rule

`AGENTS.md` says *"the plugin never rewrites the table itself"* and the Outline
file is *"hand-edited only"* after creation. The Plot matrix view's whole point is to
write into it. Proposed amendment, to be applied to AGENTS.md / README /
outline-file-plan **only after approval**:

> The Outline table may be edited from the Plot matrix view, one cell at a time, on an
> explicit user edit. The plugin never reformats, reorders or rewrites rows the
> user did not touch, and never writes the table on its own.

Write mechanics (safety):

- `Vault.process()` on the Outline file (atomic read-modify-write), never
  `modify()`.
- A new pure module `src/data/outlineEdit.ts`: `setOutlineCell(body, rowIndex,
  column, value) → body'`. It changes **only** that cell's text inside the first
  table, keeps the other cells and lines byte-for-byte, re-pads nothing, and
  leaves text outside the table alone (same spirit as `replaceFirstTable`).
- Escapes `|` in values (→ `\|`) and collapses newlines, since a cell is one
  line. `parseOutlineTable` must then un-escape `\|` (small change, tested).
- Missing columns are added automatically (see "Outline columns are always
  complete"), so every column is editable.
- Never touches chapter/scene notes. Editing a square does not rename or move a
  note; the existing ⚠ reconciliation marks keep reporting the disagreement
  ("folder structure and `Lines.md` always win" is unchanged).

## New `Comments` column

A free-text, per-row column for the writer's own remarks (what to fix, ideas,
open questions), separate from `Synopsis`, which becomes the note body.

- `OutlineRow.comments: string | null`; `parseOutlineTable` reads a `Comments`
  header (case-insensitive like the others). `ColumnName` gets `"comments"`.
- Comments are **never** copied into a created note and never shown on line
  cards; they live in the table and the Plot matrix view only.
- Comments are one more column in the set below; it needs no special handling.

## Outline columns are always complete (applies to the whole plugin)

Today a missing column silently disables a feature (no `Date` column → no dates
from the outline). Instead:

- **Canonical column set and order:** `Act | Chapter | Scene | Line |
  Synopsis | Characters | Locations | Date | Status | Comments`
  (`OUTLINE_COLUMNS`, one constant in `outline.ts`, used by the skeleton, the
  checker and the generator).
- **New files:** `ensureOutlineFile` writes the skeleton with every column
  (today it lacks `Status` and `Comments`), and the column guide below
  the table documents all of them.
- **Existing files:** each time the plugin reads the Outline file (view open,
  story-folder change, index change), `ensureOutlineColumns` compares the
  header with `OUTLINE_COLUMNS` and, for every missing one, inserts it
  after the nearest preceding canonical column that the table has (`Act` goes
  first, `Scene` right after `Chapter`), with an empty cell in every row and in
  the separator row. Existing columns, their order, widths and cell text are never touched.
  If nothing is missing it does not write, so the write → re-read loop ends
  after one pass.
- Matching is case-insensitive; the legacy `Places` header counts as
  `Locations` (not duplicated).
- Only the first table is considered, and only if the file carries the
  `scribe-visualization: outline` marker (same guard as `writeGeneratedOutline`).
- Implementation: pure `ensureOutlineColumns(body) → body'` in `outlineEdit.ts`
  (unit-tested: missing one/several/all, legacy `Places`, ragged rows, CRLF,
  no table, already complete = identical string), I/O wrapper in
  `outlineFile.ts` via `Vault.process()`.
- Consequence to accept: a column the user deletes by hand comes back the next
  time the plugin reads the file. Extends the approved rule amendment: the
  plugin may also add missing header columns.

## Removing the `Folder` column (plain deletion, do first)

Nobody uses it, so it is deleted with no migration or replacement logic:

- Remove `OutlineRow.folder`, the `folder` column in `parseOutlineTable`, and the
  override in `expectedNotePath` (a row's folder is `"<Act label> <Act cell>"`
  or nothing). Update `outline.ts` tests.
- `outlineGenerate.ts`: drop the `Folder` column from the generated table; no
  `Act` mapping is added.
- Skeleton guide: drop the "Custom folder" row and `Folder` from "Also
  recognized". README, AGENTS.md, CHANGELOG and `outline-file-plan.md` updated.
- An old outline that still has a `Folder` header is simply ignored.

## The matrix

Rows = outline rows in table order, grouped under an Act header when the `Act`
column is set. Columns = the table's columns, in this order, only those present:

| Column | Square shows | Edit control |
|---|---|---|
| **Act / Chapter / Scene** (first column, merges three table columns) | one square: the unit label ("Chapter 3 - The beginning", or "Scene 2" under its chapter) with the Act above it in small text, colored by its line | three small inputs, one per table cell (`Act`, `Chapter`, `Scene`), each written to its own cell |
| Line | line name, filled with the line color from `Lines.md` | dropdown of existing lines (+ blank); a typo can't create a line |
| Synopsis | wrapped text, the "big square" | multi-line textarea |
| Characters | chips | comma-separated text input |
| Locations | chips | comma-separated text input |
| Date | the readable date (`formatStoryDate`), ⚠ when unparseable | text input, hint from `dateFormatHint()` |
| Status | text | text input |
| Comments (new) | wrapped text, last column | multi-line textarea |

Row state is shown like the other views: a row with no note yet is a dashed
**ghost** row (same dashed style as ghost cards); a fulfilled row links to its
note (click the label to open it, same as a real card). Marks from
`reconcileOutline` appear as the ⚠ on the label square.

"Add row" at the bottom appends an empty row (no Act, Chapter or Scene; the writer fills
them in with the pencil). Such a row is shown as "Not numbered yet" and found by its line in the
file (`OutlineRow.sourceLine`), because the parser, and every other view, ignore a row with no
Chapter or Scene. "Delete row" is **deferred** (destructive, needs a confirm
modal; not v1).

### Look

Reuse the canvas vocabulary: Obsidian CSS variables only, `.scribe-plot-matrix-*`
classes, square min-size (~160px) with the line color as a left/top accent like
the cards, dashed border for ghost rows, same toolbar and view selector. New
rules go in `styles.css`; `npm run lint:css` must stay green.

## Architecture (follows the existing pattern)

| Piece | File | Notes |
|---|---|---|
| Cell write | `src/data/outlineEdit.ts` (new, pure, unit-tested) | `setOutlineCell`, `appendOutlineRow`; escape/unescape helpers |
| Parse tweak | `src/data/outline.ts` | un-escape `\|`; expose the raw header → column list the matrix needs (`parseOutlineTable` currently drops column order) |
| Outline file I/O | `src/data/outlineFile.ts` | `writeOutlineCell(app, path, rowIndex, column, value)` via `process()` + marker check, like `writeGeneratedOutline` |
| Matrix model | `src/views/plotMatrixModel.ts` (new, pure, unit-tested) | `plotMatrixModel(rows, recon, layout, language)` → columns present, rows with per-cell display value, line color, ghost/fulfilled, marks |
| Registry | `src/views/storyViews.ts` | new `plot` entry. The registry is shaped around `buildModel → CanvasModel`; the matrix is a different model, so add an optional `kind: "board" \| "matrix"` (or `renderMatrix`) to `StoryViewDef` rather than an `if (view === "plotMatrix")` in the view |
| Rendering | `src/views/plotMatrixRenderer.ts` (new, DOM only) | `lineView.ts` is already 1100 lines — the matrix DOM goes in its own file, called from `render()` through the descriptor |
| Tab shell | `src/views/lineView.ts` | toolbar/selector reuse; for `plot`, skip `Lines.md` autosave/undo paths. Edits go straight to `writeOutlineCell`; `editable` currently means "edits `Lines.md`", so split that flag (`editsLines` vs `editsOutline`) |

## Without an Outline file: read-only, built from the notes

When no Outline file exists (none named in settings, or named but not created),
the Plot matrix view still works, but **read-only**: no editors, no "Add row", nothing
written.

- `plotMatrixModel` takes its rows from the real notes instead of the table: one row
  per note in manuscript order, with `Act` / `Chapter` / `Scene` derived from
  the title and folder nesting (the same derivation `generateOutlineTable`
  uses, shared rather than copied), `Line` from the note's `Lines.md`
  placement, `Date` / `Characters` / `Locations` / `Status` from the note's
  frontmatter (already on `NovelEntry`), `Synopsis` from the note's first
  paragraph (`NovelEntry.excerpt`). `Comments` is empty (it only exists in the
  table).
- A small notice above the matrix says it is read-only and built from the
  notes, pointing to the Outline file setting. No ghost rows (nothing is
  planned).
- The moment an Outline file exists, the matrix switches to the table-mirror
  mode (editable), so there is one model with two row sources, not two views.
- No column check or other write happens in this mode.

## Edit behavior

- Click a square → inline editor in place; **Enter / blur commits, Escape
  reverts** (same as `editLineName`). Textarea: Ctrl/Cmd+Enter commits.
- Commit = one `writeOutlineCell` call, then the existing vault-change path
  re-reads and re-renders; no optimistic local state, so the matrix can never
  disagree with the file.
- If the file changed under the editor (row index no longer matches because the
  user edited the table meanwhile), the write re-validates that the row's
  Chapter/Scene cells still match what the matrix showed; otherwise it aborts
  with a Notice and re-renders.
- Undo: Obsidian's own file history / Ctrl+Z in the table editor. v1 has no
  in-view undo (the Lines undo stack is for `Lines.md`). A "Cmd+Z in the Plot
  view" is a possible follow-up.

## Phases

1. **Data layer** — `outlineEdit.ts` (+ `Comments` parse, `OUTLINE_COLUMNS`, `ensureOutlineColumns`, full-column skeleton) + `\|` escaping in the parser + tests
   (round-trips; untouched cells/lines unchanged; Windows line endings; rows
   with fewer cells than the header; cell containing `|`).
2. **Model** — `plotMatrixModel.ts` + tests; registry entry and `StoryViewDef` split.
3. **Read-only matrix** — renderer + CSS; selector shows "Plot"; verify it
   mirrors the table in a real vault.
4. **Editing** — inline editors, `writeOutlineCell`, stale-row guard, "Add row".
5. **Docs/chores** — AGENTS.md (rule amendment, architecture rows), README,
   CHANGELOG `Unreleased`, this plan marked Built. `npm run validate` green.

## Resolved decisions

1. Matrix axes: literal table mirror (rows = outline rows, columns = outline columns).
2. Rule amendment: approved.
3. v1 scope: simple — no delete row, drag reorder, or in-view undo; `Comments` column added.
4. No new frontmatter key or setting.

## Open

- Trigger for the column check: "each time the plugin reads the file" (view
  open / index change), assumed.
