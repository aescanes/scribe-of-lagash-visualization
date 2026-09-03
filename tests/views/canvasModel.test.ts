// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import {
	addLine,
	alignToOutlineOrder,
	applyPlannedPlacements,
	canvasModel,
	cloneLayout,
	defaultLineId,
	isLayoutEmpty,
	layoutsEqual,
	manuscriptColumns,
	moveCard,
	moveLine,
	randomLineColor,
	reconcilePlacements,
	removeLine,
	renameLine,
	starterLayout,
	starterLayoutFromOutline,
} from "../../src/views/canvasModel";
import { LineLayout, NovelEntry, OutlineRow, PlannedEntry } from "../../src/types";
import { OutlineReconciliation } from "../../src/data/outline";

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
		wordCount: 0,
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

test("starterLayoutFromOutline makes one line per outline Line value, in table order", () => {
	const rows = [
		outlineRow({ rowIndex: 0, chapter: 1, line: "Present" }),
		outlineRow({ rowIndex: 1, chapter: 2, line: "Flashbacks" }),
		outlineRow({ rowIndex: 2, chapter: 3, line: "present" }),
	];
	const built = starterLayoutFromOutline([], rows, "Book", "en");
	assert.deepEqual(
		built.lines.map((l) => l.name),
		["Present", "Flashbacks"],
	);
	assert.deepEqual(
		built.lines.map((l) => l.order),
		[0, 1],
	);
});

test("starterLayoutFromOutline places each entry on the line its row names, at its manuscript column", () => {
	const rows = [
		outlineRow({ chapter: 1, line: "Present" }),
		outlineRow({ chapter: 2, line: "Flashbacks" }),
	];
	const entries = [
		entry("Book/Chapter 1.md", { type: "chapter", order: 1 }),
		entry("Book/Chapter 2.md", { type: "chapter", order: 2 }),
	];
	const built = starterLayoutFromOutline(entries, rows, "Book", "en");
	const present = built.lines[0].id;
	const flashbacks = built.lines[1].id;
	// Columns are the shared reading-order axis, not per-line — Chapter 2 sits
	// one column right of Chapter 1 even though it's on a different line.
	assert.deepEqual(built.placements["Book/Chapter 1.md"], { lines: [present], x: 0 });
	assert.deepEqual(built.placements["Book/Chapter 2.md"], { lines: [flashbacks], x: 1 });
});

test("starterLayoutFromOutline drops an unmatched entry onto the first line", () => {
	const rows = [outlineRow({ chapter: 1, line: "Present" }), outlineRow({ chapter: 2, line: "Flashbacks" })];
	const entries = [
		entry("Book/Chapter 1.md", { type: "chapter", order: 1 }),
		entry("Book/Chapter 9.md", { type: "chapter", order: 9 }),
	];
	const built = starterLayoutFromOutline(entries, rows, "Book", "en");
	assert.deepEqual(built.placements["Book/Chapter 9.md"], { lines: [built.lines[0].id], x: 1 });
});

test("a ghost lands on the line starterLayoutFromOutline created for it", () => {
	const rows = [
		outlineRow({ chapter: 1, line: "Flashbacks" }),
		outlineRow({ chapter: 2, line: "Flashbacks" }),
	];
	const built = starterLayoutFromOutline([], rows, "Book", "en");
	const flashbacks = built.lines[0].id;
	const ghost = plannedEntry({
		row: outlineRow({ chapter: 1 }),
		label: "Chapter 1",
		expectedPath: "Book/Chapter 1.md",
		lineId: flashbacks,
	});
	const model = canvasModel([], built, plan({ planned: [ghost] }));
	const line = model.lines.find((l) => l.def.id === flashbacks)!;
	assert.equal(line.cards.length, 1);
	assert.equal(line.cards[0].planned!.label, "Chapter 1");
	assert.equal(model.plannedUnplaced.length, 0);
});

