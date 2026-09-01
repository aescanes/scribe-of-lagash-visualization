// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import {
	addLine,
	applyPlannedPlacements,
	canvasModel,
	cloneLayout,
	defaultLineId,
	isLayoutEmpty,
	layoutsEqual,
	lineOrderFromModel,
	moveCard,
	moveLine,
	reconcilePlacements,
	removeLine,
	renameLine,
	starterLayout,
} from "./canvasModel";
import { LineLayout, NovelEntry, OutlineRow, PlannedEntry } from "../types";
import { OutlineReconciliation } from "../data/outline";

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
	lines: [
		{ id: "main", name: "Main", color: "#111", order: 1 },
		{ id: "back", name: "Backstory", color: "#222", order: 0 },
	],
	placements: {
		"Book/Chapter 1.md": { lines: ["main"], x: 0 },
		"Book/Chapter 2.md": { lines: ["main", "back"], x: 1 },
		"Book/Chapter 3.md": { lines: ["gone"], x: 5 },
	},
};

test("canvasModel orders lines by order and sorts cards by x", () => {
	const model = canvasModel([entry("Book/Chapter 2.md"), entry("Book/Chapter 1.md")], layout);
	assert.deepEqual(model.lines.map((l) => l.def.id), ["back", "main"]);
	assert.deepEqual(model.lines[1].cards.map((c) => c.entry?.file.path), [
		"Book/Chapter 1.md",
		"Book/Chapter 2.md",
	]);
});

test("canvasModel places a card on every line its placement names", () => {
	const model = canvasModel([entry("Book/Chapter 2.md")], layout);
	assert.equal(model.lines.find((l) => l.def.id === "main")?.cards.length, 1);
	assert.equal(model.lines.find((l) => l.def.id === "back")?.cards.length, 1);
});

test("canvasModel treats missing or unknown-line placements as unplaced", () => {
	const model = canvasModel([entry("Book/Chapter 3.md"), entry("Book/Chapter 9.md")], layout);
	assert.deepEqual(model.unplaced.map((e) => e.file.path), [
		"Book/Chapter 3.md",
		"Book/Chapter 9.md",
	]);
});

test("canvasModel columnCount spans the widest placed card", () => {
	assert.equal(canvasModel([entry("Book/Chapter 2.md")], layout).columnCount, 2);
	assert.equal(canvasModel([], { lines: [], placements: {} }).columnCount, 1);
});

test("starterLayout puts every entry on one line in order", () => {
	const built = starterLayout([entry("Book/a.md"), entry("Book/b.md")], {
		name: "Main line",
		color: "#abc",
	});
	assert.equal(built.lines.length, 1);
	assert.equal(built.lines[0].name, "Main line");
	assert.deepEqual(built.placements["Book/a.md"], { lines: ["main"], x: 0 });
	assert.deepEqual(built.placements["Book/b.md"], { lines: ["main"], x: 1 });
});

test("isLayoutEmpty", () => {
	assert.equal(isLayoutEmpty({ lines: [], placements: {} }), true);
	assert.equal(isLayoutEmpty(layout), false);
});

/* ---- outline merge ---- */

function outlineRow(over: Partial<OutlineRow> = {}): OutlineRow {
	return {
		rowIndex: 0,
		act: null,
		folder: null,
		chapter: null,
		scene: null,
		line: null,
		summary: "",
		date: null,
		characters: [],
		places: [],
		status: null,
		...over,
	};
}

function plannedEntry(over: Partial<PlannedEntry> = {}): PlannedEntry {
	return {
		row: outlineRow(),
		type: "chapter",
		label: "Chapter 2",
		expectedPath: "Book/Chapter 2.md",
		lineId: "main",
		...over,
	};
}

function plan(over: Partial<OutlineReconciliation> = {}): OutlineReconciliation {
	return { planned: [], previews: {}, marks: {}, fulfilledPaths: [], unknownLines: [], ...over };
}

const twoLine: LineLayout = {
	lines: [
		{ id: "main", name: "Main", color: "#111", order: 0 },
		{ id: "side", name: "Side", color: "#222", order: 1 },
	],
	placements: {
		"Book/Chapter 1.md": { lines: ["main"], x: 0 },
		"Book/Chapter 3.md": { lines: ["main"], x: 1 },
	},
};

