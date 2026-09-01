// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import { generateOutlineTable, replaceFirstTable } from "./outlineGenerate";
import { parseOutlineTable } from "./outline";
import { LineLayout, NovelEntry } from "../types";

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
