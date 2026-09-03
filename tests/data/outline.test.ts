// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import {
	expectedNotePath,
	outlineLineNames,
	outlineRowNumber,
	outlineRowType,
	parseOutlineTable,
	reconcileOutline,
} from "../../src/data/outline";
import { LineLayout, NovelEntry, OutlineRow } from "../../src/types";

function entry(path: string, over: Partial<NovelEntry> = {}): NovelEntry {
	return {
		file: { path, basename: path.split("/").pop()?.replace(/\.md$/, "") ?? path } as NovelEntry["file"],
		type: "chapter",
		title: path.split("/").pop()?.replace(/\.md$/, "") ?? path,
		bookFolder: "Book",
		context: [],
		order: null,
		date: null,
		characters: [],
		places: [],
		status: null,
		wordCount: 0,
		...over,
	};
}

function row(over: Partial<OutlineRow> = {}): OutlineRow {
	return {
		rowIndex: 0,
		act: null,
		folder: null,
		chapter: null,
		scene: null,
		line: null,
		summary: "",
		date: null,
		characters: [],
		places: [],
		status: null,
		...over,
	};
}

const TABLE = [
	"| Act | Chapter | Line      | Synopsis       |",
	"| --- | ------- | --------- | -------------- |",
	"| I   | 1       | [M]       | Berlín 2029.   |",
	"| I   | 2       | Main line | Investigación. |",
	"| II  |         | Main line | no chapter/scene — skipped |",
].join("\n");

test("parseOutlineTable finds the table, maps columns by name, and strips bracket shorthand", () => {
	const rows = parseOutlineTable(TABLE);
	assert.equal(rows.length, 2);
	assert.deepEqual(rows[0], {
		rowIndex: 0,
		act: "I",
		folder: null,
		chapter: 1,
		scene: null,
		line: "M",
		summary: "Berlín 2029.",
		date: null,
		characters: [],
		places: [],
		status: null,
	});
	assert.equal(rows[1].line, "Main line");
});

test("parseOutlineTable ignores unknown columns and content before/after the table", () => {
	const body = [
		"Some notes about this book.",
		"",
		"| Act | Chapter | Notes    |",
		"| --- | ------- | -------- |",
		"| I   | 1       | ignored  |",
		"",
		"More prose after the table.",
	].join("\n");
	const rows = parseOutlineTable(body);
	assert.equal(rows.length, 1);
	assert.equal(rows[0].chapter, 1);
});

test("parseOutlineTable returns [] when there is no table", () => {
	assert.deepEqual(parseOutlineTable("Just some free-text notes."), []);
	assert.deepEqual(parseOutlineTable(""), []);
});

test("parseOutlineTable: the created skeleton (help comment + empty row) has no data rows", () => {
	const skeleton = [
		"<!-- Managed by Scribe of Lagash - Visualization — created once, never rewritten.",
		"     Chapters as files, no acts . . . . . Chapter                -> Chapter 1.md",
		"     Scenes in chapter folders . . . . . Chapter + Scene        -> Chapter 1/Scene 2.md",
		"     Also recognised: Folder, Date, Characters, Places, Status. -->",
		"",
		"| Act | Chapter | Scene | Line | Synopsis |",
		"| --- | ------- | ----- | ---- | -------- |",
		"|     |         |       |      |          |",
		"",
	].join("\n");
	assert.deepEqual(parseOutlineTable(skeleton), []);
});

test("parseOutlineTable parses a Scene row and roman numerals", () => {
	const body = [
		"| Act | Chapter | Scene | Line |",
		"| --- | ------- | ----- | ---- |",
		"| I   | IV      | II    | Main |",
	].join("\n");
	const rows = parseOutlineTable(body);
	assert.deepEqual(rows[0].chapter, 4);
	assert.deepEqual(rows[0].scene, 2);
});

test("outlineRowType / outlineRowNumber", () => {
	assert.equal(outlineRowType(row({ chapter: 1 })), "chapter");
	assert.equal(outlineRowType(row({ chapter: 1, scene: 2 })), "scene");
	assert.equal(outlineRowNumber(row({ chapter: 1, scene: 2 })), 2);
	assert.equal(outlineRowNumber(row({ chapter: 1 })), 1);
});

test("expectedNotePath derives a chapter path from Act, in English and Spanish", () => {
	assert.equal(expectedNotePath(row({ act: "I", chapter: 1 }), "Book"), "Book/Act I/Chapter 1.md");
	assert.equal(expectedNotePath(row({ act: "I", chapter: 1 }), "Book", "es"), "Book/Acto I/Capítulo 1.md");
});

test("expectedNotePath nests a scene under its chapter's folder", () => {
	assert.equal(
		expectedNotePath(row({ act: "I", chapter: 1, scene: 2 }), "Book"),
		"Book/Act I/Chapter 1/Scene 2.md",
	);
});