test("canvasModel splices a ghost card onto its line by manuscript order and re-indexes", () => {
	const entries = [
		entry("Book/Chapter 1.md", { title: "Chapter 1", order: 1 }),
		entry("Book/Chapter 3.md", { title: "Chapter 3", order: 3 }),
	];
	const ghost = plannedEntry({
		row: outlineRow({ chapter: 2 }),
		label: "Chapter 2",
		expectedPath: "Book/Chapter 2.md",
		lineId: "main",
	});
	const model = canvasModel(entries, twoLine, plan({ planned: [ghost] }));
	const main = model.lines.find((l) => l.def.id === "main")!;
	assert.deepEqual(
		main.cards.map((c) => (c.entry ? c.entry.title : c.planned!.label)),
		["Chapter 1", "Chapter 2", "Chapter 3"],
	);
	assert.deepEqual(main.cards.map((c) => c.x), [0, 1, 2]);
	assert.equal(main.cards[1].kind, "planned");
});

test("canvasModel puts a real card's Summary preview and discrepancy mark on the card", () => {
	const entries = [entry("Book/Chapter 1.md", { title: "Chapter 1", order: 1 })];
	const model = canvasModel(
		entries,
		twoLine,
		plan({ previews: { "Book/Chapter 1.md": "Berlín 2029." }, marks: { "Book/Chapter 1.md": "wrong line" } }),
	);
	const card = model.lines.find((l) => l.def.id === "main")!.cards[0];
	assert.equal(card.summary, "Berlín 2029.");
	assert.equal(card.mark, "wrong line");
});

test("canvasModel routes a ghost with an unknown line to plannedUnplaced", () => {
	const ghost = plannedEntry({ lineId: null });
	const model = canvasModel([], twoLine, plan({ planned: [ghost] }));
	assert.equal(model.plannedUnplaced.length, 1);
	assert.equal(model.lines.every((l) => l.cards.length === 0), true);
});

test("lineOrderFromModel lists real and ghost cards in display order", () => {
	const entries = [entry("Book/Chapter 1.md", { title: "Chapter 1", order: 1 })];
	const ghost = plannedEntry({ row: outlineRow({ chapter: 2 }), expectedPath: "Book/Chapter 2.md" });
	const model = canvasModel(entries, twoLine, plan({ planned: [ghost] }));
	assert.deepEqual(lineOrderFromModel(model).main, ["Book/Chapter 1.md", "Book/Chapter 2.md"]);
});

test("canvasModel positions a dragged ghost by its saved placement, not manuscript order", () => {
	const entries = [
		entry("Book/Chapter 1.md", { title: "Chapter 1", order: 1 }),
		entry("Book/Chapter 3.md", { title: "Chapter 3", order: 3 }),
	];
	// Chapter 2's ghost was dragged to the front — the line is dense afterwards.
	const dragged: LineLayout = {
		...twoLine,
		placements: {
			"Book/Chapter 2.md": { lines: ["main"], x: 0 },
			"Book/Chapter 1.md": { lines: ["main"], x: 1 },
			"Book/Chapter 3.md": { lines: ["main"], x: 2 },
		},
	};
	const ghost = plannedEntry({ row: outlineRow({ chapter: 2 }), expectedPath: "Book/Chapter 2.md", lineId: "main" });
	const model = canvasModel(entries, dragged, plan({ planned: [ghost] }));
	const main = model.lines.find((l) => l.def.id === "main")!;
	assert.deepEqual(
		main.cards.map((c) => (c.entry ? c.entry.title : c.planned!.label)),
		["Chapter 2", "Chapter 1", "Chapter 3"],
	);
	assert.equal(main.cards[0].kind, "planned");
});

test("applyPlannedPlacements seeds a placement at the ghost's slot and densifies the line", () => {
	const entries = [
		entry("Book/Chapter 1.md", { title: "Chapter 1", order: 1 }),
		entry("Book/Chapter 3.md", { title: "Chapter 3", order: 3 }),
	];
	const ghost = plannedEntry({ row: outlineRow({ chapter: 2 }), expectedPath: "Book/Chapter 2.md", lineId: "main" });
	const model = canvasModel(entries, twoLine, plan({ planned: [ghost] }));
	const next = applyPlannedPlacements(twoLine, model, new Set(["Book/Chapter 2.md"]));
	assert.deepEqual(next.placements["Book/Chapter 2.md"], { lines: ["main"], x: 1 });
	assert.deepEqual(next.placements["Book/Chapter 3.md"], { lines: ["main"], x: 2 });
	assert.deepEqual(next.placements["Book/Chapter 1.md"], { lines: ["main"], x: 0 });
});

test("applyPlannedPlacements leaves untouched lines alone", () => {
	const model = canvasModel([entry("Book/Chapter 1.md", { order: 1 })], twoLine, plan());
	const next = applyPlannedPlacements(twoLine, model, new Set(["Book/whatever.md"]));
	assert.deepEqual(next.placements, twoLine.placements);
});

