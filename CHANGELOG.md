# Changelog

All notable changes to this project are documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed
- Fix process to add release notes from CHANGELOG file.

## [0.6.1](https://github.com/aescanes/scribe-of-lagash-visualization/releases/tag/0.6.1) - 2026-09-02

### Changed
- Add release notes from CHANGELOG file.

## [0.6.0](https://github.com/aescanes/scribe-of-lagash-visualization/releases/tag/0.6.0) - 2026-09-02

### Added
- The outline file's `Line` column can now create lines. When a book has no
  Lines file, the "Create lines from outline" prompt builds one line per `Line`
  value and places each existing note on the line its outline row names. When a
  Lines file already exists and the outline names a line it doesn't have, a refresh
  button appears in the toolbar; clicking it adds those lines (theme-accent
  colour) in one undoable step. Lines are only ever added — never renamed,
  recoloured, reordered, removed, and no existing card is moved.

### Changed
- The Lines file and Outline file are now created with a `(SL) ` prefix on their
  configured name, so they stand out among the book's notes — e.g. `StoryLines`
  becomes `(SL) StoryLines.md` and the default becomes `(SL) Lines.md`. Set the
  name without the prefix in settings; the plugin adds it.
- The line names will use the same color that the line and we add an icon in the count cards number.

## [0.5.0](https://github.com/aescanes/scribe-of-lagash-visualization/releases/tag/0.5.0) - 2026-09-01

