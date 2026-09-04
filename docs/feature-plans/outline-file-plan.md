# Implementation plan — the Outline file

Status: **Phase 4 + Phase 5 complete**. This is the build plan for an optional
per-book **Outline file**, described in [`../../AGENTS.md`](../../AGENTS.md).
Each phase is independently shippable and leaves the plugin in a working state.

Notes vs. plan as built: the reconciliation result also carries `fulfilledPaths`
(for the "not in the outline" diagnostic); `canvasModel` gained
`applyPlannedPlacements` (used for both single and batch create) instead of
routing single-create through `moveCard`; ghost cards on a line are re-indexed
`0..n` only when that line actually has one. The skeleton is created by a
**"Create file" button next to the settings field** — there is no toolbar
"Create outline file" button, and the file is *not* created automatically when
the name is typed (`saveSettings` fires per keystroke, so that left a file
behind for every partial name). The `.md` extension is optional in the field;
`outlineFileName()` normalises `Outline` and `Outline.md` to the same
`(SL) Outline.md`.

## Goal

Let a novelist plan a book's chapters/scenes as a Markdown table **before** the
prose notes exist, and see that plan on the line view as placeholder ("ghost")
cards that turn into real notes on click. The table is an **optional** layer —
with none configured the plugin behaves exactly as it does today, driven only
by the folder/file structure.

Once a note exists, its outline row still contributes its **Summary** as a card
preview and is checked for **discrepancies** against the real structure; the
real folder/file structure and `Lines.md` are always authoritative, the table
never is.

---

## The Outline file

One optional Markdown file inside the book folder. A new `outlineFileName`
setting is **empty by default** (feature off); after naming it, the user clicks
the setting's **"Create file"** button to write an empty table skeleton (one per
book folder). Frontmatter marker plus a hand-editable table in the body:

```markdown
---
scribe-visualization: outline
---

<!-- Managed by Scribe of Lagash - Visualization.
     Columns: Act | Chapter | Scene | Line | Summary  (Folder/Date/Characters/Places/Status optional).
     "Line" is a line name or id from Lines.md. Click a ghost card in the line view to create its note. -->

| Act | Chapter | Scene | Line      | Summary                                   |
| --- | ------- | ----- | --------- | ------------------------------------------ |
| I   | 1       |       | Main line | Berlín 2029. Matthias, el aplauso extraño |
```

- Column names matched case-insensitively; unknown columns ignored; `[M]`-style
  brackets stripped from cells so shorthand still parses.
- A row with neither `Chapter` nor `Scene` is skipped.
- Expected note path for a row:
  - `folder` = `Folder` cell, else `"<Act label> <Act cell>"` (`Act`/`Acto` by
    title language), else none.
  - chapter row → `<book>/<folder>/<Chapter unit> <n>.md`
  - scene row → `<book>/<folder>/<Chapter unit> <n>/<Scene unit> <m>.md` (a
    scene sits in its chapter's folder — the existing folder-nesting rule).
  - unit words reused from `LANGUAGE_PATTERNS[lang].numbered[].unit`
    (`Chapter`/`Capítulo`, `Scene`/`Escena`).
- A row is **fulfilled** (no ghost card) when a real `NovelEntry` matches it: by
  expected path, or failing that by same type + same number within the book.

### Discrepancies (structure wins, card gets a mark)

For a fulfilled row, compare against the real note and its `Lines.md`
placement:

| Check | Discrepancy when |
| --- | --- |
| Line | row's resolved line ≠ the line the card currently sits on |
| Location | expected folder ≠ the real note's folder |
| Type | row says scene but the title parses as chapter (or vice versa) |

Any hit → the card renders a small `⚠` marker whose tooltip names the
difference. The plugin changes nothing; the user reconciles by editing the
table or moving the note/card.

---

## Phase 4 — read the outline, show ghost cards, click-to-create ✅ done

Independently shippable: with a hand-written outline table you see your
planned book on the canvas and can turn any ghost card into a real note.

### Data layer (pure, unit-tested)

- **`src/types.ts`** — `OutlineRow`, `PlannedEntry`, the outline marker value.
  `OutlineRow`: `{ act, folder, chapter, scene, line, summary, date,
  characters, places, status, rowIndex }`. `PlannedEntry`: `{ row, type:
  "chapter"|"scene", label, expectedPath, lineId: string | null }`.
- **`src/data/outline.ts`** (no Obsidian imports):
  - `parseOutlineTable(markdownBody): OutlineRow[]` — finds the first GFM
    table, maps columns by header name, coerces cells. Number cells parsed
    with `parseNumberToken` (export it from `titleParser.ts`).
  - `expectedNotePath(row, book, lang)` — uses new `actLabel(lang)` and
    `unitLabel(lang, type)` helpers in `titleParser.ts`.
  - `reconcileOutline(rows, entries, layout, lang, lineOrder): { planned:
    PlannedEntry[]; previews: Record<string, string>; marks: Record<string,
    string>; unknownLines: string[] }` — splits rows into fulfilled / not;
    resolves each `line` cell against `layout.lines` (id or lowercased name);
    fills `previews`/`marks` for fulfilled rows; collects unresolved line
    names.
  - Tests in `src/data/outline.test.ts`.
- **`src/data/outlineFile.ts`** (Obsidian I/O, mirrors `lineFile.ts`):
  - `outlineFilePath(book, name)`.
  - `readOutline(app, path): Promise<OutlineRow[]>` — missing/unnamed file →
    `[]`.
  - `ensureOutlineFile(app, path): Promise<boolean>` — creates the empty-table
    skeleton when `path` is set and the file doesn't exist yet (returns whether
    it did); called from `main.createOutlineFiles()`, which the settings
    "Create file" button triggers — never from `saveSettings`.
  - `outlineFileName(typed): string` — trims the typed name and makes the `.md`
    extension optional/canonical (`Outline` → `Outline.md`).