/* ---- editing ops ---- */

function threeCards(): LineLayout {
	return {
		lines: [
			{ id: "a", name: "A", color: "#1", order: 0 },
			{ id: "b", name: "B", color: "#2", order: 1 },
		],
		placements: {
			"c1.md": { lines: ["a"], x: 0 },
			"c2.md": { lines: ["a"], x: 1 },
			"c3.md": { lines: ["a"], x: 2 },
			"c4.md": { lines: ["b"], x: 0 },
		},
	};
}

const ORDER = { a: ["c1.md", "c2.md", "c3.md"], b: ["c4.md"] };

test("cloneLayout is a deep copy", () => {
	const original = threeCards();
	const copy = cloneLayout(original);
	copy.placements["c1.md"].x = 99;
	copy.lines[0].name = "changed";
	assert.equal(original.placements["c1.md"].x, 0);
	assert.equal(original.lines[0].name, "A");
});

test("defaultLineId is the topmost line", () => {
	assert.equal(defaultLineId(threeCards()), "a");
	assert.equal(defaultLineId({ lines: [], placements: {} }), null);
});

test("moveCard reorders within a line and renumbers densely", () => {
	const next = moveCard(threeCards(), "c3.md", "a", 0, ORDER);
	assert.deepEqual(["c3.md", "c1.md", "c2.md"].map((p) => next.placements[p].x), [0, 1, 2]);
});

test("moveCard moves a card to another line and compacts the source", () => {
	const next = moveCard(threeCards(), "c2.md", "b", 1, ORDER);
	assert.deepEqual(next.placements["c2.md"], { lines: ["b"], x: 1 });
	assert.deepEqual(["c1.md", "c3.md"].map((p) => next.placements[p].x), [0, 1]);
	assert.deepEqual(["c4.md", "c2.md"].map((p) => next.placements[p].x), [0, 1]);
});

test("reconcilePlacements appends unplaced entries after the line's existing cards", () => {
	const { layout: next, changed } = reconcilePlacements(
		threeCards(),
		["c1.md", "c4.md", "c5.md", "c6.md"],
		"b",
	);
	assert.equal(changed, true);
	assert.deepEqual(next.placements["c5.md"], { lines: ["b"], x: 1 });
	assert.deepEqual(next.placements["c6.md"], { lines: ["b"], x: 2 });
	assert.equal(reconcilePlacements(threeCards(), ["c1.md"], "b").changed, false);
});

test("addLine appends with a unique id and the next order", () => {
	const { layout: next, id } = addLine(threeCards(), "A", "#333");
	assert.equal(id, "a-2");
	assert.equal(next.lines.find((t) => t.id === "a-2")?.order, 2);
});

test("renameLine keeps the id so placements stay valid", () => {
	const next = renameLine(threeCards(), "a", "Main line");
	assert.equal(next.lines.find((t) => t.id === "a")?.name, "Main line");
	assert.equal(next.placements["c1.md"].lines[0], "a");
});

test("moveLine swaps order with the neighbour and clamps at the ends", () => {
	const down = moveLine(threeCards(), "a", 1);
	assert.equal(down.lines.find((t) => t.id === "a")?.order, 1);
	assert.equal(down.lines.find((t) => t.id === "b")?.order, 0);
	assert.equal(layoutsEqual(moveLine(threeCards(), "a", -1), threeCards()), true);
});

test("removeLine re-homes orphaned cards onto the topmost remaining line", () => {
	const next = removeLine(threeCards(), "b");
	assert.equal(next.lines.length, 1);
	assert.deepEqual(next.placements["c4.md"].lines, ["a"]);
	assert.deepEqual(
		Object.values(next.placements)
			.map((p) => p.x)
			.sort(),
		[0, 1, 2, 3],
	);
});

test("removeLine just drops the id from a card on more than one line", () => {
	const base: LineLayout = {
		lines: [
			{ id: "a", name: "A", color: "#1", order: 0 },
			{ id: "b", name: "B", color: "#2", order: 1 },
		],
		placements: { "c1.md": { lines: ["a", "b"], x: 0 } },
	};
	assert.deepEqual(removeLine(base, "b").placements["c1.md"].lines, ["a"]);
});

test("layoutsEqual", () => {
	assert.equal(layoutsEqual(threeCards(), threeCards()), true);
	assert.equal(layoutsEqual(threeCards(), renameLine(threeCards(), "a", "x")), false);
});
