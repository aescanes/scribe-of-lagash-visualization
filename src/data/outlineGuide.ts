// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

/**
 * The column guide written below the table of a new Outline file, and the
 * refresh that brings an older file's guide up to date. No Obsidian APIs —
 * unit-tested.
 */

export const OUTLINE_GUIDE_HEADING = "## Filling in the outline";

export const OUTLINE_GUIDE = [
	"## Filling in the outline",
	"",
	"Each row plans one chapter or scene. Fill the columns that match how this",
	"story is (or will be) organized on disk — pick **one** layout per story:",
	"",
	"| Layout | Columns to fill | The row's note |",
	"| --- | --- | --- |",
	"| Chapters as files | `Chapter` | `Chapter 1.md` |",
	"| …grouped in acts | `Act` + `Chapter` | `Act I/Chapter 1.md` |",
	"| Scenes in chapter folders | `Chapter` + `Scene` | `Chapter 1/Scene 2.md` |",
	"| …grouped in acts | `Act` + `Chapter` + `Scene` | `Act I/Chapter 1/Scene 2.md` |",
	"| Scenes with no chapter | `Scene` (+ optional `Act`) | `Scene 2.md` |",
	"",
	"- Numbers may be digits or roman numerals (`IV`), optionally followed by",
	"  free text, e.g. `1 - The beginning` — carried into the note's title the",
	"  same way it would be if you typed it directly. The Act / Chapter / Scene",
	"  words and the folder names follow the **Title language** setting.",
	"- `Line` — a line name or id from the StoryLines file.",
	"- `Synopsis` (optional) — shown on the card, and becomes the note body when the note",
	"  is created.",
	"- `Characters` (optional) - a list of characters involved in the chapter or scene, separated by commas.",
	"- `Locations` (optional) - a list of locations where the chapter or scene happens, separated by commas.",
	"- `Date` (optional) - the in-story date, which orders the",
	"  Chronological view. Use `2026-11-03`, `November 2026`, `November 3, 2026` or `3 de noviembre de 2026`.",
	"  Full month names in English or Spanish only. A month followed by a single",
	"  number is a year (`November 1` is November of year 1), so a story with no real",
	"  calendar can use small years. A day needs a year (`November 3, 1`).",
	"- `Status` (optional) - where the chapter or scene stands. The Plot matrix offers these values",
	"  (case doesn't matter); anything else is kept as written but flagged:",
	"  - *(empty)* - no status set.",
	"  - `TO DO` - planned, not started.",
	"  - `In Progress` - being written now.",
	"  - `First Draft` - a complete first pass exists.",
	"  - `Revised Draft` - reworked at least once.",
	"  - `Final Draft` - polished; only minor touch-ups left.",
	"  - `Done` - finished, nothing more to do.",
	"- `Comments` (optional) - your own remarks on the row. They stay in this table; they are not copied into the note.",
	"- Any column missing from the table is added automatically when the plugin reads this file.",
	"- A row with neither a Chapter nor a Scene value is ignored. Prologue /",
	"  Epilogue / Interlude have no number and can't be planned here — create",
	"  those notes directly.",
	'- Do **not** mix "chapter as a file" and "chapter as a folder" in one story.',
	"",
].join("\n");

/**
 * Returns `body` with its guide (from the heading to the end of the file)
 * replaced by the current `OUTLINE_GUIDE`, or `null` when there is nothing to
 * do. A file without the heading is left alone — the user removed the guide on
 * purpose. The guide runs to the end of the file, so text a user added below
 * it is replaced too.
 */
export function refreshOutlineGuide(body: string): string | null {
	const match = /^## Filling in the outline[ \t]*$/m.exec(body);
	if (!match) return null;
	if (body.slice(match.index).trimEnd() === OUTLINE_GUIDE.trimEnd()) return null;
	return body.slice(0, match.index) + OUTLINE_GUIDE;
}
