// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_STORY_VIEW, isStoryView, parseStoryView, STORY_VIEWS, storyViewIds } from "../../src/views/storyViews";
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
	fulfilledLocations: {},
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
		locations: [],
		status: null,
		wordCount: 0,
	};
}

test("parseStoryView falls back to the default for unknown or malformed values", () => {
	assert.equal(parseStoryView("characters"), "characters");
	assert.equal(parseStoryView("storylines"), "storylines");
	assert.equal(parseStoryView("locations"), "locations");
	assert.equal(parseStoryView("nope"), DEFAULT_STORY_VIEW);
	assert.equal(parseStoryView(undefined), DEFAULT_STORY_VIEW);
	assert.equal(parseStoryView("toString"), DEFAULT_STORY_VIEW);
	assert.equal(isStoryView(null), false);
});

test("the selector lists every registered view, StoryLines first", () => {
	assert.deepEqual(storyViewIds(), ["storylines", "characters", "locations"]);
	assert.equal(storyViewIds()[0], DEFAULT_STORY_VIEW);
});

test("only the StoryLines view is editable", () => {
	assert.equal(STORY_VIEWS.storylines.editable, true);
	assert.equal(STORY_VIEWS.characters.editable, false);
	assert.equal(STORY_VIEWS.locations.editable, false);
});

test("the StoryLines view builds exactly the canvas model", () => {
	const layout: LineLayout = {
		lines: [{ id: "main", name: "Main", color: "#111", order: 0 }],
		placements: { "Book/Chapter 1.md": { lines: ["main"], x: 0 } },
	};
	const entries = [entry(["Alice"])];
	assert.deepEqual(
		STORY_VIEWS.storylines.buildModel({ entries, layout, recon }),
		canvasModel(entries, layout, recon),
	);
});

test("the Characters view ignores the layout and groups by character", () => {
	const empty: LineLayout = { lines: [], placements: {} };
	const model = STORY_VIEWS.characters.buildModel({ entries: [entry(["Alice"])], layout: empty, recon });
	assert.deepEqual(model.lines.map((l) => l.def.name), ["Alice"]);
});

test("derived views describe their empty and unplaced states", () => {
	assert.ok(STORY_VIEWS.characters.emptyNotice);
	assert.equal(STORY_VIEWS.characters.unplacedLabel, "No characters listed");
	assert.equal(STORY_VIEWS.storylines.emptyNotice, null);
	assert.equal(STORY_VIEWS.storylines.unplacedLabel, null);
});
