// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import { plotMatrixModel, PlotMatrixContext } from "../../src/views/plotMatrixModel";
import { reconcileOutline } from "../../src/data/outline";
import { LineLayout, NovelEntry, OutlineRow } from "../../src/types";

const layout: LineLayout = {
	lines: [{ id: "main", name: "Main line", color: "#e06c75", order: 0 }],
	placements: { "Book/Chapter 1.md": { lines: ["main"], x: 0 } },
};

function entry(path: string, over: Partial<NovelEntry> = {}): NovelEntry {
	const title = path.split("/").pop()?.replace(/\.md$/, "") ?? path;
	return {
		file: { path, basename: title } as NovelEntry["file"],
		type: "chapter",
		title,
		bookFolder: "Book",
		context: [],
		order: null,
		date: null,
		characters: [],
		locations: [],
		status: null,
		wordCount: 0,
		excerpt: null,
		...over,
	};
}

function row(over: Partial<OutlineRow>): OutlineRow {
	return {
		rowIndex: 0,
		act: null,
		chapter: null,
		chapterText: null,
		scene: null,
		sceneText: null,
		line: null,
		summary: "",
		date: null,
		characters: [],
		locations: [],
		status: null,
		comments: null,
		...over,
	};
}

function ctx(entries: NovelEntry[], rows: OutlineRow[], outlineExists: boolean): PlotMatrixContext {
	return {
		entries,
		layout,
		recon: reconcileOutline(rows, entries, layout, "Book", "en"),
		outlineRows: rows,
		outlineExists,
		language: "en",
	};
}

test("with an outline the matrix mirrors its rows, in table order, and is editable", () => {
	const rows = [
		row({ rowIndex: 0, act: "I", chapter: 1, chapterText: "1 - Start", line: "main line", summary: "Opening", date: "2026-11-03", comments: "fix" }),
		row({ rowIndex: 1, act: "I", chapter: 1, chapterText: "1", scene: 2, sceneText: "2", status: "draft" }),
	];
	const model = plotMatrixModel(ctx([entry("Book/Act I/Chapter 1 - Start.md", { order: 1, context: ["Act I"] })], rows, true));

	assert.equal(model.mode, "outline");
	assert.equal(model.editable, true);
	assert.equal(model.rows.length, 2);

	const [a, b] = model.rows;
	assert.equal(a.unit, "Chapter 1 - Start");
	assert.equal(a.act, "I");
	assert.equal(a.ghost, false);
	assert.equal(a.path, "Book/Act I/Chapter 1 - Start.md");
	assert.equal(a.lineColor, "#e06c75", "the Line cell is matched to a line by name, case-insensitively");
	assert.equal(a.dateLabel, "November 3, 2026");
	assert.equal(a.comments, "fix");
	assert.deepEqual(a.target, { rowIndex: 0, chapterText: "1 - Start", sceneText: null });

	assert.equal(b.unit, "Chapter 1 › Scene 2");
	assert.equal(b.ghost, true, "no note yet");
	assert.equal(b.path, null);
	assert.equal(b.status, "draft");
});

test("an unknown line has no color and an unparseable date is flagged but kept visible", () => {
	const rows = [row({ chapter: 1, chapterText: "1", line: "Nowhere", date: "someday" })];
	const [r] = plotMatrixModel(ctx([], rows, true)).rows;
	assert.equal(r.lineColor, null);
	assert.equal(r.line, "Nowhere");
	assert.equal(r.dateInvalid, true);
	assert.equal(r.dateLabel, "someday");
});

test("a ghost row carries the outline's mark under its expected path", () => {
	const rows = [row({ chapter: 1, chapterText: "1" })];
	const [r] = plotMatrixModel(ctx([], rows, true)).rows;
	assert.equal(r.mark, "no line set in the story outline");
});

test("an outline file with no rows is an empty, still editable matrix", () => {
	const model = plotMatrixModel(ctx([entry("Book/Chapter 1.md", { order: 1 })], [], true));
	assert.equal(model.mode, "outline");
	assert.equal(model.editable, true);
	assert.deepEqual(model.rows, []);
});

test("without an outline file the matrix is read-only and built from the notes", () => {
	const entries = [
		entry("Book/Chapter 1.md", { order: 1, characters: ["Alice"], status: "draft", excerpt: "It began." }),
		entry("Book/Act I/Chapter 2/Scene 1.md", {
			type: "scene",
			order: 1,
			context: ["Act I", "Chapter 2"],
			title: "Scene 1",
			date: "2026",
		}),
	];
	const model = plotMatrixModel(ctx(entries, [], false));

	assert.equal(model.mode, "notes");
	assert.equal(model.editable, false);
	const [a, b] = model.rows;
	assert.equal(a.unit, "Chapter 1");
	assert.equal(a.line, "Main line", "the line comes from the note's placement in Lines.md");
	assert.equal(a.lineColor, "#e06c75");
	assert.deepEqual(a.characters, ["Alice"]);
	assert.equal(a.synopsis, "It began.");
	assert.equal(a.target, null);
	assert.equal(a.comments, "");

	assert.equal(b.unit, "Chapter 2 › Scene 1");
	assert.equal(b.act, "Act I");
	assert.equal(b.dateLabel, "2026");
	assert.equal(b.ghost, false);
});

test("the Act is shown with its word, in the title language", () => {
	const rows = [row({ chapter: 1, chapterText: "1", act: "II" })];
	const [en] = plotMatrixModel(ctx([], rows, true)).rows;
	assert.equal(en.actLabel, "Act II");
	assert.equal(en.act, "II", "the editor still gets the raw cell");
	const [es] = plotMatrixModel({ ...ctx([], rows, true), language: "es" }).rows;
	assert.equal(es.actLabel, "Acto II");
});

test("status: offered values are canonical, an empty one is none, anything else is flagged but kept", () => {
	const rows = [
		row({ rowIndex: 0, chapter: 1, chapterText: "1", status: "first draft" }),
		row({ rowIndex: 1, chapter: 2, chapterText: "2", status: null }),
		row({ rowIndex: 2, chapter: 3, chapterText: "3", status: "wip" }),
	];
	const [a, b, c] = plotMatrixModel(ctx([], rows, true)).rows;
	assert.deepEqual([a.statusLabel, a.statusInvalid], ["First Draft", false]);
	assert.deepEqual([b.statusLabel, b.statusInvalid], ["", false]);
	assert.deepEqual([c.statusLabel, c.statusInvalid, c.status], ["wip", true, "wip"]);
});

test("without an outline, a scene directly under an act folder shows the act, not a chapter", () => {
	const entries = [
		entry("Book/Act II/Scene 2 - second.md", {
			type: "scene",
			order: 2,
			context: ["Act II"],
			title: "Scene 2 - second",
		}),
	];
	const [r] = plotMatrixModel(ctx(entries, [], false)).rows;
	assert.equal(r.actLabel, "Act II");
	assert.equal(r.unit, "Scene 2 - second");
});
