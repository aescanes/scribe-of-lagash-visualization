# AGENTS.md

Guidance for AI agents working on this repository. Read this before making changes.

## Concept

**Scribe of Lagash: Visualization** is an Obsidian plugin that helps novelists
visualize their chapters and scenes. It is the first plugin in the
**"Scribe of Lagash"** series — a set of independent, single-concern Obsidian
plugins for planning and writing novels. Future plugins in the series reuse the
`scribe-` frontmatter prefix with *different meanings*, which is why every key
this plugin touches is namespaced `scribe-visualization-*` and centralized in
[`src/types.ts`](src/types.ts).

Core principle: **the plugin does not own the user's prose.** Chapters and scenes
are ordinary Markdown notes in the vault. The plugin discovers and reads them; it
**never rewrites an existing note's body or frontmatter.** What it does write:

- the per-book **Lines file** (`Lines.md`) — its own document, rewritten freely;
- the per-book **Outline file** — created once with an empty skeleton when the
  user names it in settings, then never touched again (hand-edited only);
- **new** chapter/scene notes, only when the user clicks a placeholder card to
  materialise a planned row (create-only; an existing note is never modified).

Standing preference (from the maintainer): **favour folder structure over
frontmatter keys and settings, to keep the plugin simple.** Propose a
folder-based approach before adding a new frontmatter field or setting.

### Views of a book

- **Line view** — the default view, and everything built so far. Chapters/scenes
  are discovered from a **book folder** by parsing note titles; the user creates
  **lines** (horizontal coloured tracks) and drags each card onto a line. The
  arrangement is saved in the Lines file. `LineView`, `VIEW_TYPE_LINE_VIEW`,
  ribbon icon / "Open lines" command.
- **Chronological view** *(planned)* — orders the same chapters/scenes by their
  `scribe-visualization-date`, and only works for notes that have that property.
  Not built yet.

> The term is **line**, not "timeline". An earlier draft called these timelines
> and also let one card sit on several at once — that multi-membership idea was
> prototyped and dropped; **one card belongs to exactly one line.**

### How chapters and scenes are discovered

1. The user points the plugin at a **book folder** (e.g. `Book` or
   `Book/The Silent City`). The plugin scans it recursively.
2. Each note is classified by **parsing its title** (file basename). `en` and
   `es` pattern tables ship: `Chapter 1` / `Ch. 1` / `Scene IV` / `Prologue`,
   `Capítulo 1` / `Cap. 1` / `Escena IV` / `Prólogo`, … Roman numerals are
   decoded. Notes whose title matches nothing are surfaced in a
   "not recognized" list.
3. The scene → chapter relationship is **folder nesting only** — a scene note
   lives inside its chapter's folder. No `parent` frontmatter key.
4. Manuscript order is **folder structure, then title number** — all of
   `Act I/…` before `Act II/…`, and within a folder by the number in the title
   (`byManuscriptOrder` in `vaultIndex.ts`). No `order` frontmatter key.

### The Lines file (per book)

Lines and card placements live in **one Markdown file inside the book folder**
(default `Lines.md`, configurable). Human-readable, diff-friendly, travels with
the book. Shape:

```yaml
---
scribe-visualization: lines
lines:
  - id: main
    name: Main line
    color: "#e06c75"
    order: 0
  - id: backstory
    name: Alice's backstory
    color: "#e5c07b"
    order: 1
placements:
  "Book/Chapter 1.md":
    lines: [main]
    x: 0
  "Book/Chapter 2.md":
    lines: [backstory]
    x: 1
---

Free-text notes about the book can go in the body.
```

Rules:

- The plugin **only** writes this file (debounced, on drag/edit). It never edits
  chapter/scene note bodies.
- A newly detected chapter/scene with no placement is auto-added to the topmost
  line so nothing silently disappears.

### The Outline file (per book) — *in progress*

An **optional** second file beside `Lines.md`: a hand-edited Markdown table for
planning chapters/scenes *before* the notes exist. Off by default; a name in the
**Outline file name** setting turns it on, and naming a not-yet-existing file
creates it with an empty skeleton (marker `scribe-visualization: outline` +
header row). Columns: `Act | Chapter | Scene | Line | Summary`, plus optional
`Folder | Date | Characters | Places | Status`; `Line` is a line name/id from
`Lines.md`.

Rows with no matching note become placeholder ("ghost") cards on the line view;
clicking one creates the note (`noteScaffold.ts`) and seeds its placement.
**The folder/file structure and `Lines.md` always win** — a row that disagrees
with a real note only adds an advisory mark to its card, never a rewrite. Full
design and build phases: [`docs/feature-plans/outline-file-plan.md`](docs/feature-plans/outline-file-plan.md).
Data layer landed; canvas rendering and the click-to-create flow are still to come.

