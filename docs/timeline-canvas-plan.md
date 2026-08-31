# Implementation plan — draggable multi-timeline canvas

Status: **Phase 3 complete** (integration & polish). This is the build plan for the first visualization
described in [`../AGENTS.md`](../AGENTS.md). Each phase is independently
shippable and leaves the plugin in a working state.

## Goal

Replace the current simple list timeline with a canvas of horizontal, colored
**timeline lanes**. Chapter / scene cards are discovered from a **Book folder**
(by parsing note titles), laid out chronologically along each lane, each on one
lane, and can be dragged between lanes and reordered. Layout persists to a
per-book companion Markdown file.

(An earlier draft had a card living on multiple lanes at once; that was
prototyped, disliked, and dropped — see the reverted "multi-timeline
membership" idea below.)

---

## Phase 0 — Data layer (no UI) ✅ done

Delivered in [`src/types.ts`](../src/types.ts),
[`src/data/titleParser.ts`](../src/data/titleParser.ts),
[`src/data/bookLayout.ts`](../src/data/bookLayout.ts),
[`src/data/timelineFile.ts`](../src/data/timelineFile.ts), and the updated
[`src/data/vaultIndex.ts`](../src/data/vaultIndex.ts) /
[`src/settings/`](../src/settings/). Pure modules are unit-tested (`npm test`).
Notes vs. plan: the pure layout helpers were split into `bookLayout.ts` so tests
don't import `obsidian`; tests run via a small `esbuild.test.mjs` + `node --test`
(no new dependency) rather than `tsx`. The ESLint 8 `.eslintrc` was migrated to a
flat `eslint.config.mjs` for ESLint 9.

Original checklist:

**0a. Types** — [`src/types.ts`](../src/types.ts)

- `ParsedTitle = { type: EntryType; number: number | null; label: string }`
- `TimelineDef = { id: string; name: string; color: string; order: number }`
- `Placement = { timelines: string[]; x: number }`
- `BookLayout = { timelines: TimelineDef[]; placements: Record<string, Placement> }`
- Add `source: "title" | "frontmatter"` to `NovelEntry` so the UI can flag
  overridden notes.

**0b. Title parser** — `src/data/titleParser.ts` (pure, no Obsidian imports)

- `parseTitle(basename: string): ParsedTitle | null`
- English pattern table:
  - chapter: `/^\s*(chapter|ch\.?)\s+(\d+|[ivxlcdm]+)\b/i`
  - scene: `/^\s*scene\s+(\d+|[ivxlcdm]+)\b/i`
  - standalone: `/^\s*(prologue|epilogue|interlude)\b/i` → `chapter`, number `null`
- `romanToInt(s: string): number | null` helper.
- Export the pattern table shape so other languages can register later
  (`LANGUAGE_PATTERNS: Record<string, PatternTable>`), but only ship `en`.
- Tests: `src/data/titleParser.test.ts` using `node:test` + `node:assert`.
  (Add an npm script `"test": "node --test --import tsx src/**/*.test.ts"` only
  if `tsx` earns its place; otherwise test the compiled output.)

**0c. Book scanning** — extend [`src/data/vaultIndex.ts`](../src/data/vaultIndex.ts)

- New setting input: `bookFolders: string[]` (start with one, allow many).
- `rebuild()` iterates `getMarkdownFiles()` filtered to those under a book
  folder, or falls back to the whole vault when none is configured (preserves
  today's behavior).
- Classification order per note: frontmatter `scribe-visualization-type` →
  else `parseTitle(file.basename)` → else skip.
- Order key: frontmatter `order` → parsed `number` → `Infinity` (then title
  `localeCompare`).
- Keep the existing `onChange` subscription model.

**0d. Companion file I/O** — `src/data/timelineFile.ts`

- `resolvePath(bookFolder, name)` → `<bookFolder>/<name>` (default `Timelines.md`).
- `read(app, path): Promise<BookLayout>` — parse via `metadataCache` frontmatter
  (or `parseYaml` on read) with defensive defaults; missing file → empty layout.
- `write(app, path, layout): Promise<void>` — serialize frontmatter with
  `stringifyYaml`, preserve the markdown body if the file already exists
  (`app.fileManager.processFrontMatter` is the safest primitive here).
- Debounce writes (~500 ms) at the call site, not here.

Deliverable: index produces classified entries from a book folder; layout file
round-trips. No visible change yet.

---

## Phase 1 — Canvas view, read-only ✅ done

Delivered in [`src/views/timelineCanvasView.ts`](../src/views/timelineCanvasView.ts)
(the `ItemView`) and [`src/views/canvasModel.ts`](../src/views/canvasModel.ts)
(pure `canvasModel` / `starterLayout` / `isLayoutEmpty`, unit-tested).
`NovelEntry` gained `bookFolder`; `VaultIndex` gained `getBookFolders()` and
`getEntriesForBook()`. Ribbon + "Open timeline canvas" command open it; the old
list view stays as "Open simple timeline". Multi-membership renders as a copy
per lane (linked on hover) rather than a vertical span — span/ghost handling is
deferred to Phase 3. `styles.css` extended with `.scribe-canvas-*`.

Original checklist:

### 1a/1b

**1a. View** — `src/views/timelineCanvasView.ts`, `ItemView`,
`VIEW_TYPE_TIMELINE_CANVAS = "scribe-timeline-canvas"`

- Register in [`src/main.ts`](../src/main.ts) alongside the current view; point
  the ribbon icon + command at the canvas, keep the old view type registered so
  existing leaves don't break.
- On open: load `BookLayout`, subscribe to `VaultIndex.onChange`, render.
- Layout math:
  - lanes sorted by `TimelineDef.order`, each a full-width row of fixed height,
    tinted with `color` at low alpha.
  - cards positioned by `Placement.x` mapped to a column grid (e.g. 240 px
    columns) inside a horizontally scrolling container.
  - a card on N lanes renders once, vertically spanning those lanes if they are
    contiguous; otherwise renders a linked "ghost" in each lane (shared
    `data-note-path`, hover highlights all copies).
- Card content: type dot (chapter = accent, scene = muted, matching current
  `styles.css`), title, optional date, characters · places meta. Click → open
  the note. Badge when `source === "frontmatter"`.
- States: no book folder configured → setup prompt; folder set but no companion
  file → "Create timeline" button that writes a starter file with one `main`
  lane and every entry placed on it; entries not recognized → collapsible list.

**1b. Styles** — extend [`styles.css`](../styles.css) with
`.scribe-canvas`, `.scribe-canvas-lane`, `.scribe-canvas-card`,
`.scribe-canvas-scroll`. Reuse existing `--size-*` / color variables.

Deliverable: a real canvas that shows the book, read-only.

---

## Phase 2 — Drag & edit ✅ done

Pointer-drag (not HTML5 DnD) on cards: horizontal drag reorders within a lane,
vertical drag moves the card to the lane under the pointer; both snap to the
column grid and renumber the affected lanes densely. Unplaced cards can be
dragged onto a lane. Lane headers carry an inline name field, a
`<input type="color">` swatch, up/down, and delete (disabled for the only lane);
the toolbar has "Add lane" and "Undo". `Mod+Z` (view `Scope`) and the Undo
button walk a 50-deep `BookLayout` snapshot stack. New chapters/scenes are
auto-placed on the topmost lane on load and on index change. Saves are debounced
(700 ms) via `writeBookLayout` and flushed on close; while open the in-memory
`layout` is authoritative and the file is only re-read on open / book switch.

All the layout maths (`moveCard`, `reconcilePlacements`, `addLane` /
`renameLane` / `recolorLane` / `moveLane` / `removeLane`, `cloneLayout`) live as
pure functions in [`canvasModel.ts`](../src/views/canvasModel.ts) and are
unit-tested; the view only does DOM + pointer handling.

Original checklist:

- **Horizontal drag** → recompute `x` (integer column index), renumber the
  affected lane densely, debounced `timelineFile.write`.
- **Vertical drag** across a lane boundary → update `Placement.timelines`
  (single-lane move for now).
- **Toolbar**: add lane, rename, recolor (native `<input type="color">`),
  reorder lanes, delete lane (cards fall back to the default lane).
- **Auto-placement**: any classified entry missing from `placements` is appended
  to the default lane on load and persisted.
- **Undo**: keep the last N `BookLayout` snapshots in memory; `Mod+Z` while the
  view is focused.

Deliverable: fully editable single-membership canvas.

Not done / deferred: external edits to `Timelines.md` while the canvas is open
are ignored until reopen; a card can only be on one lane (a "multi-timeline
membership" prototype was built and dropped).

---

## Phase 3 — Integration & polish ✅ done

- **Bases view** — stays property-driven. [`basesTimelineView.ts`](../src/views/basesTimelineView.ts)
  reads note frontmatter and Bases' own filter/sort/group toolbar; it does not
  touch the companion file and has no lanes. Documented as such in its file
  header and `AGENTS.md`.
- **Simple list view** — kept as the zero-setup "reading" view
  ([`timelineView.ts`](../src/views/timelineView.ts), "Open simple timeline").
  It needs no book folder and no companion file, so it stays useful even before
  the canvas is set up. Not retired.
- **i18n** — `titleParser.ts` now ships `en` and `es` pattern tables
  (`Capítulo` / `Cap.`, `Escena` / `Esc.`, `Prólogo` / `Epílogo` / …, accents
  optional). `languageLabel()` gives the settings dropdown friendly names
  ("English", "Español"). Adding a language is one `LANGUAGE_PATTERNS` entry +
  one `LANGUAGE_LABELS` entry. Unit-tested, including that the tables don't
  bleed into each other.
- **Canvas restyle** — each lane is now a thin coloured line (a rail `::before`)
  with cards sitting centred on it (`top: 50%; translateY(-50%)`, coloured left
  edge), rather than a tinted full-height band. Canvas surface is
  `--background-secondary`, cards `--background-primary` + `--shadow-s`, opaque
  on hover. Drag now moves the card with an inline `transform: translate(delta)`
  from its resting spot (not `position: fixed` + `left/top`, which drifted right
  when an ancestor `contain`s or transforms the fixed containing block). Lane
  headers, colours, names, and reordering are unchanged. Ongoing: `Phase 3` is
  now the home for further small visual / UX adjustments.
- **Docs** — `CHANGELOG.md` / `README.md` updated. Screenshots still need to be
  taken in a real vault by the maintainer.

### Multi-timeline membership — dropped

An earlier plan had a card sitting on several lanes at once (right-click "add to
lane", Ctrl-drag to copy, linked ghost copies, vertical stacking). It was
implemented in full and reverted — the maintainer disliked the concept. If it
comes back it needs a fresh design, not this one.

---

## Open questions to resolve as we go

- Multiple books open at once — one canvas per book leaf, or a book switcher in
  one view? (Lean: one leaf per book, book chosen on open.)
  Response: For now we will have one one book timeline. That mean one book per vaul. That mean also that in the settings you can define only one path for this.
- Free-form `x` vs. snapped columns — snapped is simpler and matches the
  "manuscript order" mental model; revisit if users want gaps.
  Response: In the first version of the timeline we will have snapped columns, but we will add in the near future the free-form using the propieties (frontmatter)
- Should scenes nest under their parent chapter on the canvas, or sit inline?
  Response: the scene → chapter parent is derived purely from folder nesting
  (a scene note lives inside its chapter's folder) — no `scribe-visualization-parent`
  frontmatter key, to keep the plugin simple with fewer settings. On the canvas
  scenes sit inline as their own cards for now; nesting them visually under the
  chapter is a possible later refinement.
