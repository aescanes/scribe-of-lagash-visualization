# AGENTS.md

Guidance for AI agents working on this repository. Read this before making changes.

## Concept

**Scribe of Lagash: Visualization** is an Obsidian plugin that helps novelists
visualize their chapters and scenes as timelines (and, planned, matrices grouped
by character / place / situation).

Core principle: **the plugin does not own the data.** Chapters and scenes are
ordinary Markdown notes in the user's vault. A note opts in by declaring a
`scribe-visualization-type` frontmatter key (`chapter` or `scene`). The plugin
only *reads* that frontmatter and renders views on top of it — the note stays the
source of truth. Be very conservative about ever writing to user notes.

This is the **first plugin in the "Scribe of Lagash" series** — a set of
independent, single-concern plugins. Other future plugins will reuse the
`scribe-` frontmatter prefix with *different meanings*, which is why every key
this plugin touches is namespaced `scribe-visualization-*` (not just `scribe-*`)
and centralized in one place.

## Architecture

Entry point: [`src/main.ts`](src/main.ts) → `ScribeVisualizationPlugin`.

| Piece | File | Responsibility |
|---|---|---|
| Plugin shell | [`src/main.ts`](src/main.ts) | onload wiring: registers views, ribbon icon, command, settings tab; owns the `VaultIndex` as a child component |
| Frontmatter schema + types | [`src/types.ts`](src/types.ts) | `FRONTMATTER_KEYS` (the **single source of truth** for key names) and `NovelEntry` |
| Vault index | [`src/data/vaultIndex.ts`](src/data/vaultIndex.ts) | `Component` that scans all Markdown files, parses tagged notes into `NovelEntry[]`, keeps it live via `metadataCache` / `vault` events, notifies subscribers through `onChange` |
| Standalone timeline | [`src/views/timelineView.ts`](src/views/timelineView.ts) | `ItemView` (`VIEW_TYPE_TIMELINE`). Reads from `VaultIndex`, does its own timeline-name filter dropdown, re-renders on index change |
| Bases timeline | [`src/views/basesTimelineView.ts`](src/views/basesTimelineView.ts) | `BasesView` (`BASES_VIEW_TYPE_TIMELINE`) registered into Obsidian's core **Bases** plugin. Renders `this.data.groupedData` as-is |
| Settings | [`src/settings/settings.ts`](src/settings/settings.ts), [`src/settings/settingsTab.ts`](src/settings/settingsTab.ts) | Just `defaultTimeline` so far |
| Styles | [`styles.css`](styles.css) | Uses Obsidian CSS variables only (`var(--...)`) — no hardcoded colors, so themes work |

### Data flow

```
vault notes (frontmatter) ──▶ VaultIndex.rebuild() ──▶ NovelEntry[]
                                     │
                                     ├─▶ TimelineView (subscribes via onChange)
                                     └─▶ SettingsTab (getTimelineNames)

Bases (.base file: filter/sort/group) ──▶ ScribeTimelineBasesView.onDataUpdated()
```

The two timeline views deliberately do **not** share rendering code right now.
The standalone view filters/sorts itself (via `VaultIndex`); the Bases view
delegates *all* filtering, sorting, and grouping to Bases' own toolbar and only
renders the result. Keep that separation of responsibility — don't make the Bases
view reimplement query logic.

## Conventions (enforced — don't violate)

- **Never hardcode a frontmatter key string literal.** Always reference
  `FRONTMATTER_KEYS` from [`src/types.ts`](src/types.ts). Adding a new field means
  adding it there first.
- **TypeScript with `strictNullChecks`.** Avoid `any` where a real type exists.
- **Comments explain *why*, not *what*.** Only add a comment where intent isn't
  obvious from names/structure. Match the existing sparse comment style.
- **Keep diffs focused.** No drive-by formatting or refactoring mixed into a
  feature/fix.
- Every source file starts with the SPDX GPL-3.0-or-later header + copyright line.
- **License is GPL-3.0-or-later.** Don't add dependencies with incompatible
  licenses.

### Supply-chain rules

- All deps in `package.json` are pinned to **exact** versions — no `^`, `~`, or
  `latest`. `.npmrc` has `save-exact=true`.
- `.npmrc` has `ignore-scripts=true`. Don't rely on dependency lifecycle scripts.
  `esbuild`'s postinstall is opted back in only via `npm run rebuild:esbuild`.
- **Prefer first-party code over adding a dependency.**

## Commands

```bash
npm install
npm run dev     # esbuild watch → main.js (inline sourcemap)
npm run build   # tsc --noEmit type-check + minified production bundle → main.js
npx eslint src --ext .ts
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs `npm run build`
and the eslint command on push/PR to `main`. Both must pass before a PR.

`main.js` is the bundled build output (committed for release). The build entry is
`src/main.ts`; `obsidian`, `electron`, CodeMirror, and Node builtins are marked
external in [`esbuild.config.mjs`](esbuild.config.mjs).

## Testing changes in a real vault

Copy or symlink `manifest.json`, `main.js`, and `styles.css` into
`<vault>/.obsidian/plugins/scribe-of-lagash-visualization/`, then enable in
Community Plugins and reload after each rebuild. The Bases view also requires the
core **Bases** plugin enabled (Settings → Core plugins).

## Frontmatter schema

Only `scribe-visualization-type` is required; everything else is optional and
just enables richer views.

| Key | Type | Use |
|---|---|---|
| `scribe-visualization-type` | `"chapter"` \| `"scene"` | **required** — opts the note in |
| `scribe-visualization-order` | number | manuscript order; sort key when no date |
| `scribe-visualization-timelines` | string / list | which named timeline(s) the entry belongs to |
| `scribe-visualization-date` | string (free-form) | in-story date shown on the card |
| `scribe-visualization-characters` | string / list | shown in card meta |
| `scribe-visualization-places` | string / list | shown in card meta |
| `scribe-visualization-status` | string | e.g. `draft` (not yet surfaced in UI) |
| `scribe-visualization-parent` | string | scene → chapter link (not yet surfaced in UI) |

`VaultIndex` coerces values leniently: comma-separated strings become arrays,
empty/missing → `null` or `[]`.

## Roadmap / current state

- Version `0.1.0`, initial commit. `CHANGELOG.md` "Unreleased" section tracks work.
- **Planned next:** a matrix view grouping chapters/scenes by character, place, or
  situation — both as a standalone view and a Bases view. When building it, follow
  the same pattern: standalone reads `VaultIndex`, Bases view renders Bases'
  grouped result.
- `status` and `parent` frontmatter are parsed but not yet displayed — wiring them
  into the UI is fair game.

## Docs to keep in sync

When you change behavior or the schema, update: `README.md`, `CHANGELOG.md`
("Unreleased"), and `CONTRIBUTING.md` if conventions change.