## Architecture

Entry point: [`src/main.ts`](src/main.ts) → `ScribeVisualizationPlugin`.

| Piece | File | Responsibility |
|---|---|---|
| Plugin shell | [`src/main.ts`](src/main.ts) | onload wiring: registers the line view, ribbon icon, command, settings tab; owns the index as a child `Component` |
| Types | [`src/types.ts`](src/types.ts) | `FRONTMATTER_KEYS` (**single source of truth** for key names), `NovelEntry`, `ParsedTitle`, `Line`, `Placement`, `LineLayout`, `OutlineRow`, `PlannedEntry` |
| Title parser | [`src/data/titleParser.ts`](src/data/titleParser.ts) | Pure, no Obsidian imports: `parseTitle(basename, lang)`; `romanToInt` / `parseNumberToken`; `availableLanguages` / `languageLabel`; `actLabel` / `unitLabel` (words the Outline file builds folders/filenames from). `LANGUAGE_PATTERNS` has `en` + `es` — a new language is one entry there plus one in `LANGUAGE_LABELS` / `ACT_LABELS` |
| Outline helpers | [`src/data/outline.ts`](src/data/outline.ts) | Pure, unit-tested: `parseOutlineTable` (first GFM table → `OutlineRow[]`), `expectedNotePath`, `reconcileOutline` (rows vs. real entries → `planned` ghost cards + `previews` + discrepancy `marks` + `unknownLines`) |
| Outline file I/O | [`src/data/outlineFile.ts`](src/data/outlineFile.ts) | `outlineFilePath`, `readOutline` (marker-checked), `ensureOutlineFile` (writes the empty skeleton once, never overwrites) |
| Note scaffold | [`src/data/noteScaffold.ts`](src/data/noteScaffold.ts) | Pure: `scaffoldNoteBody(planned)` — starter body (`# title`, Summary blockquote, only the frontmatter keys the row filled) for a note created from a ghost card |
| Vault / book index | [`src/data/vaultIndex.ts`](src/data/vaultIndex.ts) | Scans notes under configured book folders, keeps the title-parsed ones as a live `NovelEntry[]` sorted by `byManuscriptOrder` (folder, then title number), notifies via `onChange`. First scan waits for `onLayoutReady` + `metadataCache` "resolved"; also watches `vault` create/delete/rename, debounced. `rebuild()` is public. `getBookFolders()` / `getEntriesForBook()` |
| Line-layout helpers | [`src/data/lineLayout.ts`](src/data/lineLayout.ts) | Pure: `parseLineLayout` (coerce loose YAML), `lineFilePath`, `emptyLineLayout` |
| Path breadcrumb | [`src/data/pathContext.ts`](src/data/pathContext.ts) | Pure: `folderContext(filePath, baseFolder)` → folder segments shown under a card title |
| Lines file I/O | [`src/data/lineFile.ts`](src/data/lineFile.ts) | `readLineLayout` / `writeLineLayout` for the per-book `Lines.md` (write preserves the note body via `processFrontMatter`, or creates the file) |
| Line render model | [`src/views/canvasModel.ts`](src/views/canvasModel.ts) | Pure, unit-tested: `canvasModel(entries, layout)` → lines + cards + `unplaced`; every layout edit (`moveCard`, `reconcilePlacements`, `addLine` / `renameLine` / `recolorLine` / `moveLine` / `removeLine`, `cloneLayout`, `starterLayout`). **All layout maths live here, not in the view.** |
| Line view | [`src/views/lineView.ts`](src/views/lineView.ts) | `ItemView` (`VIEW_TYPE_LINE_VIEW`). DOM + pointer-drag only: renders from `canvasModel`, calls the pure ops via `mutate()` (push undo snapshot → apply → debounced save → re-render). In-memory `layout` is authoritative while open; file re-read only on open / book switch |
| Settings | [`src/settings/`](src/settings/) | Book folder, Line-file name, Outline-file name (empty = off), title language |
| Styles | [`styles.css`](styles.css) | Obsidian CSS variables only (`var(--...)`) — no hardcoded colours except user-chosen line colours from the Lines file. Canvas classes are `.scribe-canvas-*`; per-line colour is `--scribe-line-color` |

### Separation of responsibility

- **The view is DOM only.** Every layout mutation is a pure function in
  `canvasModel.ts`, unit-tested. The view calls them through `mutate()`.
- **Title parsing** is a pure, isolated, per-language module — no Obsidian API
  calls — so it stays trivially testable. A card's `x` is one shared column
  index (the manuscript axis).

## Conventions (enforced — don't violate)

