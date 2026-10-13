// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import { GAP_COLUMN_WIDTH, GAP_FACTOR, chronologicalModel, parseDateOrder } from "../../src/views/chronologicalModel";
import { NovelEntry, OutlineRow, PlannedEntry } from "../../src/types";
import { OutlineReconciliation } from "../../src/data/outline";

function entry(n: number, date: string | null = null): NovelEntry {
	const path = `Book/Chapter ${n}.md`;
	return {
		file: { path, basename: `Chapter ${n}` } as NovelEntry["file"],
		type: "chapter",
		title: `Chapter ${n}`,
		bookFolder: "Book",
		context: [],
		order: n,
		date,
		characters: [],
		locations: [],
		status: null,
		wordCount: 0,
		excerpt: null,
	};
}

function planned(n: number, date: string | null = null): PlannedEntry {
	const row: OutlineRow = {
		rowIndex: n,
		act: null,
		chapter: n,
		chapterText: String(n),
		scene: null,
		sceneText: null,
		line: null,
		summary: "plan",
		date,
		characters: [],
		locations: [],
		status: null,
		comments: null,
	};
	return { row, type: "chapter", label: `Chapter ${n}`, expectedPath: `Book/Chapter ${n}.md`, lineId: null };
}

function plan(over: Partial<OutlineReconciliation> = {}): OutlineReconciliation {
	return {
		planned: [],
		previews: {},
		marks: {},
		fulfilledPaths: [],
		fulfilledLineIds: {},
		fulfilledCharacters: {},
		fulfilledLocations: {},
		fulfilledDates: {},
		rowPaths: {},
		unknownLines: [],
		...over,
	};
}

function titles(model: ReturnType<typeof chronologicalModel>): string[] {
	return (model.lines[0]?.cards ?? []).map((c) => c.entry?.title ?? c.planned?.label ?? "?");
}

test("one line holds the dated cards in date order, one column each", () => {
	const model = chronologicalModel(
		[entry(1, "2026-11-05"), entry(2, "2026-11-03"), entry(3, "November 2026"), entry(4, "2026-11-07")],
		plan(),
		"asc",
		"en",
	);
	assert.equal(model.lines.length, 1);
	assert.equal(model.lines[0].def.name, "Chronological");
	assert.deepEqual(titles(model), ["Chapter 3", "Chapter 2", "Chapter 1", "Chapter 4"]);
	assert.deepEqual(model.lines[0].cards.map((c) => c.x), [0, 1, 2, 3]);
	assert.equal(model.columnCount, 4);
});

test("descending reverses the dates", () => {
	const model = chronologicalModel([entry(1, "2026-01"), entry(2, "2026-03"), entry(3, "2026-02")], plan(), "desc", "en");
	assert.deepEqual(titles(model), ["Chapter 2", "Chapter 3", "Chapter 1"]);
});

test("equal dates keep chapter order, ascending or descending", () => {
	const entries = [entry(3, "2026-11-03"), entry(1, "2026-11-03"), entry(2, "2026-11-03"), entry(4, "2026-12-01")];
	assert.deepEqual(titles(chronologicalModel(entries, plan(), "asc", "en")), ["Chapter 1", "Chapter 2", "Chapter 3", "Chapter 4"]);
	assert.deepEqual(titles(chronologicalModel(entries, plan(), "desc", "en")), ["Chapter 4", "Chapter 1", "Chapter 2", "Chapter 3"]);
});

test("false years sort numerically before real ones", () => {
	const model = chronologicalModel(
		[entry(1, "January 2"), entry(2, "December 1"), entry(3, "2026"), entry(4, "November 1")],
		plan(),
		"asc",
		"en",
	);
	assert.deepEqual(titles(model), ["Chapter 4", "Chapter 2", "Chapter 1", "Chapter 3"]);
});

test("cards carry a human date label in the title language, whatever the writer typed", () => {
	const en = chronologicalModel([entry(1, "2026-11-03")], plan(), "asc", "en");
	assert.equal(en.lines[0].cards[0].dateLabel, "November 3, 2026");
	const es = chronologicalModel([entry(1, "2026-11-03")], plan(), "asc", "es");
	assert.equal(es.lines[0].cards[0].dateLabel, "3 de noviembre de 2026");
});

test("notes without a date land in the strip, in manuscript order, with no line if nothing is dated", () => {
	const model = chronologicalModel([entry(2), entry(1)], plan({ planned: [planned(3)] }), "asc", "en");
	assert.deepEqual(model.lines, []);
	assert.deepEqual(model.unplaced.map((e) => e.title), ["Chapter 1", "Chapter 2"]);
	assert.deepEqual(model.plannedUnplaced.map((p) => p.label), ["Chapter 3"]);
	assert.deepEqual(model.unplacedMarks, {});
	assert.equal(model.columnCount, 1);
});

test("an unrecognized date goes to the strip with a warning", () => {
	const model = chronologicalModel([entry(1, "Nov 3"), entry(2, "2026-01-01")], plan(), "asc", "en");
	assert.deepEqual(titles(model), ["Chapter 2"]);
	assert.deepEqual(model.unplaced.map((e) => e.title), ["Chapter 1"]);
	assert.match(model.unplacedMarks?.["Book/Chapter 1.md"] ?? "", /"Nov 3" not recognized/);
});

