// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import { characterKey, charactersModel } from "../../src/views/charactersModel";
import { manuscriptColumns } from "../../src/views/canvasModel";
import { NovelEntry, OutlineRow, PlannedEntry } from "../../src/types";
import { OutlineReconciliation } from "../../src/data/outline";

function entry(n: number, characters: string[] = [], over: Partial<NovelEntry> = {}): NovelEntry {
	const path = `Book/Chapter ${n}.md`;
	return {
		file: { path, basename: `Chapter ${n}` } as NovelEntry["file"],
		type: "chapter",
		title: `Chapter ${n}`,
		bookFolder: "Book",
		context: [],
		order: n,
		date: null,
		characters,
		locations: [],
		status: null,
		wordCount: 0,
		...over,
	};
}

function planned(n: number, characters: string[] = []): PlannedEntry {
	const row: OutlineRow = {
		rowIndex: n,
		act: null,
		folder: null,
		chapter: n,
		chapterText: String(n),
		scene: null,
		sceneText: null,
		line: null,
		summary: "plan",
		date: null,
		characters,
		locations: [],
		status: null,
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
		unknownLines: [],
		...over,
	};
}

test("characterKey strips wikilink brackets and alias, ignores case", () => {
	assert.equal(characterKey("[[Alice|Al]]"), "alice");
	assert.equal(characterKey("  ALICE "), "alice");
});

test("one line per distinct character, merged case- and wikilink-insensitively, alphabetical", () => {
	const model = charactersModel(
		[entry(1, ["bob", "Alice"]), entry(2, ["[[Alice]]", "Carl"]), entry(3, ["ALICE"])],
		plan(),
	);
	assert.deepEqual(model.lines.map((l) => l.def.name), ["Alice", "bob", "Carl"]);
	assert.equal(model.lines[0].cards.length, 3);
});

test("a scene with two characters sits on both lines at the same column", () => {
	const model = charactersModel([entry(1, ["Alice", "Bob"])], plan());
	const xs = model.lines.map((l) => l.cards[0].x);
	assert.deepEqual(xs, [0, 0]);
});

test("columns follow manuscript order and keep gaps", () => {
	const entries = [entry(1, ["Alice"]), entry(2, ["Bob"]), entry(3, ["Alice"])];
	const model = charactersModel(entries, plan());
	const cols = manuscriptColumns(entries);
	assert.deepEqual(
		model.lines[0].cards.map((c) => c.x),
		[cols.get("Book/Chapter 1.md"), cols.get("Book/Chapter 3.md")],
	);
	assert.equal(model.columnCount, 3);
});

test("notes and planned rows without characters land in the unplaced strip", () => {
	const model = charactersModel([entry(1, []), entry(2, ["Alice"])], plan({ planned: [planned(3)] }));
	assert.deepEqual(model.unplaced.map((e) => e.title), ["Chapter 1"]);
	assert.deepEqual(model.plannedUnplaced.map((p) => p.label), ["Chapter 3"]);
});

test("planned rows put ghost cards on their characters' lines", () => {
	const model = charactersModel([entry(1, ["Alice"])], plan({ planned: [planned(2, ["Alice", "Bob"])] }));
	assert.deepEqual(model.lines.map((l) => l.def.name), ["Alice", "Bob"]);
	assert.equal(model.lines[0].cards[1].kind, "planned");
});

test("a fulfilled row's characters are unioned with the note's; a difference is marked", () => {
	const model = charactersModel(
		[entry(1, ["Alice"])],
		plan({ fulfilledCharacters: { "Book/Chapter 1.md": ["Alice", "Bob"] } }),
	);
	assert.deepEqual(model.lines.map((l) => l.def.name), ["Alice", "Bob"]);
	assert.match(model.lines[0].cards[0].mark ?? "", /only in the story outline: Bob/);
});

test("matching sources, or one empty source, raise no conflict", () => {
	const same = charactersModel(
		[entry(1, ["Alice"])],
		plan({ fulfilledCharacters: { "Book/Chapter 1.md": ["alice"] } }),
	);
	assert.equal(same.lines[0].cards[0].mark, null);
	const noteEmpty = charactersModel(
		[entry(1, [])],
		plan({ fulfilledCharacters: { "Book/Chapter 1.md": ["Alice"] } }),
	);
	assert.equal(noteEmpty.lines[0].cards[0].mark, null);
});

test("a character keeps the same colour every time", () => {
	const a = charactersModel([entry(1, ["Alice"])], plan()).lines[0].def.color;
	const b = charactersModel([entry(5, ["Zed", "Alice"])], plan()).lines.find((l) => l.def.name === "Alice")?.def.color;
	assert.equal(a, b);
});
