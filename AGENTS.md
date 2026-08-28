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
never rewrites their body. The only file the plugin writes is a per-book
**companion file** that stores the visualization layout (see below).

### The first visualization — a draggable multi-timeline canvas

The headline feature is a **canvas view** (see the reference screenshot in the
project discussion): horizontal, colored **timeline lanes** stacked vertically,
with **chapter / scene cards** laid out left-to-right along each lane in
chronological / manuscript order. The user can:

- **drag a card horizontally** to reorder it within a timeline,
- **drag a card vertically** to move it to another timeline, and
- **place one card on more than one timeline** (a novel has multiple timelines —
  e.g. "main plot" vs. a character's backstory — and a chapter can sit on
  several of them at once).

Cards are discovered automatically from a **Book folder**, not hand-created.

### How chapters and scenes are discovered

1. The user points the plugin at one or more **Book folders** (a folder such as
   `Book` or `Book/The Silent City`). The plugin scans that folder recursively.
2. Each note is classified by **parsing its title** (file basename). English
   first; patterns like `Chapter 1`, `Chapter I`, `Ch. 1`, `Scene 2`,
   `Scene IV`, plus `Prologue` / `Epilogue` / `Interlude`. Roman numerals are
   decoded to integers for ordering. Notes whose title matches nothing are left
   unclassified (not shown, but surfaced in a "not recognized" affordance).
3. **Frontmatter overrides title parsing.** If a note has
   `scribe-visualization-type`, that wins over whatever the title says; likewise
   `scribe-visualization-order` overrides the number parsed from the title. This
   lets a user fix a mis-detected note without renaming it.

Title parsing is intentionally isolated (`src/data/titleParser.ts`, planned) so
other languages — the screenshot shows Spanish "Escena" — can be added later as
extra pattern tables.

### The companion file (per book)

Timeline definitions and card placements live in **one Markdown file inside the
Book folder** (default name `Timelines.md`, configurable). It is human-readable,
diff-friendly, and travels with the book. Shape:

```yaml
---
scribe-visualization: book
timelines:
  - id: main
    name: Main plot
    color: "#e06c75"
    order: 0
  - id: backstory
    name: Alice's backstory
    color: "#e5c07b"
    order: 1
placements:
  "Book/Chapter 1.md":
    timelines: [main]
    x: 0
  "Book/Chapter 2.md":
    timelines: [main, backstory]
    x: 1
---

Free-text notes about the book's structure can go in the body.
```

Rules:

- The plugin **only** writes this file (debounced, on drag/edit). It never edits
  chapter/scene note bodies.
- A newly detected chapter/scene with no placement entry is auto-added to a
  default lane so nothing silently disappears.
- A placement pointing at a note that no longer exists is kept but shown as
  "missing" rather than deleted, so a rename/move is recoverable.

## Current implementation vs. target

| Area | Built now | Target |
|---|---|---|
| Discovery | ✅ Book-folder scan + title parsing, frontmatter `-type` as override (falls back to whole-vault frontmatter scan when no book folder is set) | — |
| Layout data layer | ✅ `BookLayout` types + companion-file read/write + coercion, all tested | wire into a view |
| First view | Simple vertical list timeline ([`timelineView.ts`](src/views/timelineView.ts)), still frontmatter-`timelines`-driven | Draggable multi-timeline **canvas** reading the companion file |
| Layout storage | Companion file I/O exists; nothing writes to it yet | Canvas persists drags here (debounced) |
| Bases view | [`basesTimelineView.ts`](src/views/basesTimelineView.ts), renders Bases' grouped result | Keep; revisit once canvas lands |
| Matrix view | — | Group chapters/scenes by character / place / situation |

Keep the existing views working until the canvas replaces them. The phased build
plan is in [`docs/timeline-canvas-plan.md`](docs/timeline-canvas-plan.md).

## Architecture

Entry point: [`src/main.ts`](src/main.ts) → `ScribeVisualizationPlugin`.