test("starterLayoutFromOutline falls back to a single Main line when no row names a line", () => {
	const built = starterLayoutFromOutline([entry("Book/Chapter 1.md")], [outlineRow({ chapter: 1 })], "Book", "en");
	assert.equal(built.lines.length, 1);
	assert.equal(built.lines[0].name, "Main line");
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

test("manuscriptColumns numbers real entries and planned rows on one shared axis", () => {
	const entries = [
		entry("Book/Chapter 1.md", { title: "Chapter 1", order: 1 }),
		entry("Book/Chapter 3.md", { title: "Chapter 3", order: 3 }),
	];
	const ghost = plannedEntry({ row: outlineRow({ chapter: 2 }), expectedPath: "Book/Chapter 2.md" });
	const cols = manuscriptColumns(entries, [ghost]);
	assert.equal(cols.get("Book/Chapter 1.md"), 0);
	assert.equal(cols.get("Book/Chapter 2.md"), 1);
	assert.equal(cols.get("Book/Chapter 3.md"), 2);
});

test("canvasModel keeps columns aligned across lines by reading order", () => {
	const layout: LineLayout = {
		lines: [
			{ id: "a", name: "A", color: "#1", order: 0 },
			{ id: "b", name: "B", color: "#2", order: 1 },
		],
		placements: {
			"Book/Chapter 1.md": { lines: ["a"], x: 0 },
			"Book/Chapter 2.md": { lines: ["b"], x: 1 },
			"Book/Chapter 3.md": { lines: ["a"], x: 2 },
			"Book/Chapter 4.md": { lines: ["b"], x: 3 },
			"Book/Chapter 5.md": { lines: ["a"], x: 4 },
		},
	};
	const entries = [1, 2, 3, 4, 5].map((n) =>
		entry(`Book/Chapter ${n}.md`, { title: `Chapter ${n}`, order: n }),
	);
	const model = canvasModel(entries, layout);
	assert.deepEqual(model.lines.find((l) => l.def.id === "a")!.cards.map((c) => c.x), [0, 2, 4]);
	assert.deepEqual(model.lines.find((l) => l.def.id === "b")!.cards.map((c) => c.x), [1, 3]);
	assert.equal(model.columnCount, 5);
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

test("applyPlannedPlacements seeds a placement at the ghost's column, pushing the clashing card right", () => {
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

test("moveCard onto an occupied column pushes the occupant and its right neighbours over", () => {
	const next = moveCard(threeCards(), "c3.md", "a", 0);
	assert.deepEqual(next.placements["c3.md"], { lines: ["a"], x: 0 });
	assert.deepEqual(["c1.md", "c2.md"].map((p) => next.placements[p].x), [1, 2]);
});

test("moveCard onto an empty column keeps the gap and survives a round-trip", () => {
	const next = moveCard(threeCards(), "c2.md", "a", 7);
	assert.deepEqual(next.placements["c2.md"], { lines: ["a"], x: 7 });
	// c1/c3 untouched — no compaction of the vacated column.
	assert.deepEqual(["c1.md", "c3.md"].map((p) => next.placements[p].x), [0, 2]);
	const model = canvasModel(
		[entry("c1.md"), entry("c2.md"), entry("c3.md")],
		next,
	);
	assert.deepEqual(model.lines.find((l) => l.def.id === "a")!.cards.map((c) => c.x), [0, 2, 7]);
});

test("moveCard to another line leaves the source column empty", () => {
	const next = moveCard(threeCards(), "c2.md", "b", 5);
	assert.deepEqual(next.placements["c2.md"], { lines: ["b"], x: 5 });
	assert.deepEqual(["c1.md", "c3.md"].map((p) => next.placements[p].x), [0, 2]);
	assert.deepEqual(next.placements["c4.md"], { lines: ["b"], x: 0 });
});

test("reconcilePlacements adds unplaced entries at their manuscript column", () => {
	const { layout: next, changed } = reconcilePlacements(
		threeCards(),
		["c1.md", "c4.md", "c5.md", "c6.md"],
		"b",
	);
	assert.equal(changed, true);
	assert.deepEqual(next.placements["c5.md"], { lines: ["b"], x: 2 });
	assert.deepEqual(next.placements["c6.md"], { lines: ["b"], x: 3 });
	assert.equal(reconcilePlacements(threeCards(), ["c1.md"], "b").changed, false);
});

test("reconcilePlacements steps past a column already taken on the line", () => {
	const base = threeCards();
	base.placements["c9.md"] = { lines: ["b"], x: 1 };
	const { layout: next } = reconcilePlacements(base, ["c1.md", "cx.md"], "b");
	// cx.md is index 1, but c9 already holds column 1 → next free is 2.
	assert.deepEqual(next.placements["cx.md"], { lines: ["b"], x: 2 });
});

test("alignToOutlineOrder resets every card to its reading-order column, keeping lines", () => {
	const spread: LineLayout = {
		lines: [
			{ id: "a", name: "A", color: "#1", order: 0 },
			{ id: "b", name: "B", color: "#2", order: 1 },
		],
		placements: {
			"Book/Chapter 1.md": { lines: ["a"], x: 4 },
			"Book/Chapter 2.md": { lines: ["b"], x: 0 },
			"Book/Chapter 3.md": { lines: ["a"], x: 9 },
		},
	};
	const entries = [1, 2, 3].map((n) => entry(`Book/Chapter ${n}.md`, { order: n }));
	const next = alignToOutlineOrder(spread, entries);
	assert.deepEqual(next.placements["Book/Chapter 1.md"], { lines: ["a"], x: 0 });
	assert.deepEqual(next.placements["Book/Chapter 2.md"], { lines: ["b"], x: 1 });
	assert.deepEqual(next.placements["Book/Chapter 3.md"], { lines: ["a"], x: 2 });
});

test("alignToOutlineOrder drops a dragged ghost's placement so it returns to its outline line", () => {
	const layout: LineLayout = {
		lines: [
			{ id: "line-a", name: "Line A", color: "#1", order: 0 },
			{ id: "main-line", name: "Main line", color: "#2", order: 1 },
		],
		// The Chapter 1 ghost was dragged from Line A onto Main line.
		placements: { "Book/Chapter 1.md": { lines: ["main-line"], x: 0 } },
	};
	const ghost = plannedEntry({
		row: outlineRow({ chapter: 1, line: "Line A" }),
		label: "Chapter 1",
		expectedPath: "Book/Chapter 1.md",
		lineId: "line-a",
	});
	const next = alignToOutlineOrder(layout, [], plan({ planned: [ghost] }));
	assert.equal(next.placements["Book/Chapter 1.md"], undefined);
	// With no placement, canvasModel puts the ghost back on the line its row names.
	const model = canvasModel([], next, plan({ planned: [ghost] }));
	assert.equal(model.lines.find((l) => l.def.id === "line-a")!.cards.length, 1);
	assert.equal(model.lines.find((l) => l.def.id === "main-line")!.cards.length, 0);
});

test("addLine appends with a unique id and the next order", () => {
	const { layout: next, id } = addLine(threeCards(), "A", "#333");
	assert.equal(id, "a-2");
	assert.equal(next.lines.find((t) => t.id === "a-2")?.order, 2);
});

test("randomLineColor returns a valid hex color", () => {
	for (let i = 0; i < 20; i++) {
		assert.match(randomLineColor(), /^#[0-9a-f]{6}$/);
	}
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
