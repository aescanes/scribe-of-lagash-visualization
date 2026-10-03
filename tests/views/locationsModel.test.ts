// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import { locationKey, locationsModel } from "../../src/views/locationsModel";
import { NovelEntry, OutlineRow, PlannedEntry } from "../../src/types";
import { OutlineReconciliation } from "../../src/data/outline";

function entry(n: number, locations: string[] = [], over: Partial<NovelEntry> = {}): NovelEntry {
	const path = `Book/Chapter ${n}.md`;
	return {
		file: { path, basename: `Chapter ${n}` } as NovelEntry["file"],
		type: "chapter",
		title: `Chapter ${n}`,
		bookFolder: "Book",
		context: [],
		order: n,
		date: null,
		characters: [],
		locations,
		status: null,
		wordCount: 0,
		...over,
	};
}

function planned(n: number, locations: string[] = []): PlannedEntry {
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
		characters: [],
		locations,
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

test("locationKey strips wikilink brackets and alias, ignores case", () => {
	assert.equal(locationKey("[[Riverside Tavern|the Tavern]]"), "riverside tavern");
	assert.equal(locationKey("  TAVERN "), "tavern");
});

test("one line per distinct location, merged case- and wikilink-insensitively, alphabetical", () => {
	const model = locationsModel(
		[entry(1, ["tavern", "Castle"]), entry(2, ["[[Castle]]", "Docks"]), entry(3, ["CASTLE"])],
		plan(),
	);
	assert.deepEqual(model.lines.map((l) => l.def.name), ["Castle", "Docks", "tavern"]);
	assert.deepEqual(model.lines.map((l) => l.def.id), ["location:castle", "location:docks", "location:tavern"]);
	assert.equal(model.lines[0].cards.length, 3);
});

test("a scene in two locations sits on both lines at the same column", () => {
	const model = locationsModel([entry(1, ["Castle", "Docks"])], plan());
	assert.deepEqual(model.lines.map((l) => l.cards[0].x), [0, 0]);
});

test("notes and planned rows without locations land in the unplaced strip", () => {
	const model = locationsModel([entry(1), entry(2, ["Castle"])], plan({ planned: [planned(3)] }));
	assert.equal(model.unplaced.length, 1);
	assert.equal(model.plannedUnplaced.length, 1);
});

test("planned rows put ghost cards on their locations' lines", () => {
	const model = locationsModel([entry(1, ["Castle"])], plan({ planned: [planned(2, ["Castle"])] }));
	assert.deepEqual(model.lines[0].cards.map((c) => c.kind), ["real", "planned"]);
});

test("a fulfilled row's locations are unioned with the note's; a difference is marked", () => {
	const model = locationsModel(
		[entry(1, ["Castle"])],
		plan({ fulfilledLocations: { "Book/Chapter 1.md": ["Castle", "Docks"] } }),
	);
	assert.deepEqual(model.lines.map((l) => l.def.name), ["Castle", "Docks"]);
	assert.match(model.lines[0].cards[0].mark ?? "", /locations differ/);
});

test("character data does not leak into the Locations model", () => {
	const model = locationsModel(
		[entry(1, [], { characters: ["Alice"] })],
		plan({ fulfilledCharacters: { "Book/Chapter 1.md": ["Bob"] } }),
	);
	assert.equal(model.lines.length, 0);
});