### Added
- **Outline file** — an optional per-book Markdown table for planning chapters
  and scenes before the notes exist (columns Act / Chapter / Scene / Line /
  Summary, plus optional Folder / Date / Characters / Places / Status). Turn it
  on by naming it in the new **Outline file name** setting; a file that doesn't
  exist yet is created with an empty skeleton, and the plugin never rewrites it.
  - Rows with no matching note show as dashed **placeholder cards** on the line
    view, on the line and in the manuscript position the row implies. Drag them
    to reorder or move them between lines just like real cards (a dragged
    placeholder that no longer matches its row's Line gets a ⚠ marker). Click
    one (or the toolbar's **Create N planned notes**) to create the note —
    parent folders, the Summary as the body, and any Date/Characters/… cells as
    frontmatter — and it lands where the placeholder was.
  - A row's **Summary shows on its card** (placeholder or real), and if the row
    disagrees with reality (wrong line, wrong folder, chapter vs. scene) the
    card gets a ⚠ marker — the folder/file structure and `Lines.md` still win,
    nothing is rewritten.
  - Diagnostics list outline rows that name an unknown line and notes that no
    row covers. New command **Generate outline from notes** fills a still-empty
    table from the book's current notes.

### Changed
- The icon description (hover) in the sidebar was updated to "(SL) Visualization: Open lines"
- The icon in the sidebar has now custom colors (depend of light/dark scheme)

### Removed
- The pre-0.4 back-compat shims: a `Timelines.md` is no longer renamed to
  `Lines.md` on open, and the legacy `timelines:` frontmatter key is no longer
  read. The plugin has no released users relying on them.

## [0.4.0](https://github.com/aescanes/scribe-of-lagash-visualization/releases/tag/0.4.0) - 2026-08-31

### Added

- Spanish title parsing: notes named `Capítulo 3`, `Cap. 3`, `Escena II`,
  `Prólogo`, `Epílogo`, … (accents optional) are recognised when "Título
  language" is set to Español in settings. The dropdown now shows language
  names rather than codes.

### Changed

- **"Timeline" is now "line".** The horizontal tracks are *lines*, a book has a
  *line view* (ribbon icon / "Open lines" command), and its layout is stored in
  a **Lines file** (`Lines.md`; an existing `Timelines.md` is renamed on first
  open). Types, settings, and CSS classes renamed to match.
- Line view restyled: each line is a thin coloured rule with the chapter/scene
  cards sitting on top of it, instead of a tinted band. Cards stay opaque on
  hover, have a soft shadow and a coloured left edge, and a dragged card now
  tracks the pointer exactly.
- Line headers: the name shows as plain text and only turns into an input when
  clicked, with the card count `(2)` shown next to it (and hidden while editing).

### Removed

- The "Open simple timeline" list view and the Bases timeline view. The line
  view (and a coming chronological view) replace them.
- The `scribe-visualization-type`, `-order`, and `-timelines` frontmatter keys.
  A note is a chapter/scene by its **title**, its order by **folder structure
  then title number**, and its line membership by the Lines file. `-date`,
  `-characters`, `-places`, and `-status` stay.

## [0.3.0](https://github.com/aescanes/scribe-of-lagash-visualization/releases/tag/0.3.0) - 2026-08-31

### Changed

- **License changed from GPL-3.0-or-later to MIT** to align with the rest of the
  Obsidian plugin ecosystem.

## [0.2.0](https://github.com/aescanes/scribe-of-lagash-visualization/releases/tag/0.2.0) - 2026-08-31

### Added

- Timeline canvas editing: drag a card along a lane to reorder it or onto
  another lane to move it; add, rename, recolour, reorder and delete lanes from
  the lane headers and toolbar. New chapters/scenes are auto-placed on the top
  lane. Every change saves to `Timelines.md` (debounced) and `Mod+Z` / the Undo
  button step back through changes.

### Removed

- `scribe-visualization-parent` frontmatter key. The scene → chapter
  relationship is now derived only from folder nesting (a scene note lives in
  its chapter's folder), keeping the schema and settings smaller.

## [0.1.2](https://github.com/aescanes/scribe-of-lagash-visualization/releases/tag/0.1.2) - 2026-08-29

Re-release of 0.1.1 with the packaging fixed (see 0.1.1 below). No functional
change over 0.1.1.

### Fixed

- The version bump no longer skips `version-bump.mjs`, so `manifest.json` and
  `versions.json` now track the released version. A `postversion` hook
  (`version-tag.mjs`) also writes the matching `CHANGELOG.md` section into the
  git tag message.

## [0.1.1] - 2026-08-29

Superseded by 0.1.2 the same day: this release's `manifest.json` was left at
`0.1.0` because the version script did not run. The changes it was meant to
carry:

### Added

- Book-folder scanning: point the plugin at a folder and its notes are
  recognised as chapters or scenes by parsing their title (e.g. "Chapter 1",
  "Scene II", "Prologue"; English patterns, roman numerals decoded). Frontmatter
  `scribe-visualization-type` / `-order` override the parsed title.
- Settings for book folders, companion-file name, and title language.
- Per-book companion file (`Timelines.md`) read/write layer — the only file the
  plugin writes.
- Timeline cards show the note title on the first line and its folder path as a
  muted breadcrumb below it (e.g. title "Scene 1", then "Act I - Chapter I").
  The scanned book folder is omitted; the Bases view (which has no book folder)
  shows the full parent path.
- Timeline canvas view (ribbon icon / "Open timeline canvas" command): read-only
  horizontal timeline lanes for a book, cards laid out by their saved column.
  Multiple book folders get a switcher. A book with no companion file yet shows
  a "Create timeline" button that starts a single lane with every chapter/scene
  on it. Notes in the book that aren't recognised are listed separately.
- The original list view stays available as "Open simple timeline".

### Changed

- The Bases view is now named "Scribe timeline" (was "Chapter timeline").
- ESLint config migrated to the flat `eslint.config.mjs` format (ESLint 9).
- Added `npm test` (Node's built-in test runner via esbuild; no new dependency).

### Fixed

- The index could stay empty after a cold Obsidian start, and title-only notes
  (no frontmatter) that were newly created did not appear. The first scan now
  waits for `onLayoutReady` / `metadataCache` "resolved", and the index also
  watches `vault` create/delete events (debounced).

## [0.1.0] - 2026-08-28

### Added

- Timeline view: a standalone view listing chapters/scenes chronologically,
  with optional filtering by named timeline.
- Chapter timeline Bases view: the same rendering registered as a view type
  inside Obsidian's core Bases plugin, driven by Bases' own filter/sort/
  group-by-property UI.
- `scribe-visualization-*` frontmatter schema for tagging notes as chapters
  or scenes.
