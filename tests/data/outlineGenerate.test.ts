// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import { generateOutlineTable, isOutlineRowable, outlineUnitsOf, replaceFirstTable } from "../../src/data/outlineGenerate";
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
		locations: [],
		status: null,
		wordCount: 0,
		excerpt: null,
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
		{ chapter: rows[0].chapter, scene: rows[0].scene, line: rows[0].line },
		{ chapter: 1, scene: null, line: "Main line" },
	);
	assert.deepEqual(
		{ chapter: rows[1].chapter, scene: rows[1].scene },
		{ chapter: 1, scene: 2 },
	);
});

test("generateOutlineTable: a chapter file directly under the book (no Act) round-trips", () => {
	const entries = [entry("Book/Chapter 1.md", { type: "chapter", order: 1, context: [] })];
	const rows = parseOutlineTable(generateOutlineTable(entries, layout));
	assert.deepEqual(
		{ chapter: rows[0].chapter, scene: rows[0].scene },
		{ chapter: 1, scene: null },
	);
});

test("generateOutlineTable: a scene under a chapter folder with no Act round-trips", () => {
	const entries = [
		entry("Book/Chapter 2/Scene 1.md", { type: "scene", order: 1, context: ["Chapter 2"], title: "Scene 1" }),
	];
	const rows = parseOutlineTable(generateOutlineTable(entries, layout));
	assert.deepEqual(
		{ chapter: rows[0].chapter, scene: rows[0].scene },
		{ chapter: 2, scene: 1 },
	);
});

test("generateOutlineTable: a scene directly under the book (no chapter folder) round-trips", () => {
	const entries = [entry("Book/Scene 2.md", { type: "scene", order: 2, context: [], title: "Scene 2" })];
	const rows = parseOutlineTable(generateOutlineTable(entries, layout));
	assert.deepEqual(
		{ chapter: rows[0].chapter, scene: rows[0].scene },
		{ chapter: null, scene: 2 },
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

test("outlineUnitsOf: in an Act/Scene layout the act folder is not read as a chapter", () => {
	const scene = entry("Book/Act II/Scene 2.md", { type: "scene", order: 2, context: ["Act II"], title: "Scene 2" });
	assert.deepEqual(outlineUnitsOf(scene), { chapter: null, scene: 2, chapterFolder: null, outerFolders: ["Act II"] });

	const nested = entry("Book/Act II/Chapter 2/Scene 3.md", {
		type: "scene",
		order: 3,
		context: ["Act II", "Chapter 2"],
		title: "Scene 3",
	});
	assert.deepEqual(outlineUnitsOf(nested), {
		chapter: 2,
		scene: 3,
		chapterFolder: "Chapter 2",
		outerFolders: ["Act II"],
	});
});

test("generateOutlineTable fills Act from an act folder, in the title language", () => {
	const entries = [entry("Book/Act II/Chapter 1.md", { type: "chapter", order: 1, context: ["Act II"] })];
	assert.equal(parseOutlineTable(generateOutlineTable(entries, layout))[0].act, "II");

	const es = [entry("Book/Acto III/Capítulo 1.md", { type: "chapter", order: 1, context: ["Acto III"] })];
	assert.equal(parseOutlineTable(generateOutlineTable(es, layout, "es"))[0].act, "III");

	const scene = [
		entry("Book/Act I/Scene 2.md", { type: "scene", order: 2, context: ["Act I"], title: "Scene 2" }),
	];
	const row = parseOutlineTable(generateOutlineTable(scene, layout))[0];
	assert.deepEqual([row.act, row.chapter, row.scene], ["I", null, 2]);

	const other = [entry("Book/Part 1/Chapter 1.md", { type: "chapter", order: 1, context: ["Part 1"] })];
	assert.equal(parseOutlineTable(generateOutlineTable(other, layout))[0].act, null, "not an act folder");
});

test("generateOutlineTable carries the note's date, characters, locations and status", () => {
	const entries = [
		entry("Book/Chapter 1.md", {
			type: "chapter",
			order: 1,
			date: "1981-11-01",
			characters: ["Harry", "Ron"],
			locations: ["Privet Drive"],
			status: "First Draft",
		}),
	];
	const [row] = parseOutlineTable(generateOutlineTable(entries, layout));
	assert.equal(row.date, "1981-11-01");
	assert.deepEqual(row.characters, ["Harry", "Ron"]);
	assert.deepEqual(row.locations, ["Privet Drive"]);
	assert.equal(row.status, "First Draft");
	assert.equal(row.summary, "");
	assert.equal(row.comments, null);
});

test("generateOutlineTable writes every outline column", () => {
	const table = generateOutlineTable([entry("Book/Chapter 1.md", { type: "chapter", order: 1 })], layout);
	const header = table.split("\n")[0].split("|").map((c) => c.trim()).filter(Boolean);
	assert.deepEqual(header, [
		"Act", "Chapter", "Scene", "Line", "Synopsis", "Characters", "Locations", "Date", "Status", "Comments",
	]);
});

test("generateOutlineTable puts a note with no placement on the topmost line, like the board does", () => {
	const two: LineLayout = {
		lines: [
			{ id: "b", name: "Second", color: "#111", order: 1 },
			{ id: "a", name: "First", color: "#222", order: 0 },
		],
		placements: { "Book/Chapter 2.md": { lines: ["b"], x: 1 } },
	};
	const entries = [
		entry("Book/Chapter 1.md", { type: "chapter", order: 1 }),
		entry("Book/Chapter 2.md", { type: "chapter", order: 2 }),
	];
	const rows = parseOutlineTable(generateOutlineTable(entries, two));
	assert.deepEqual(rows.map((r) => r.line), ["First", "Second"]);
	assert.deepEqual(parseOutlineTable(generateOutlineTable(entries, { lines: [], placements: {} })).map((r) => r.line), [null, null]);
});

test("generateOutlineTable keeps a pipe in a property from breaking the table", () => {
	const entries = [entry("Book/Chapter 1.md", { type: "chapter", order: 1, status: "a | b" })];
	const rows = parseOutlineTable(generateOutlineTable(entries, layout));
	assert.equal(rows.length, 1);
	assert.equal(rows[0].status, "a | b");
});