test("expectedNotePath prefers an explicit Folder cell over Act", () => {
	assert.equal(
		expectedNotePath(row({ act: "I", folder: "Part One", chapter: 1 }), "Book"),
		"Book/Part One/Chapter 1.md",
	);
});

test("expectedNotePath omits the folder segment when there's no Act or Folder", () => {
	assert.equal(expectedNotePath(row({ chapter: 3 }), "Book"), "Book/Chapter 3.md");
});

test("expectedNotePath: a scene row with no Chapter sits directly in its folder", () => {
	assert.equal(expectedNotePath(row({ scene: 2 }), "Book"), "Book/Scene 2.md");
	assert.equal(expectedNotePath(row({ act: "I", scene: 2 }), "Book"), "Book/Act I/Scene 2.md");
});

test("expectedNotePath works with no book folder (whole-vault scan)", () => {
	assert.equal(expectedNotePath(row({ chapter: 1 }), ""), "Chapter 1.md");
	assert.equal(expectedNotePath(row({ act: "I", chapter: 1 }), ""), "Act I/Chapter 1.md");
});

test("expectedNotePath keeps a multi-segment Folder cell", () => {
	assert.equal(
		expectedNotePath(row({ folder: "Act I/Part 2", chapter: 1 }), "Book"),
		"Book/Act I/Part 2/Chapter 1.md",
	);
});

const layout: LineLayout = {
	lines: [
		{ id: "main", name: "Main line", color: "#111", order: 0 },
		{ id: "pensiones", name: "Pensiones", color: "#222", order: 1 },
	],
	placements: {
		"Book/Chapter 1.md": { lines: ["main"], x: 0 },
	},
};

test("reconcileOutline matches a fulfilled row by expected path and adds a Summary preview", () => {
	const entries = [entry("Book/Chapter 1.md", { type: "chapter", order: 1 })];
	const rows = [row({ act: null, chapter: 1, line: "Main line", summary: "Opening scene." })];
	const result = reconcileOutline(rows, entries, layout, "Book");
	assert.deepEqual(result.planned, []);
	assert.equal(result.previews["Book/Chapter 1.md"], "Opening scene.");
	assert.equal(result.marks["Book/Chapter 1.md"], undefined);
});

test("reconcileOutline matches a scene note nested under its chapter folder (Act / Chapter / Scene)", () => {
	const entries = [
		entry("Book/Act I/Chapter 1/Scene 2.md", { type: "scene", order: 2, context: ["Act I", "Chapter 1"] }),
	];
	const rows = [row({ act: "I", chapter: 1, scene: 2, line: "Main line" })];
	const result = reconcileOutline(rows, entries, layout, "Book");
	assert.deepEqual(result.planned, []);
	assert.deepEqual(result.fulfilledPaths, ["Book/Act I/Chapter 1/Scene 2.md"]);
	assert.equal(result.marks["Book/Act I/Chapter 1/Scene 2.md"], undefined);
});

test("reconcileOutline matches a scene note under a chapter folder with no Act", () => {
	const entries = [entry("Book/Chapter 2/Scene 1.md", { type: "scene", order: 1, context: ["Chapter 2"] })];
	const rows = [row({ chapter: 2, scene: 1 })];
	const result = reconcileOutline(rows, entries, layout, "Book");
	assert.deepEqual(result.fulfilledPaths, ["Book/Chapter 2/Scene 1.md"]);
	assert.equal(result.marks["Book/Chapter 2/Scene 1.md"], undefined);
});

test("reconcileOutline plans an unwritten scene row inside its chapter folder", () => {
	const result = reconcileOutline([row({ chapter: 1, scene: 2, line: "Main line" })], [], layout, "Book");
	assert.equal(result.planned.length, 1);
	assert.equal(result.planned[0].expectedPath, "Book/Chapter 1/Scene 2.md");
	assert.equal(result.planned[0].label, "Scene 2");
	assert.equal(result.planned[0].type, "scene");
});

test("reconcileOutline flags a scene note that sits in the wrong folder", () => {
	const entries = [entry("Book/Chapter 1/Scene 2.md", { type: "scene", order: 2, context: ["Chapter 1"] })];
	const rows = [row({ act: "I", chapter: 1, scene: 2 })];
	const result = reconcileOutline(rows, entries, layout, "Book");
	assert.match(result.marks["Book/Chapter 1/Scene 2.md"], /outline expects it under "Book\/Act I\/Chapter 1"/);
});

test("reconcileOutline falls back to type+number matching when the path differs", () => {
	// Note actually lives directly under the book, not under "Act I" as the row implies.
	const entries = [entry("Book/Chapter 1.md", { type: "chapter", order: 1 })];
	const rows = [row({ act: "I", chapter: 1 })];
	const result = reconcileOutline(rows, entries, layout, "Book");
	assert.equal(result.planned.length, 0);
	assert.match(result.marks["Book/Chapter 1.md"], /outline expects it under/);
});

