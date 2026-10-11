# Implementation plan — the Chronological view of StoryLines

Status: **Built (phases 1–3).** Decisions below were confirmed by the maintainer.
Branch: `feat/chronological-view`.

A follow-up of the Characters / Locations views ([`characters-view-plan.md`](characters-view-plan.md),
[`locations-view-plan.md`](locations-view-plan.md)): same read-only, derived-data
approach, same `STORY_VIEWS` registry entry, nothing written to disk.

## Goal

A fourth option in the view selector, **Chronological**: the story's chapters and
scenes on **one single line**, ordered by their in-story date instead of by
manuscript order, ascending or descending.

The date comes from the same two places as everything else:

- the `scribe-note-date` frontmatter of a real note (`FRONTMATTER_KEYS.date`,
  already read into `NovelEntry.date`);
- the `Date` column of the Story Outline (already read into `OutlineRow.date`),
  which also covers planned notes that have no file yet.

## The date format (the core decision)

Free text can't be ordered reliably, so the plugin accepts a **small closed set
of forms** and treats everything else as "not recognized". Parsing is
case-insensitive and accent-insensitive; **English and Spanish are both always
accepted** (month names don't collide, so no language setting is needed).

| Form | Examples | Meaning |
|---|---|---|
| ISO year | `2026` | year only |
| ISO year-month | `2026-11` | month precision |
| ISO full date | `2026-11-03` | day precision |
| Month + year | `November 2026`, `Noviembre 2026`, `noviembre de 2026` | month precision |
| Month + day + year | `November 3, 2026`, `3 November 2026`, `3 de noviembre de 2026` | day precision |

**Month followed by a single number is always a *year*, never a day.** This is
the "false year" trick for stories without a real calendar: `November 1`,
`December 1`, `January 2` are November / December of year 1, then January of
year 2. A day needs a year too (`November 3, 1`). Years are any integer ≥ 1
(ISO forms need exactly 4 digits).

Rejected (shown as undated with a ⚠ saying so): a bare month (`November`), a
month + day with no year (can't be told apart from a year), slashed numeric
dates (`03/01/2026`, D/M vs M/D), impossible dates (`2026-02-30`), anything else.

Details:

- Month names: **full names only** (English and Spanish) — no abbreviations
  (`Nov`, `ene`, … are not recognized). Spanish `de` connectors are optional.
  Weekday names and ordinals (`3rd`) are not accepted.
- Days are validated against the month (Gregorian leap rule; also applied to
  false years — it only matters for Feb 29).
- Sort key = `(year, month, day)` with a missing month/day counted as 0, i.e.
  the **start of the period**: `November 2026` sorts before `November 5, 2026`.
- Mixing real and false years in one story just sorts by the number
  (`1` < `2026`). Confirmed: not detected or warned about.
- No time of day, no ranges, no BCE/negative years, no custom calendars.

## What already exists and gets reused

| Need | Already there |
|---|---|
| Date per real note | `NovelEntry.date: string \| null` (`vaultIndex.ts`) |
| Date per outline row | `OutlineRow.date` (`outline.ts`) |
| Real + ghost cards | `reconcileOutline().planned`, `canvasModel` card shapes (`kind: "real" \| "planned"`) |
| Card rendering, board, CSS | `renderRealCard` (already prints `entry.date`), `renderPlannedCard`, `.scribe-canvas-*` |
| View registry | `STORY_VIEWS` in `storyViews.ts` — the view is one entry plus a model |
| Per-tab view state | `getState` / `setState` in `lineView.ts` |

## Design

### 1. Date parser — `src/data/dateParser.ts` (new, pure, no Obsidian imports)

- `parseStoryDate(text): ParsedDate | null` where
  `ParsedDate = { year, month: number | null, day: number | null, key: number }`
  and `key = year * 10000 + (month ?? 0) * 100 + (day ?? 0)` (safe integer for years ≤ 9999… and beyond).
- Month-name tables for `en` and `es` live in this file, in the same style as
  `LANGUAGE_PATTERNS` in `titleParser.ts`. Adding a language later is one table entry.
- `compareDates(a, b)` by `key`.
- Normalization first (trim, lowercase, strip accents, drop commas and the `de`
  connector, collapse whitespace), then match against the forms above.
- `formatStoryDate(parsed, language): string` — the human label for cards (see the model section).
- `dateFormatHint()` — the one-line description of accepted forms, used by the ⚠
  message and the empty notice so the wording lives in one place.

### 2. `reconcileOutline` — `src/data/outline.ts`

Add `fulfilledDates: Record<string, string>` (note path → the row's `Date` cell),
next to `fulfilledCharacters` / `fulfilledLocations`. Additive; default `{}` in
`EMPTY_PLAN` (`canvasModel.ts`).

### 3. Pure model — `src/views/chronologicalModel.ts` (new, unit-tested)

`chronologicalModel(entries, recon, order)` → `CanvasModel`:

- **One line**, `id: "chronological"`, name "Chronological", a fixed theme-friendly
  color from `LINE_COLOR_PALETTE`.
- For a **real note**: the date is the note's `scribe-note-date`, else the
  fulfilled outline row's `Date`. If both exist and **parse to different keys**,
  the **note wins** (the folder/notes-win rule) and the card gets a `mark` ⚠
  ("date differs between the note and the story outline (…)"). If they are the
  same moment written differently (`2026-11` vs `November 2026`), no mark.
  Unlike Characters this is not a union — a card has one date.
- For a **ghost card**: its row's `Date`.
- Cards with a recognized date are sorted by `key`, ties broken by
  **manuscript order** (`manuscriptColumns`), then assigned consecutive columns
  `0..n-1` (**the column means "position in time", evenly spaced** — not a
  proportional time scale). `desc` reverses the whole sequence (the tie-break
  stays manuscript order within equal dates, in the displayed direction).
- Cards with **no date** → `unplaced` / `plannedUnplaced`, shown in a strip
  labelled "No date".
- Cards whose date **text is present but not recognized** → also in the "No
  date" strip, with `mark` = `Date "<text>" not recognized — use <hint>`.
- **Human date on the card.** A recognized date is shown in a readable form
  whatever the writer typed: `2026-11-03` → "November 3, 2026". Precision is
  preserved (`2026-11` → "November 2026", `2026` → "2026"). The label is built
  by `formatStoryDate(parsed, language)` in `dateParser.ts`, in the **title
  language** setting (`en`: "November 3, 2026" / "November 2026"; `es`: "3 de
  noviembre de 2026" / "noviembre de 2026") — no new setting. A false year
  under 1000 is spelled out so it can't be read as a day: `November 1` →
  "November, year 1" (`es`: "noviembre, año 1"); with a day, "November 3, year 1".
  The model puts it on the card as `dateLabel` (new optional field on
  `CanvasCard`); the card renders `dateLabel ?? entry.date`, so ghost cards show
  it too. Cards in **every** view show the readable form (`displayDate` in
  `dateParser.ts`, applied by the view): a date that doesn't parse is shown as typed. An **unrecognized** date shows the
  writer's raw text next to the ⚠. The files are never rewritten.

### 4. Registry — `src/views/storyViews.ts`

- `StoryView` gains `"chronological"`.
- `StoryViewContext` gains `dateOrder: "asc" | "desc"`.
- New entry: `label: "Chronological"`, `editable: false`,
  `emptyNotice`: "No dated notes found. Add a scribe-note-date to a note's
  frontmatter or a Date to the story outline (e.g. 2026-11-03, November 2026,
  3 de noviembre de 2026)."`, `unplacedLabel: "No date"`,
  `buildModel: ({ entries, recon, dateOrder }) => chronologicalModel(...)`.

### 5. View — `src/views/lineView.ts`

- **Asc / desc toggle**: a small toolbar button (icon + `aria-label`
  "Oldest first" / "Newest first"), rendered **only while the Chronological view
  is active**, next to the view selector. It is a view-state value, not a setting
  (favor fewer settings): `dateOrder` saved in `getState` / `setState` next to
  `storyView`, default `asc`, coerced by a small `parseDateOrder`.
  Toggling re-renders only; writes nothing, not even `Lines.md`.
- Everything else comes free from the read-only path: no drag, no edit
  controls, ghost cards dashed and non-clickable, real cards open their note.
- To avoid `if (view === "chronological")`, the descriptor gets an optional
  `hasDateOrder: boolean`; the toolbar reads that. (The registry stays the only
  place that knows which view is which.)

### 6. Styles — `styles.css`

Almost nothing: the order toggle reuses the existing toolbar button styles.
Obsidian CSS variables only; run `npm run lint:css`.

### 7. Time-gap markers (added after phase 3)

When two neighbouring dated cards are far apart in time, a **"…"** sits between
them.

- **Distance.** `toDayNumber(parsed)` (`dateParser.ts`) turns a date into a day
  count at the start of its period (`June 1991` = 1991-06-01), so dates of any
  precision subtract. The gap is the absolute day difference between neighbours
  (the same in ascending and descending order). Undated cards don't take part;
  equal dates give 0, which counts in the average.
- **Threshold.** A gap is "too big" when it is more than `GAP_FACTOR` (2) × the
  average gap. Needs at least 3 dated cards. A constant, not a setting.
- **Display.** The marker takes **a slice of the axis of its own**, a quarter of
  a column wide (`GAP_COLUMN_WIDTH`), so cards after it are shifted by a
  fractional amount (`CanvasLine.gaps`; `columnCount` includes it). The dots sit in a small
  card-like chip (same border, radius and shadow as a card), large and bold. The
  column guides stay on, like the other views: a rail with gaps draws them as
  elements at the right edge of every card and gap slot (`renderGapGuides`)
  instead of the repeating gradient, which wouldn't line up after a gap. The tooltip is `describeElapsed(days, language)` ("about 10 years
  later" / "unos 10 años después"; days, months or years by size).

## Tests

- `tests/data/dateParser.test.ts` — every accepted form in en and es (full
  names, accented/unaccented, abbreviations rejected, with/without `de`, comma/no comma, day-first
  and month-first); `Month N` is a year; rejects bare month, month+day without
  year, `03/01/2026`, `2026-02-30`, `2026-13`, empty/garbage; leap-year Feb 29;
  sort-key ordering (`November 2026` < `November 3, 2026` < `2026-12`);
  `formatStoryDate` per precision in en and es, including the "year N" form.
- `tests/views/chronologicalModel.test.ts` — single line; ascending/descending;
  ties fall back to manuscript order; consecutive columns; undated and
  unrecognized-date cards land in the "No date" strip (the latter with a ⚠);
  note vs. outline equal / different (note wins + ⚠); ghost cards sorted by their
  row's date; real and ghost interleaved.
- `tests/data/outline.test.ts` — `fulfilledDates`.
- `tests/views/storyViews.test.ts` — the new registry entry (not editable, labels,
  `parseStoryView("chronological")`).

## Docs (all in the same PR)

`README.md` (the view + the accepted date forms table), `CHANGELOG.md` →
Unreleased, `AGENTS.md` (replace the "*(planned)*" Chronological bullet; add
`dateParser.ts` and `chronologicalModel.ts` to the architecture table; update
the frontmatter table row for `scribe-note-date`), and the comment
`ensureOutlineFile` writes at the top of a new Outline file (mention the `Date`
forms).

## Phases (each shippable)

1. **Parser** — `dateParser.ts` + tests. No UI change.
2. **Model** — `fulfilledDates`, `chronologicalModel.ts`, registry entry + tests.
   The view appears in the selector, newest/oldest fixed to ascending.
3. **Toggle & polish** — asc/desc button and persisted `dateOrder`, README /
   CHANGELOG / AGENTS.md, `npm run validate`, test in the real vault.

## Open questions

None. Settled with the maintainer:

- Equal dates get separate, adjacent columns, ordered by chapter/scene
  (manuscript) number.
- No abbreviations — full month names only.
- Mixed real / false years sort numerically, no warning.
- Cards show a human-readable date, whatever form the writer used.

## Out of scope (for now)

Time of day, date ranges, BCE years, custom or fantasy calendars, a proportional
time scale, a "group by year" lane split, editing dates from the view, languages
other than English and Spanish, and reading the date from anywhere besides
`scribe-note-date` and the outline's `Date` column.
