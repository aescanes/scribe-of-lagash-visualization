# Implementation plan — the Characters view of StoryLines

Status: **Built (phases 1–3).** Decisions below were confirmed by the maintainer. One refinement: a note/outline conflict is only flagged when *both* sides list characters and they differ — the outline column is optional, so an empty side is not a conflict.
Branch: `feat/characters-storylines-view`.

## Goal

Add a **view selector** (combo box on the right top section) to the StoryLines toolbar with two options:

1. **StoryLines** — today's view, unchanged: lines come from `Lines.md`, cards
   are discovered from the folder/note structure (and the Story Outline), and
   the user can drag cards, add/rename/recolour/reorder/delete lines, undo, and
   create notes from ghost cards.
2. **Characters** — a **read-only** view in the same visual style. One line per
   character; each line shows the chapters/scenes that character appears in, in
   the normal manuscript order. Nothing can be moved or edited.

The source of truth for "who appears where":

- the `scribe-note-characters` frontmatter of each real note
  (`FRONTMATTER_KEYS.characters`, already parsed into `NovelEntry.characters`);
- the `Characters` column of the Story Outline (already parsed into
  `OutlineRow.characters`), which also covers planned notes that have no file yet.

This follows the plugin's core principle: the plugin never edits notes, and the
Characters view **writes nothing at all** — not even `Lines.md`.

## What already exists and gets reused

| Need | Already there |
|---|---|
| Characters per real note | `NovelEntry.characters: string[]` (`vaultIndex.ts`) |
| Characters per outline row | `OutlineRow.characters: string[]` (`outline.ts`) |
| Real + ghost cards in manuscript order | `manuscriptColumns()` and `reconcileOutline().planned` (`canvasModel.ts`, `outline.ts`) |
| A card on several lines at once | `canvasModel` already pushes a card onto every line in `Placement.lines`; `lineView` already links sibling cards on hover (`cardEls` / `setLinked`) |
| Card rendering, board, CSS | `renderRealCard`, `renderPlannedCard`, `.scribe-canvas-*` styles |
| Line colours | `LINE_COLOR_PALETTE` in `canvasModel.ts` |

> Note: "one card belongs to exactly one line" is a rule of the StoryLines view
> (`AGENTS.md`). In Characters view a scene with two characters **must** appear
> on two lines — that is the point of the view. It is derived data, never saved,
> so it doesn't conflict with the Lines-file rule.

## Design

### 1. Pure model — `src/views/charactersModel.ts` (new, unit-tested)

`charactersModel(entries, plan, book)` → `CanvasModel`-shaped result, so the
view can reuse the existing renderer:

- Collect characters from every real entry (`entry.characters`) and every
  **planned** row (`plan.planned[].row.characters`).
- For a real note that fulfils an outline row, take the **union** of the note's
  characters and the row's (see open question 1). `reconcileOutline` will need
  to expose the fulfilling row's characters (a `fulfilledCharacters` map keyed by
  note path, next to `fulfilledLineIds`) — an additive change.
- Normalise names for matching: trim, strip `[[wikilink]]` brackets / `|alias`,
  compare case-insensitively; display the first spelling seen.
- One synthetic line per character: `{ id: "character:<normalised>", name,
  color, order }`. Order = **alphabetical** (maintainer decision); the first spelling seen in
  manuscript order is the display name.
- Card column = `manuscriptColumns(entries, planned)`, the same shared axis as
  StoryLines, so cards line up across lines and a character that skips a
  chapter leaves a visible gap.
- Notes/rows with **no** character go to the existing "Not on any line" strip,
  relabelled "No characters listed".
- Colour: deterministic from the name (hash → `LINE_COLOR_PALETTE`), so a
  character keeps its colour between sessions without storing anything.

### 2. View — `src/views/lineView.ts`