test("reconcileOutline returns a planned entry for an unfulfilled row", () => {
	const rows = [row({ act: "I", chapter: 5, line: "Main line" })];
	const result = reconcileOutline(rows, [], layout, "Book");
	assert.equal(result.planned.length, 1);
	assert.equal(result.planned[0].expectedPath, "Book/Act I/Chapter 5.md");
	assert.equal(result.planned[0].lineId, "main");
	assert.equal(result.planned[0].label, "Chapter 5");
});

test("reconcileOutline flags a Line discrepancy without moving the real card", () => {
	const entries = [entry("Book/Chapter 1.md", { type: "chapter", order: 1 })];
	const rows = [row({ chapter: 1, line: "Pensiones" })]; // real card is placed on "main"
	const result = reconcileOutline(rows, entries, layout, "Book");
	assert.match(result.marks["Book/Chapter 1.md"], /outline says "Pensiones", placed on "Main line"/);
});

test("reconcileOutline flags a Type discrepancy", () => {
	const entries = [entry("Book/Chapter 1.md", { type: "scene", order: 1 })];
	const rows = [row({ chapter: 1 })];
	const result = reconcileOutline(rows, entries, layout, "Book");
	assert.match(result.marks["Book/Chapter 1.md"], /outline plans it as a chapter, note is a scene/);
});

test("reconcileOutline marks a ghost that was dragged onto a different line", () => {
	const rows = [row({ act: "I", chapter: 5, line: "Main line" })];
	const dragged: LineLayout = {
		...layout,
		placements: { "Book/Act I/Chapter 5.md": { lines: ["pensiones"], x: 0 } },
	};
	const result = reconcileOutline(rows, [], dragged, "Book");
	assert.equal(result.planned.length, 1);
	assert.match(result.marks["Book/Act I/Chapter 5.md"], /outline says "Main line", moved to "Pensiones"/);
});

test("reconcileOutline marks a ghost whose row has no line or an unknown line", () => {
	const rows = [row({ chapter: 7 }), row({ chapter: 8, line: "Nope" })];
	const result = reconcileOutline(rows, [], layout, "Book");
	assert.equal(result.marks["Book/Chapter 7.md"], "no line set in the story outline");
	assert.match(result.marks["Book/Chapter 8.md"], /outline's line "Nope" isn't in StoryLines.md/);
});

test("reconcileOutline keeps the no-valid-line mark even after the ghost is dragged onto a line", () => {
	const rows = [row({ chapter: 7 }), row({ chapter: 8, line: "Nope" })];
	const dragged: LineLayout = {
		...layout,
		placements: {
			...layout.placements,
			"Book/Chapter 7.md": { lines: ["main"], x: 0 },
			"Book/Chapter 8.md": { lines: ["main"], x: 1 },
		},
	};
	const result = reconcileOutline(rows, [], dragged, "Book");
	assert.equal(result.marks["Book/Chapter 7.md"], "no line set in the story outline");
	assert.match(result.marks["Book/Chapter 8.md"], /outline's line "Nope" isn't in StoryLines.md/);
});

test("reconcileOutline collects unresolved Line names for diagnostics", () => {
	const rows = [row({ chapter: 1, line: "Nope" }), row({ chapter: 2, line: "Nope" })];
	const result = reconcileOutline(rows, [], layout, "Book");
	assert.deepEqual(result.unknownLines, ["Nope"]);
	assert.equal(result.planned[0].lineId, null);
});

test("reconcileOutline reports which real notes matched a row (for orphan detection)", () => {
	const entries = [
		entry("Book/Chapter 1.md", { type: "chapter", order: 1 }),
		entry("Book/Chapter 2.md", { type: "chapter", order: 2 }),
	];
	const rows = [row({ chapter: 1 })];
	const result = reconcileOutline(rows, entries, layout, "Book");
	assert.deepEqual(result.fulfilledPaths, ["Book/Chapter 1.md"]);
});

test("reconcileOutline is a no-op for an empty table", () => {
	const result = reconcileOutline([], [], layout, "Book");
	assert.deepEqual(result, { planned: [], previews: {}, marks: {}, fulfilledPaths: [], unknownLines: [] });
});

test("outlineLineNames lists distinct Line values in first-appearance order", () => {
	const rows = [
		row({ chapter: 1, line: "Flashbacks" }),
		row({ chapter: 2, line: "Main" }),
		row({ chapter: 3, line: "flashbacks" }),
		row({ chapter: 4, line: "  Main  " }),
		row({ chapter: 5, line: null }),
		row({ chapter: 6, line: "" }),
	];
	assert.deepEqual(outlineLineNames(rows), ["Flashbacks", "Main"]);
	assert.deepEqual(outlineLineNames([]), []);
});
