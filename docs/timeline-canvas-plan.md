# Implementation plan — draggable multi-timeline canvas

Status: **Phase 1 complete** (read-only canvas). This is the build plan for the first visualization
described in [`../AGENTS.md`](../AGENTS.md). Each phase is independently
shippable and leaves the plugin in a working state.

## Goal

Replace the current simple list timeline with a canvas of horizontal, colored
**timeline lanes**. Chapter / scene cards are discovered from a **Book folder**
(by parsing note titles), laid out chronologically along each lane, and can be
dragged between lanes and reordered. A card can live on multiple lanes. Layout
persists to a per-book companion Markdown file.

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

## Phase 2 — Drag & edit

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

---

## Phase 3 — Multi-timeline membership

- Card context menu / drag-with-modifier to add the card to an additional lane.
- Rendering for non-contiguous membership (linked ghosts) finalized.
- Removing a card from its last lane → confirm, then drop the placement (note
  itself is untouched).

---

## Phase 4 — Integration & polish

- Decide whether the Bases view reads companion-file timelines or stays
  property-driven (likely: leave it property-driven, document the difference).
- Retire [`src/views/timelineView.ts`](../src/views/timelineView.ts) once the
  canvas covers its use, or keep it as a lightweight "reading" mode.
- i18n scaffold: expose language selection for the title parser; add a second
  pattern table (Spanish: `Capítulo`, `Escena`) as the proof it generalizes.
- `CHANGELOG.md`, `README.md` screenshots.

---

## Open questions to resolve as we go

- Multiple books open at once — one canvas per book leaf, or a book switcher in
  one view? (Lean: one leaf per book, book chosen on open.)
- Free-form `x` vs. snapped columns — snapped is simpler and matches the
  "manuscript order" mental model; revisit if users want gaps.
- Should scenes nest under their parent chapter on the canvas, or sit inline?
  (`scribe-visualization-parent` exists for this; defer to Phase 3+.)