| Piece | File | Responsibility |
|---|---|---|
| Plugin shell | [`src/main.ts`](src/main.ts) | onload wiring: registers views, ribbon icon, command, settings tab; owns the index as a child `Component` |
| Frontmatter + layout types | [`src/types.ts`](src/types.ts) | `FRONTMATTER_KEYS` (**single source of truth** for key names), `NovelEntry`, `ParsedTitle`, `TimelineDef`, `Placement`, `BookLayout` |
| Title parser | [`src/data/titleParser.ts`](src/data/titleParser.ts) | Pure, no Obsidian imports: `parseTitle(basename, lang) → ParsedTitle \| null`; `romanToInt`; per-language pattern tables (`en` only so far) |
| Vault / book index | [`src/data/vaultIndex.ts`](src/data/vaultIndex.ts) | Scans notes (restricted to configured book folders), classifies them (title parse, frontmatter `-type` overrides), keeps a live `NovelEntry[]`, notifies subscribers via `onChange`. First scan waits for `onLayoutReady` + `metadataCache` "resolved" (a cold start has no file list yet, and title-only notes never fire "changed"); also watches `vault` create/delete/rename, debounced. `rebuild()` is public — call it when settings change |
| Book-layout helpers | [`src/data/bookLayout.ts`](src/data/bookLayout.ts) | Pure: `parseBookLayout` (coerce loose YAML), `timelineFilePath`, `emptyBookLayout` |
| Path breadcrumb | [`src/data/pathContext.ts`](src/data/pathContext.ts) | Pure: `folderContext(filePath, baseFolder)` → the folder segments shown next to a card title (book folder and file name excluded) |
| Companion file I/O | [`src/data/timelineFile.ts`](src/data/timelineFile.ts) | `readBookLayout` / `writeBookLayout` for the per-book `Timelines.md`; write preserves the note body (`processFrontMatter`) or creates the file |
| Canvas view *(planned)* | `src/views/timelineCanvasView.ts` | `ItemView` — renders lanes + draggable cards, persists layout to the companion file |
| Simple timeline | [`src/views/timelineView.ts`](src/views/timelineView.ts) | Current `ItemView` (`VIEW_TYPE_TIMELINE`); superseded by the canvas eventually |
| Bases timeline | [`src/views/basesTimelineView.ts`](src/views/basesTimelineView.ts) | `BasesView` registered into Obsidian's core **Bases** plugin. Renders `this.data.groupedData` as-is — Bases owns all filter/sort/group |
| Settings | [`src/settings/`](src/settings/) | Book folder(s), companion-file name, default timeline |
| Styles | [`styles.css`](styles.css) | Obsidian CSS variables only (`var(--...)`) — no hardcoded colors except user-chosen timeline colors from the companion file |

### Separation of responsibility

- The **standalone views** (simple timeline, canvas) read from the index and own
  their own layout logic.
- The **Bases view** delegates *all* filtering, sorting, and grouping to Bases'
  toolbar and only renders the result. Don't make it reimplement query logic.
- **Title parsing** is a pure, isolated, per-language module — no Obsidian API
  calls inside it, so it stays trivially testable.

## Conventions (enforced — don't violate)

- **Never hardcode a frontmatter key string literal.** Reference
  `FRONTMATTER_KEYS` from [`src/types.ts`](src/types.ts). New field → add it there
  first.
- **The plugin writes only the companion file.** Never write to a chapter/scene
  note's body or frontmatter unless a task explicitly calls for it and the user
  has agreed.
- **TypeScript with `strictNullChecks`.** Avoid `any` where a real type exists.
- **Comments explain *why*, not *what*.** Match the existing sparse style.
- **Keep diffs focused** — no drive-by formatting or refactoring mixed into a
  feature/fix.
- Every source file starts with the SPDX `GPL-3.0-or-later` header + copyright.
- **License is GPL-3.0-or-later** — don't add incompatibly licensed deps.

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
[`src/data/bookLayout.ts`](src/data/bookLayout.ts) split out from
`timelineFile.ts`) so it can be imported without pulling in `obsidian`.

## Testing changes in a real vault

Copy or symlink `manifest.json`, `main.js`, and `styles.css` into
`<vault>/.obsidian/plugins/scribe-of-lagash-visualization/`, enable in Community
Plugins, and reload after each rebuild. The Bases view also needs the core
**Bases** plugin enabled (Settings → Core plugins). This repo itself lives inside
a test vault's plugin folder, so `npm run dev` already writes `main.js` in place.

## Releasing

Maintainer-only, from a clean `main`; feature PRs never bump the version. Roll
the `CHANGELOG.md` "Unreleased" heading, then
`npm version <patch|minor|major> --ignore-scripts=false` (the flag is required —
`.npmrc`'s `ignore-scripts=true` otherwise skips `version-bump.mjs`, which syncs
`manifest.json` / `versions.json`), then `git push --follow-tags`. The tag push
runs [`release.yml`](.github/workflows/release.yml). Full steps in
[CONTRIBUTING.md](CONTRIBUTING.md).

## Frontmatter schema

Only `scribe-visualization-type` is ever required, and only when you need to
override title parsing. Everything else is optional.

| Key | Type | Use |
|---|---|---|
| `scribe-visualization-type` | `"chapter"` \| `"scene"` | override title-based classification |
| `scribe-visualization-order` | number | override the number parsed from the title |
| `scribe-visualization-timelines` | string / list | seed timeline membership (companion file wins once the user drags) |
| `scribe-visualization-date` | string (free-form) | in-story date shown on the card |
| `scribe-visualization-characters` | string / list | card meta; future matrix axis |
| `scribe-visualization-places` | string / list | card meta; future matrix axis |
| `scribe-visualization-status` | string | e.g. `draft` (not yet surfaced) |
| `scribe-visualization-parent` | string | scene → chapter link (not yet surfaced) |

`VaultIndex` coerces leniently: comma-separated strings → arrays, empty/missing →
`null` or `[]`.

## Docs to keep in sync

When behavior or schema changes, update: `README.md`, `CHANGELOG.md`
("Unreleased"), [`docs/timeline-canvas-plan.md`](docs/timeline-canvas-plan.md),
and `CONTRIBUTING.md` if conventions change.