- **`src/data/noteScaffold.ts`** (pure): `scaffoldNoteBody(planned): string` —
  frontmatter block with only the keys the row filled, then the Summary as the
  body (no `# <title>` heading — the filename already is the title).
- **Settings** — `outlineFileName: ""` (empty = feature off) in
  [`../../src/settings/settings.ts`](../../src/settings/settings.ts); a text
  field plus a "Create file" button (`plugin.createOutlineFiles()`) in
  [`../../src/settings/settingsTab.ts`](../../src/settings/settingsTab.ts).

### Canvas model

- **`src/views/canvasModel.ts`** — `canvasModel(entries, layout, outline?)`.
  `CanvasCard` gains `kind: "real" | "planned"`, `planned?: PlannedEntry`,
  `summary?: string`, `mark?: string`. Real cards pick up `summary`/`mark` from
  the outline result by path. Per line: take real cards sorted by placement
  `x` as today, splice in planned entries whose resolved `lineId` matches that
  line at the position their `(act, chapter, scene)` tuple implies relative to
  the real cards, then assign display-only column indices `0..n`. Real
  placements are never mutated. Planned entries with no resolved line go to a
  new `plannedUnplaced` list.
- Update `src/views/canvasModel.test.ts`.

### Line view

[`../../src/views/lineView.ts`](../../src/views/lineView.ts):

- `openBook()` reads the outline alongside `Lines.md`, on every open, book
  switch, and index change — both sources are re-checked every time.
- `viewReady` also allows a book with lines but zero real entries, as long as
  it has outline rows.
- Ghost cards: `scribe-canvas-card--planned`, show the summary preview,
  **draggable** like real cards (a drop writes a `Lines.md` placement keyed by
  the note's future path via `moveCard`; `canvasModel` then honours it over the
  manuscript-order guess). Click opens a confirm ("Create note at `<path>`?")
  that creates any missing parent folders, writes the scaffolded note, seeds its
  placement via `applyPlannedPlacements`, and opens it.
- Real cards render their `summary` preview and, when marked, a `⚠` badge.
- Diagnostics list `unknownLines` (outline rows referencing a line not in
  `Lines.md`).

### Styles

`.scribe-canvas-card--planned` in [`../../styles.css`](../../styles.css):
dashed border, reduced opacity, pointer cursor, a "＋ create" hover
affordance.

---

## Phase 5 — polish ✅ done

- **"Create all planned notes"** toolbar action — batches the Phase 4 create
  flow over every ghost card.
- **Orphan surfacing** — list real notes that no outline row matches.
- **"Generate outline from notes" command** (optional) — fills a freshly
  created, still-empty table from the current entries. Not the default path;
  the settings-created file is empty by design.
- The plugin never writes back to the table — rewriting it from canvas edits
  is explicitly out of scope.

---

## Phase 6 — outline-driven lines ✅ done

Before this phase, a `Line` value that matched no line in `Lines.md` left its
ghost cards stranded in the "Not on any line" strip; the only fix was to add the
line by hand. Now the `Line` column can create lines.

- `outlineLineNames(rows)` (pure, in `outline.ts`) — distinct non-empty `Line`
  values in first-appearance order, case-insensitive dedupe.
- **Lines file present:** the view never creates lines automatically — a `Line`
  typo the user later corrects would otherwise leave a stray line behind.
  Instead `LineView.missingOutlineLines()` computes the `outlineLineNames` not
  present by id or name, and a ⟳ (`refresh-cw`) toolbar button — shown only when
  that list is non-empty — calls `createOutlineLines()`, which appends a line
  (theme accent) for each as a single `mutate()` (undoable, saved). A `Notice`
  reports the count.
- **No Lines file yet:** the empty-state prompt becomes "Create lines from
  outline" when the outline names lines, and builds the layout with
  `starterLayoutFromOutline(entries, rows, book, language, color)` (pure, in
  `canvasModel.ts`): one line per `outlineLineNames` value, each real entry
  placed on the line its matching row names (first line as fallback). Falls back
  to the single "Main line" `starterLayout` when the outline names no lines.
- **Additive only.** Never renames / recolours / reorders / removes a line, and
  never repositions an existing note's card. Placements are seeded from the
  outline only when `Lines.md` is first created.
- `reconcileOutline`'s `unknownLines` diagnostic notice points the user at the
  ⟳ button (or at fixing the `Line` cell).

---

## Open questions to resolve as we go

- Exact wording/placement of the discrepancy tooltip and the unknown-line /
  orphan-row diagnostics relative to the existing "not recognized" list.
- Whether `ensureOutlineFile` should also react to the file being deleted out
  from under a configured name (currently: never auto-created — the user clicks
  "Create file" in settings again; not watched).
