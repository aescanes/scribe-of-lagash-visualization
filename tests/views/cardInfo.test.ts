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

test("the outline row's people and places win over the note's own", () => {
	assert.deepEqual(realCardMeta(entry(["Alice"], ["Castle"]), recon, []), {
		characters: ["Ron"],
		locations: ["Docks"],
	});
});

test("the note fills in what the outline row doesn't list, and with no outline it is all there is", () => {
	const onlyCharacters = { fulfilledCharacters: { "Book/Chapter 1.md": ["Ron"] }, fulfilledLocations: {} };
	assert.deepEqual(realCardMeta(entry(["Alice"], ["Castle"]), onlyCharacters, []), {
		characters: ["Ron"],
		locations: ["Castle"],
	});
	assert.deepEqual(realCardMeta(entry(["Alice"], ["Castle"]), null, []), {
		characters: ["Alice"],
		locations: ["Castle"],
	});
	assert.deepEqual(realCardMeta(entry([], []), null, []), { characters: [], locations: [] });
});

test("a view can hide the field it already groups by", () => {
	assert.deepEqual(realCardMeta(entry(["Alice"], ["Castle"]), recon, ["characters"]), {
		characters: [],
		locations: ["Docks"],
	});
	assert.deepEqual(realCardMeta(entry(["Alice"], ["Castle"]), recon, ["locations"]), {
		characters: ["Ron"],
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
