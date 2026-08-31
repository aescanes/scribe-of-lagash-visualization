// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import {
	addLane,
	canvasModel,
	cloneLayout,
	defaultLaneId,
	isLayoutEmpty,
	layoutsEqual,
	moveCard,
	moveLane,
	reconcilePlacements,
	removeLane,
	renameLane,
	starterLayout,
} from "./canvasModel";
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
		name: "Main line",
		color: "#abc",
	});
	assert.equal(built.timelines.length, 1);
	assert.equal(built.timelines[0].name, "Main line");
	assert.deepEqual(built.placements["Book/a.md"], { timelines: ["main"], x: 0 });
	assert.deepEqual(built.placements["Book/b.md"], { timelines: ["main"], x: 1 });
});

test("isLayoutEmpty", () => {
	assert.equal(isLayoutEmpty({ timelines: [], placements: {} }), true);
	assert.equal(isLayoutEmpty(layout), false);
});

/* ---- Phase 2 editing ops ---- */

function threeLane(): BookLayout {
	return {
		timelines: [
			{ id: "a", name: "A", color: "#1", order: 0 },
			{ id: "b", name: "B", color: "#2", order: 1 },
		],
		placements: {
			"c1.md": { timelines: ["a"], x: 0 },
			"c2.md": { timelines: ["a"], x: 1 },
			"c3.md": { timelines: ["a"], x: 2 },
			"c4.md": { timelines: ["b"], x: 0 },
		},
	};
}

const ORDER = { a: ["c1.md", "c2.md", "c3.md"], b: ["c4.md"] };

test("cloneLayout is a deep copy", () => {
	const original = threeLane();
	const copy = cloneLayout(original);
	copy.placements["c1.md"].x = 99;
	copy.timelines[0].name = "changed";
	assert.equal(original.placements["c1.md"].x, 0);
	assert.equal(original.timelines[0].name, "A");
});

test("defaultLaneId is the topmost lane", () => {
	assert.equal(defaultLaneId(threeLane()), "a");
	assert.equal(defaultLaneId({ timelines: [], placements: {} }), null);
});

test("moveCard reorders within a lane and renumbers densely", () => {
	const next = moveCard(threeLane(), "c3.md", "a", 0, ORDER);
	assert.deepEqual(
		["c3.md", "c1.md", "c2.md"].map((p) => next.placements[p].x),
		[0, 1, 2],
	);
});

test("moveCard moves a card to another lane and compacts the source", () => {
	const next = moveCard(threeLane(), "c2.md", "b", 1, ORDER);
	assert.deepEqual(next.placements["c2.md"], { timelines: ["b"], x: 1 });
	assert.deepEqual(
		["c1.md", "c3.md"].map((p) => next.placements[p].x),
		[0, 1],
	);
	assert.deepEqual(["c4.md", "c2.md"].map((p) => next.placements[p].x), [0, 1]);
});

test("reconcilePlacements appends unplaced entries after the lane's existing cards", () => {
	const { layout: next, changed } = reconcilePlacements(
		threeLane(),
		["c1.md", "c4.md", "c5.md", "c6.md"],
		"b",
	);
	assert.equal(changed, true);
	assert.deepEqual(next.placements["c5.md"], { timelines: ["b"], x: 1 });
	assert.deepEqual(next.placements["c6.md"], { timelines: ["b"], x: 2 });
	assert.equal(reconcilePlacements(threeLane(), ["c1.md"], "b").changed, false);
});

test("addLane appends with a unique id and the next order", () => {
	const { layout: next, id } = addLane(threeLane(), "A", "#333");
	assert.equal(id, "a-2");
	assert.equal(next.timelines.find((t) => t.id === "a-2")?.order, 2);
});

test("renameLane keeps the id so placements stay valid", () => {
	const next = renameLane(threeLane(), "a", "Main line");
	assert.equal(next.timelines.find((t) => t.id === "a")?.name, "Main line");
	assert.equal(next.placements["c1.md"].timelines[0], "a");
});

test("moveLane swaps order with the neighbour and clamps at the ends", () => {
	const down = moveLane(threeLane(), "a", 1);
	assert.equal(down.timelines.find((t) => t.id === "a")?.order, 1);
	assert.equal(down.timelines.find((t) => t.id === "b")?.order, 0);
	// moving the topmost lane up does nothing
	assert.equal(layoutsEqual(moveLane(threeLane(), "a", -1), threeLane()), true);
});

test("removeLane re-homes orphaned cards onto the topmost remaining lane", () => {
	const next = removeLane(threeLane(), "b");
	assert.equal(next.timelines.length, 1);
	assert.deepEqual(next.placements["c4.md"].timelines, ["a"]);
	// four cards on lane a, still dense
	assert.deepEqual(
		Object.values(next.placements)
			.map((p) => p.x)
			.sort(),
		[0, 1, 2, 3],
	);
});

test("removeLane just drops the id from a multi-lane card", () => {
	const base: BookLayout = {
		timelines: [
			{ id: "a", name: "A", color: "#1", order: 0 },
			{ id: "b", name: "B", color: "#2", order: 1 },
		],
		placements: { "c1.md": { timelines: ["a", "b"], x: 0 } },
	};
	const next = removeLane(base, "b");
	assert.deepEqual(next.placements["c1.md"].timelines, ["a"]);
});

test("layoutsEqual", () => {
	assert.equal(layoutsEqual(threeLane(), threeLane()), true);
	assert.equal(layoutsEqual(threeLane(), renameLane(threeLane(), "a", "x")), false);
});
