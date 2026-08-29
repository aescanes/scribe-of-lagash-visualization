// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import { canvasModel, isLayoutEmpty, starterLayout } from "./canvasModel";
import { BookLayout, NovelEntry } from "../types";

function entry(path: string, over: Partial<NovelEntry> = {}): NovelEntry {
	return {
		file: { path, basename: path.split("/").pop()?.replace(/\.md$/, "") ?? path } as NovelEntry["file"],
		type: "chapter",
		source: "title",
		title: path.split("/").pop()?.replace(/\.md$/, "") ?? path,
		bookFolder: "Book",
		context: [],
		order: null,
		timelines: [],
		date: null,
		characters: [],
		places: [],
		status: null,
		parent: null,
		...over,
	};
}

const layout: BookLayout = {
	timelines: [
		{ id: "main", name: "Main", color: "#111", order: 1 },
		{ id: "back", name: "Backstory", color: "#222", order: 0 },
	],
	placements: {
		"Book/Chapter 1.md": { timelines: ["main"], x: 0 },
		"Book/Chapter 2.md": { timelines: ["main", "back"], x: 1 },
		"Book/Chapter 3.md": { timelines: ["gone"], x: 5 },
	},
};

test("canvasModel orders lanes by order and sorts cards by x", () => {
	const model = canvasModel(
		[entry("Book/Chapter 2.md"), entry("Book/Chapter 1.md")],
		layout,
	);
	assert.deepEqual(model.lanes.map((l) => l.def.id), ["back", "main"]);
	assert.deepEqual(model.lanes[1].cards.map((c) => c.entry.file.path), [
		"Book/Chapter 1.md",
		"Book/Chapter 2.md",
	]);
});

test("canvasModel places a multi-timeline card on every named lane", () => {
	const model = canvasModel([entry("Book/Chapter 2.md")], layout);
	assert.equal(model.lanes.find((l) => l.def.id === "main")?.cards.length, 1);
	assert.equal(model.lanes.find((l) => l.def.id === "back")?.cards.length, 1);
});

test("canvasModel treats missing or unknown-lane placements as unplaced", () => {
	const model = canvasModel(
		[entry("Book/Chapter 3.md"), entry("Book/Chapter 9.md")],
		layout,
	);
	assert.deepEqual(model.unplaced.map((e) => e.file.path), [
		"Book/Chapter 3.md",
		"Book/Chapter 9.md",
	]);
});

test("canvasModel columnCount spans the widest placed card", () => {
	assert.equal(canvasModel([entry("Book/Chapter 2.md")], layout).columnCount, 2);
	assert.equal(canvasModel([], { timelines: [], placements: {} }).columnCount, 1);
});

test("starterLayout puts every entry on one lane in order", () => {
	const built = starterLayout([entry("Book/a.md"), entry("Book/b.md")], {
		name: "Main plot",
		color: "#abc",
	});
	assert.equal(built.timelines.length, 1);
	assert.equal(built.timelines[0].name, "Main plot");
	assert.deepEqual(built.placements["Book/a.md"], { timelines: ["main"], x: 0 });
	assert.deepEqual(built.placements["Book/b.md"], { timelines: ["main"], x: 1 });
});

test("isLayoutEmpty", () => {
	assert.equal(isLayoutEmpty({ timelines: [], placements: {} }), true);
	assert.equal(isLayoutEmpty(layout), false);
});
