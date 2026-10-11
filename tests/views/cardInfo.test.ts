// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import { metaRows, plannedCardMeta, realCardMeta } from "../../src/views/cardInfo";
import { NovelEntry, OutlineRow } from "../../src/types";

function entry(characters: string[], locations: string[]): NovelEntry {
	return {
		file: { path: "Book/Chapter 1.md", basename: "Chapter 1" } as NovelEntry["file"],
		type: "chapter",
		title: "Chapter 1",
		bookFolder: "Book",
		context: [],
		order: 1,
		date: null,
		characters,
		locations,
		status: null,
		wordCount: 0,
		excerpt: null,
	};
}

const recon = {
	fulfilledCharacters: { "Book/Chapter 1.md": ["Ron"] },
	fulfilledLocations: { "Book/Chapter 1.md": ["Docks"] },
};

test("a note's own people and places win over its outline row", () => {
	assert.deepEqual(realCardMeta(entry(["Alice"], ["Castle"]), recon, []), {
		characters: ["Alice"],
		locations: ["Castle"],
	});
});

test("the outline row fills in what the note doesn't list", () => {
	assert.deepEqual(realCardMeta(entry([], ["Castle"]), recon, []), { characters: ["Ron"], locations: ["Castle"] });
	assert.deepEqual(realCardMeta(entry([], []), null, []), { characters: [], locations: [] });
});

test("a view can hide the field it already groups by", () => {
	assert.deepEqual(realCardMeta(entry(["Alice"], ["Castle"]), recon, ["characters"]), {
		characters: [],
		locations: ["Castle"],
	});
	assert.deepEqual(realCardMeta(entry(["Alice"], ["Castle"]), recon, ["locations"]), {
		characters: ["Alice"],
		locations: [],
	});
});

test("a planned card shows its row's people and places, minus the hidden ones", () => {
	const row = { characters: ["Ron"], locations: ["Docks"] } as OutlineRow;
	assert.deepEqual(plannedCardMeta(row, []), { characters: ["Ron"], locations: ["Docks"] });
	assert.deepEqual(plannedCardMeta(row, ["locations"]), { characters: ["Ron"], locations: [] });
});

test("metaRows gives one row per field with something to show, characters first", () => {
	assert.deepEqual(metaRows({ characters: ["A", "B"], locations: ["X"] }), [
		{ field: "characters", text: "A, B" },
		{ field: "locations", text: "X" },
	]);
	assert.deepEqual(metaRows({ characters: [], locations: ["X"] }), [{ field: "locations", text: "X" }]);
	assert.deepEqual(metaRows({ characters: [], locations: [] }), []);
});