- **Never hardcode a frontmatter key string literal.** Reference
  `FRONTMATTER_KEYS` from [`src/types.ts`](src/types.ts).
- **Never modify an existing chapter/scene note's body or frontmatter.** The
  plugin writes its own documents (the Lines file, and the Outline file's initial
  skeleton) and may *create* a new note from a planned outline row, but editing
  prose the user wrote is off-limits unless a task explicitly calls for it and
  the user has agreed.
- **TypeScript with `strictNullChecks`.** Avoid `any` where a real type exists.
- **Comments explain *why*, not *what*.** Match the existing sparse style.
- **Keep diffs focused** — no drive-by formatting or refactoring mixed into a
  feature/fix.
- Every source file starts with the SPDX `MIT` header + copyright line.
- **License is MIT** — don't add dependencies under a copyleft (GPL/LGPL/…) or
  otherwise MIT-incompatible license.

### Supply-chain rules

- All deps pinned to **exact** versions — no `^`, `~`, `latest`
  (`.npmrc` → `save-exact=true`).
- `.npmrc` → `ignore-scripts=true`. Don't rely on dependency lifecycle scripts.
  `esbuild`'s postinstall is opted back in only via `npm run rebuild:esbuild`.
- **Prefer a small amount of first-party code over adding a dependency.**

## Commands

```bash
npm install
npm run dev     # esbuild watch → main.js (inline sourcemap)
npm run build   # tsc --noEmit type-check + minified production bundle → main.js
npm test        # esbuild-compile src/**/*.test.ts → .test-build, run node --test
npx eslint src  # flat config in eslint.config.mjs (ESLint 9)
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs `npm run build`,
`npm test`, and eslint on push/PR to `main`. All must pass before a PR.

Tests use Node's built-in `node:test` — **no test framework dependency**.
[`esbuild.test.mjs`](esbuild.test.mjs) transpiles the `*.test.ts` files (obsidian
and Node builtins left external) into `.test-build/`. Only pure modules with no
Obsidian imports are unit-tested; keep such logic in its own file (e.g.
[`src/data/lineLayout.ts`](src/data/lineLayout.ts) split out from `lineFile.ts`)
so it can be imported without pulling in `obsidian`.

## Testing changes in a real vault

Copy or symlink `manifest.json`, `main.js`, and `styles.css` into
`<vault>/.obsidian/plugins/scribe-of-lagash-visualization/`, enable in Community
Plugins, and reload after each rebuild. This repo itself lives inside a test
vault's plugin folder, so `npm run dev` already writes `main.js` in place.

## Releasing

Maintainer-only, from a clean `main`; feature PRs never bump the version. Make
sure `CHANGELOG.md`'s `## [Unreleased]` section is complete, then
`npm run version-minor` (or `-patch` / `-major`), then `git push --follow-tags`.
Each wrapper is `npm version <type> --ignore-scripts=false` — the flag is
required, since `.npmrc`'s `ignore-scripts=true` otherwise skips the hooks. The
`version` hook runs [`version-changelog.mjs`](version-changelog.mjs) (promotes
`## [Unreleased]` to `## [<version>] - <date>`) then
[`version-bump.mjs`](version-bump.mjs) (syncs `manifest.json` / `versions.json`);
the `postversion` hook runs [`version-tag.mjs`](version-tag.mjs) (writes that
CHANGELOG section into the tag message). Full steps in
[CONTRIBUTING.md](CONTRIBUTING.md).

## Frontmatter schema

Every key is **optional** — a note becomes a chapter/scene purely by its title,
its order by folder structure + the title number, its line membership by the
Lines file. These keys just add detail the cards can show:

| Key | Type | Use |
|---|---|---|
| `scribe-visualization-date` | string (free-form) | in-story date shown on the card; the coming chronological view will order by it |
| `scribe-visualization-characters` | string / list | card meta; future matrix axis |
| `scribe-visualization-places` | string / list | card meta; future matrix axis |
| `scribe-visualization-status` | string | e.g. `draft` (not yet surfaced) |

There is no `-type`, `-order`, `-timelines`, or `-parent` key — deliberately.
`VaultIndex` coerces leniently: comma-separated strings → arrays,
empty/missing → `null` or `[]`.

## Docs to keep in sync

When behavior or schema changes, update: `README.md`, `CHANGELOG.md`
("Unreleased"), the relevant plan doc under
[`docs/feature-plans/`](docs/feature-plans/) (one file per feature — e.g.
[`line-view-plan.md`](docs/feature-plans/line-view-plan.md),
[`outline-file-plan.md`](docs/feature-plans/outline-file-plan.md)), and
`CONTRIBUTING.md` if conventions change.
