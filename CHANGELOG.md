# Changelog

All notable changes to this project are documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
