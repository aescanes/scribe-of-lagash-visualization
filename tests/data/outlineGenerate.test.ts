// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import { generateOutlineTable, isOutlineRowable, replaceFirstTable } from "../../src/data/outlineGenerate";
import { parseOutlineTable } from "../../src/data/outline";
import { LineLayout, NovelEntry } from "../../src/types";

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

const layout: LineLayout = {
	lines: [{ id: "main", name: "Main line", color: "#111", order: 0 }],
	placements: {
		"Book/Act I/Chapter 1.md": { lines: ["main"], x: 0 },
		"Book/Act I/Chapter 1/Scene 2.md": { lines: ["main"], x: 1 },
	},
};

test("generateOutlineTable emits a row per entry that round-trips through parseOutlineTable", () => {
	const entries = [
		entry("Book/Act I/Chapter 1.md", { type: "chapter", order: 1, context: ["Act I"] }),
		entry("Book/Act I/Chapter 1/Scene 2.md", {
			type: "scene",
			order: 2,
			context: ["Act I", "Chapter 1"],
			title: "Scene 2",
		}),
	];
	const table = generateOutlineTable(entries, layout);
	const rows = parseOutlineTable(table);

	assert.equal(rows.length, 2);
	assert.deepEqual(
		{ folder: rows[0].folder, chapter: rows[0].chapter, scene: rows[0].scene, line: rows[0].line },
		{ folder: "Act I", chapter: 1, scene: null, line: "Main line" },
	);
	assert.deepEqual(
		{ folder: rows[1].folder, chapter: rows[1].chapter, scene: rows[1].scene },
		{ folder: "Act I", chapter: 1, scene: 2 },
	);
});

test("generateOutlineTable: a chapter file directly under the book (no Act) round-trips", () => {
	const entries = [entry("Book/Chapter 1.md", { type: "chapter", order: 1, context: [] })];
	const rows = parseOutlineTable(generateOutlineTable(entries, layout));
	assert.deepEqual(
		{ folder: rows[0].folder, chapter: rows[0].chapter, scene: rows[0].scene },
		{ folder: null, chapter: 1, scene: null },
	);
});

test("generateOutlineTable: a scene under a chapter folder with no Act round-trips", () => {
	const entries = [
		entry("Book/Chapter 2/Scene 1.md", { type: "scene", order: 1, context: ["Chapter 2"], title: "Scene 1" }),
	];
	const rows = parseOutlineTable(generateOutlineTable(entries, layout));
	assert.deepEqual(
		{ folder: rows[0].folder, chapter: rows[0].chapter, scene: rows[0].scene },
		{ folder: null, chapter: 2, scene: 1 },
	);
});

test("generateOutlineTable: a scene directly under the book (no chapter folder) round-trips", () => {
	const entries = [entry("Book/Scene 2.md", { type: "scene", order: 2, context: [], title: "Scene 2" })];
	const rows = parseOutlineTable(generateOutlineTable(entries, layout));
	assert.deepEqual(
		{ folder: rows[0].folder, chapter: rows[0].chapter, scene: rows[0].scene },
		{ folder: null, chapter: null, scene: 2 },
	);
});

test("isOutlineRowable is false only for an unnumbered standalone unit", () => {
	assert.equal(isOutlineRowable(entry("Book/Chapter 1.md", { type: "chapter", order: 1 })), true);
	assert.equal(isOutlineRowable(entry("Book/Scene 1.md", { type: "scene", order: 1 })), true);
	assert.equal(isOutlineRowable(entry("Book/Prologue.md", { type: "chapter", order: null })), false);
});

test("generateOutlineTable omits unnumbered standalone units (Prologue) instead of emitting a dead row", () => {
	const entries = [
		entry("Book/Prologue.md", { type: "chapter", order: null, title: "Prologue", context: [] }),
		entry("Book/Chapter 1.md", { type: "chapter", order: 1, context: [] }),
	];
	const rows = parseOutlineTable(generateOutlineTable(entries, layout));
	assert.equal(rows.length, 1);
	assert.equal(rows[0].chapter, 1);
});

test("replaceFirstTable swaps the skeleton table but keeps the surrounding text", () => {
	const body = [
		"<!-- help comment -->",
		"",
		"| Act | Chapter |",
		"| --- | ------- |",
		"|     |         |",
		"",
		"My own notes stay.",
	].join("\n");
	const out = replaceFirstTable(body, "| Folder |\n| ------ |\n| Act I  |");
	assert.match(out, /help comment/);
	assert.match(out, /My own notes stay\./);
	assert.match(out, /Act I/);
	assert.doesNotMatch(out, /\| Act \| Chapter \|/);
});

test("replaceFirstTable appends when there is no table", () => {
	const out = replaceFirstTable("Just notes.\n", "| Folder |\n| ------ |");
	assert.equal(out, "Just notes.\n\n| Folder |\n| ------ |\n");
});
