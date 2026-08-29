# Changelog

All notable changes to this project are documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Timeline view: a standalone view listing chapters/scenes chronologically,
  with optional filtering by named timeline.
- Scribe timeline Bases view: the same rendering registered as a view type
  inside Obsidian's core Bases plugin, driven by Bases' own filter/sort/
  group-by-property UI.
- `scribe-visualization-*` frontmatter schema for tagging notes as chapters
  or scenes.
- Book-folder scanning: notes inside configured book folders are recognised as
  chapters or scenes by parsing their title (e.g. "Chapter 1", "Scene II",
  "Prologue"; English patterns, roman numerals decoded). Frontmatter
  `scribe-visualization-type` / `-order` override the parsed title.
- Settings for book folders, companion-file name, and title language.
- Per-book companion file (`Timelines.md`) read/write layer for the upcoming
  timeline canvas — the only file the plugin writes.
- Timeline cards show the note title on the first line and its folder path as a
  muted breadcrumb below it (e.g. title "Scene 1", then "Act I - Chapter I").
  The scanned book folder is omitted; the Bases view (which has no book folder)
  shows the full parent path.
- Timeline canvas view (ribbon icon / "Open timeline canvas" command): read-only
  horizontal timeline lanes for a book, cards laid out by their saved column.
  Multiple book folders get a switcher. A book with no companion file yet shows
  a "Create timeline" button that starts one "Main plot" lane with every
  chapter/scene on it. Notes in the book that aren't recognised as a chapter or
  scene are listed separately. Dragging cards comes next.
- The old list timeline is still available as "Open simple timeline".

### Changed

- ESLint config migrated to the flat `eslint.config.mjs` format (ESLint 9).
- Added `npm test` (Node's built-in test runner via esbuild; no new dependency).

### Fixed

- The index could stay empty after a cold Obsidian start, and title-only notes
  (no frontmatter) that were newly created did not appear. The first scan now
  waits for `onLayoutReady` / `metadataCache` "resolved", and the index also
  watches `vault` create/delete events (debounced).