- Toolbar: a `<select>` (class `dropdown`, Obsidian's native styling) with
  **StoryLines** / **Characters**, placed at the left, after the story-folder
  name.
- `render()` branches on the view:
  - `storylines` → current code path, untouched.
  - `characters` → `charactersModel(...)` → same `renderCard` machinery with a
    `readOnly` flag.
- `readOnly` means: no `pointerdown` drag handler, no line header controls
  (rename / colour / ▲ ▼ / ✕), no "Add line", "Undo", "Align", "Add N lines",
  "Create N planned notes" buttons; ghost cards are shown dashed but a click does
  **not** create a note (see open question 3). Real cards still open their note
  on click. `Mod+Z` is a no-op in this view.
- Characters view does **not** require `Lines.md`: it works with only notes, only
  an outline, or both. The "Create lines" prompt is skipped.
- `autoPlace()` / `save()` are skipped while in Characters view (nothing to
  write); the in-memory StoryLines `layout` and its undo stack are kept so
  switching back loses nothing.
- Persist the chosen view in the leaf's view state (`getState` / `setState`) so it
  survives reloads and each open StoryLines tab remembers its own view
  (open question 2).

### 2b. View registry — `src/views/storyViews.ts` (added during the build)

So future views (locations, dates, …) don't each add `if (view === …)` checks to
the view, the views are described once in `STORY_VIEWS`: `editable`, `emptyNotice`,
`unplacedLabel`, `buildModel(ctx)`. `LineView` reads the descriptor
(`isEditable()`, one `renderBoard(root, def.buildModel(...), recon, def)` path)
and the selector is built from the registry. `parseStoryView` validates the saved
view state. Tests: `tests/views/storyViews.test.ts`.

### 3. Styles — `styles.css`

Only a few additions, Obsidian CSS variables only:
`.scribe-canvas-view-select` spacing in the toolbar and a
`.scribe-canvas-view.is-readonly` modifier (default cursor on cards, no
grab cursor). Line colour still comes from `--scribe-line-color`.

### 4. Tests — `tests/views/charactersModel.test.ts`

- one line per distinct character, case/wikilink-insensitive merge;
- scene with two characters appears on both lines at the same column;
- first-appearance line order; alphabetical tiebreak;
- frontmatter ∪ outline union for a fulfilled row; ghost-only characters;
- notes with no characters land in the "none" strip;
- stable colour for the same name;
- columns equal `manuscriptColumns` (gaps preserved).

### 5. Docs

`README.md` (new view), `CHANGELOG.md` → Unreleased, `AGENTS.md` (the "Views of a
story" section + architecture table + the one-card-one-line note), this plan.

## Phases (each shippable)

1. **Model** — `charactersModel.ts` + `fulfilledCharacters` in `reconcileOutline`
   + tests. No UI change.
2. **View** — selector, read-only rendering, selected view persisted in view state.
3. **Polish & docs** — styles, README / CHANGELOG / AGENTS.md, run
   `npm run validate`, test in the real vault.

## Open questions — need your confirmation before I start

1. **Frontmatter vs. outline when both name characters for the same note:**
  Decision: Union of both and use the same warning icon with a small message with this "conflict"
2. **Where is the selected view remembered?** 
  Decision: Per-tab view state (recommended, no setting added, in line with "favour fewer settings")
3. **Ghost cards (planned, no note yet) in Characters view:** 
  Decision: Show them dashed and non-clickable (recommended — the view is read-only)
4. **Line order for characters:** 
  Decision: Alphabetical
5. **Notes with no characters:** 
  Decision: Shown in a "No characters listed" strip (recommended)
6. **Default view when opening the view:** 
  Decision: StoryLines (recommended, current behaviour)

## Out of scope (for now)

- Editing characters from the view; a character ↔ line colour picker; reading
  characters from outside the `scribe-note-characters` / `Characters` column;
  the Locations equivalent (built since — see `locations-view-plan.md`); the
  planned Chronological view.
