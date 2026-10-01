// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_VIEW_MODE, isViewMode, parseViewMode, VIEW_MODES, viewModeIds } from "../../src/views/viewModes";
import { canvasModel } from "../../src/views/canvasModel";
import { LineLayout, NovelEntry } from "../../src/types";
import { OutlineReconciliation } from "../../src/data/outline";

const recon: OutlineReconciliation = {
	planned: [],
	previews: {},
	marks: {},
	fulfilledPaths: [],
	fulfilledLineIds: {},
	fulfilledCharacters: {},
	unknownLines: [],
};

function entry(characters: string[]): NovelEntry {
	return {
		file: { path: "Book/Chapter 1.md", basename: "Chapter 1" } as NovelEntry["file"],
		type: "chapter",
		title: "Chapter 1",
		bookFolder: "Book",
		context: [],
		order: 1,
		date: null,
		characters,
		places: [],
		status: null,
		wordCount: 0,
	};
}

test("parseViewMode falls back to the default for unknown or malformed values", () => {
	assert.equal(parseViewMode("characters"), "characters");
	assert.equal(parseViewMode("storylines"), "storylines");
	assert.equal(parseViewMode("nope"), DEFAULT_VIEW_MODE);
	assert.equal(parseViewMode(undefined), DEFAULT_VIEW_MODE);
	assert.equal(parseViewMode("toString"), DEFAULT_VIEW_MODE);
	assert.equal(isViewMode(null), false);
});

test("the selector lists every registered mode, StoryLines first", () => {
	assert.deepEqual(viewModeIds(), ["storylines", "characters"]);
	assert.equal(viewModeIds()[0], DEFAULT_VIEW_MODE);
});

test("only the StoryLines mode is editable", () => {
	assert.equal(VIEW_MODES.storylines.editable, true);
	assert.equal(VIEW_MODES.characters.editable, false);
});

test("the StoryLines mode builds exactly the canvas model", () => {
	const layout: LineLayout = {
		lines: [{ id: "main", name: "Main", color: "#111", order: 0 }],
		placements: { "Book/Chapter 1.md": { lines: ["main"], x: 0 } },
	};
	const entries = [entry(["Alice"])];
	assert.deepEqual(
		VIEW_MODES.storylines.buildModel({ entries, layout, recon }),
		canvasModel(entries, layout, recon),
	);
});

test("the Characters mode ignores the layout and groups by character", () => {
	const empty: LineLayout = { lines: [], placements: {} };
	const model = VIEW_MODES.characters.buildModel({ entries: [entry(["Alice"])], layout: empty, recon });
	assert.deepEqual(model.lines.map((l) => l.def.name), ["Alice"]);
});

test("derived modes describe their empty and unplaced states", () => {
	assert.ok(VIEW_MODES.characters.emptyNotice);
	assert.equal(VIEW_MODES.characters.unplacedLabel, "No characters listed");
	assert.equal(VIEW_MODES.storylines.emptyNotice, null);
	assert.equal(VIEW_MODES.storylines.unplacedLabel, null);
});