test("a note falls back to its outline row's date", () => {
	const model = chronologicalModel(
		[entry(1), entry(2, "2026-01-01")],
		plan({ fulfilledDates: { "Book/Chapter 1.md": "2025-06-01" } }),
		"asc",
		"en",
	);
	assert.deepEqual(titles(model), ["Chapter 1", "Chapter 2"]);
	assert.equal(model.lines[0].cards[0].mark, null);
});

test("when note and outline disagree the outline wins, with a warning", () => {
	const model = chronologicalModel(
		[entry(1, "2026-01-01"), entry(2, "2026-02-01")],
		plan({ fulfilledDates: { "Book/Chapter 1.md": "2027-01-01" } }),
		"asc",
		"en",
	);
	// Chapter 1's outline date (2027) puts it after Chapter 2 (2026-02), whatever its note says.
	assert.deepEqual(titles(model), ["Chapter 2", "Chapter 1"]);
	assert.equal(model.lines[0].cards[0].mark, null);
	assert.match(model.lines[0].cards[1].mark ?? "", /date differs between the note and the story outline/);
	assert.equal(model.lines[0].cards[1].dateLabel, "January 1, 2027");
});

test("the same moment written two ways is not a conflict", () => {
	const model = chronologicalModel(
		[entry(1, "2026-11-03")],
		plan({ fulfilledDates: { "Book/Chapter 1.md": "November 3, 2026" } }),
		"asc",
		"en",
	);
	assert.equal(model.lines[0].cards[0].mark, null);
});

test("planned rows are ordered by their row's date, interleaved with real notes", () => {
	const model = chronologicalModel(
		[entry(1, "2026-01-01"), entry(3, "2026-03-01")],
		plan({ planned: [planned(2, "2026-02-01"), planned(4)] }),
		"asc",
		"en",
	);
	assert.deepEqual(titles(model), ["Chapter 1", "Chapter 2", "Chapter 3"]);
	assert.equal(model.lines[0].cards[1].kind, "planned");
	assert.equal(model.lines[0].cards[1].dateLabel, "February 1, 2026");
	assert.deepEqual(model.plannedUnplaced.map((p) => p.label), ["Chapter 4"]);
});

test("parseDateOrder falls back to ascending", () => {
	assert.equal(parseDateOrder("desc"), "desc");
	assert.equal(parseDateOrder("asc"), "asc");
	assert.equal(parseDateOrder("up"), "asc");
	assert.equal(parseDateOrder(undefined), "asc");
});

test("a gap well past the average gets a narrow marker slice of its own", () => {
	const model = chronologicalModel(
		[entry(1, "1981-11-01"), entry(2, "1991-06-01"), entry(3, "1991-06-10"), entry(4, "1991-06-20"), entry(5, "1991-06-30")],
		plan(),
		"asc",
		"en",
	);
	const line = model.lines[0];
	assert.deepEqual(line.cards.map((c) => c.x), [0, 1.25, 2.25, 3.25, 4.25]);
	assert.deepEqual(line.gaps, [{ x: 1, width: GAP_COLUMN_WIDTH, label: "about 10 years later" }]);
	assert.equal(model.columnCount, 5.25);
});

test("the marker works the same newest first, and speaks the title language", () => {
	const entries = [entry(1, "1981-11-01"), entry(2, "1991-06-01"), entry(3, "1991-06-10"), entry(4, "1991-06-20")];
	const model = chronologicalModel(entries, plan(), "desc", "es");
	const line = model.lines[0];
	assert.deepEqual(line.cards.map((c) => c.x), [0, 1, 2, 3.25]);
	assert.deepEqual(line.gaps, [{ x: 3, width: GAP_COLUMN_WIDTH, label: "unos 10 años después" }]);
});

test("evenly spaced dates raise no marker", () => {
	const model = chronologicalModel(
		[entry(1, "2026-01"), entry(2, "2026-02"), entry(3, "2026-03"), entry(4, "2026-04")],
		plan(),
		"asc",
		"en",
	);
	assert.deepEqual(model.lines[0].gaps, []);
	assert.equal(model.columnCount, 4);
});

test("fewer than three dated cards never get a marker", () => {
	const model = chronologicalModel([entry(1, "1900"), entry(2, "2026")], plan(), "asc", "en");
	assert.deepEqual(model.lines[0].gaps, []);
	assert.equal(GAP_FACTOR, 2);
});

test("undated cards don't count towards the gaps", () => {
	const model = chronologicalModel(
		[entry(1, "2026-01-01"), entry(2), entry(3, "2026-01-11"), entry(4, "2026-01-21")],
		plan(),
		"asc",
		"en",
	);
	assert.deepEqual(model.lines[0].gaps, []);
});

test("an outline row with no date, while the note has one, warns but still uses the note's", () => {
	const withRow = chronologicalModel([entry(1, "2026-01-01")], plan({ fulfilledPaths: ["Book/Chapter 1.md"] }), "asc", "en");
	assert.match(withRow.lines[0].cards[0].mark ?? "", /story outline: empty/);
	assert.equal(withRow.lines[0].cards[0].dateLabel, "January 1, 2026");

	const noRow = chronologicalModel([entry(1, "2026-01-01")], plan(), "asc", "en");
	assert.equal(noRow.lines[0].cards[0].mark, null, "no outline row, nothing to disagree with");
});
