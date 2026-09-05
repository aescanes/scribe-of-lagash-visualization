// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { Line, LineLayout, NovelEntry, OutlineRow, Placement, PlannedEntry } from "../types";
import { byManuscriptOrder, OrderedEntry } from "../data/manuscriptOrder";
import {
	expectedNotePath,
	outlineLineNames,
	OutlineReconciliation,
	outlineRowNumber,
	outlineRowType,
} from "../data/outline";

/**
 * Pure layout logic for the book's default view: turns the set of discovered
 * entries plus the saved line layout (and, optionally, the reconciled outline)
 * into a render model, and builds the starter layout for a brand-new book. No
 * Obsidian APIs — unit-tested.
 */

export interface CanvasCard {
	kind: "real" | "planned";
	/** The discovered note — set when `kind === "real"`. */
	entry: NovelEntry | null;
	/** The planned outline row — set when `kind === "planned"` (a ghost card). */
	planned: PlannedEntry | null;
	/** Column index along the horizontal axis. */
	x: number;
	/** Outline Summary shown as a card preview, when the owning row has one. */
	summary: string | null;
	/** For a real card whose outline row disagrees with the note — advisory text. */
	mark: string | null;
}

export interface CanvasLine {
	def: Line;
	/** Cards on this line, left to right (real and ghost, once the outline is merged). */
	cards: CanvasCard[];
}

export interface CanvasModel {
	lines: CanvasLine[];
	/** Entries with no placement, or whose placement names only unknown lines. */
	unplaced: NovelEntry[];
	/** Planned rows whose `Line` cell matched no line — shown but not placed. */
	plannedUnplaced: PlannedEntry[];
	/** Number of columns to size the horizontal axis (at least 1). */
	columnCount: number;
}

const DEFAULT_LINE_ID = "main";

const EMPTY_PLAN: OutlineReconciliation = {
	planned: [],
	previews: {},
	marks: {},
	fulfilledPaths: [],
	fulfilledLineIds: {},
	unknownLines: [],
};

function byX(a: CanvasCard, b: CanvasCard): number {
	return a.x - b.x;
}

function realCard(entry: NovelEntry, x: number, plan: OutlineReconciliation): CanvasCard {
	return {
		kind: "real",
		entry,
		planned: null,
		x,
		summary: plan.previews[entry.file.path] ?? null,
		mark: plan.marks[entry.file.path] ?? null,
	};
}

function plannedCard(p: PlannedEntry, x: number, plan: OutlineReconciliation): CanvasCard {
	return {
		kind: "planned",
		entry: null,
		planned: p,
		x,
		summary: p.row.summary || null,
		mark: plan.marks[p.expectedPath] ?? null,
	};
}

function plannedOrderKey(p: PlannedEntry): OrderedEntry {
	return { path: p.expectedPath, order: outlineRowNumber(p.row), title: p.label };
}

function cardOrderKey(card: CanvasCard): OrderedEntry {
	if (card.entry) {
		return { path: card.entry.file.path, order: card.entry.order, title: card.entry.title };
	}
	return plannedOrderKey(card.planned as PlannedEntry);
}

/**
 * The default column for every card — real and planned — on the shared
 * manuscript axis: the real entries (already manuscript-sorted upstream) and
 * the planned outline rows merged into one list, sorted by manuscript order,
 * each path mapped to its index. This is where a card sits until the user drags
 * it, and the target `alignToOutlineOrder` snaps back to.
 */
export function manuscriptColumns(
	entries: NovelEntry[],
	planned: PlannedEntry[] = [],
): Map<string, number> {
	const keys: OrderedEntry[] = [
		...entries.map((e) => ({ path: e.file.path, order: e.order, title: e.title })),
		...planned.map(plannedOrderKey),
	];
	keys.sort(byManuscriptOrder);
	const out = new Map<string, number>();
	keys.forEach((key, i) => out.set(key.path, i));
	return out;
}

/**
 * Enforces a strictly increasing column per line without closing gaps: a card
 * whose column would land on or before its left neighbour is pushed just past
 * it, everything else keeps the column it was given. Runs at render time only —
 * saved placements are untouched.
 */
function resolveColumns(cards: CanvasCard[]): void {
	cards.sort(byX);
	let min = -1;
	for (const card of cards) {
		if (card.x <= min) card.x = min + 1;
		min = card.x;
	}
}

/**
 * Writes `path`'s placement as `(lineId, column)`, first shoving any card
 * already sitting on that column (and everything to its right on the same line)
 * one column over. Shared by the drag handler and planned-note creation so both
 * follow the same "drop onto an occupied column pushes right" rule.
 */
function placeAt(layout: LineLayout, path: string, lineId: string, column: number): void {
	const col = Math.max(0, Math.trunc(column));
	const clash = Object.entries(layout.placements).some(
		([p, pl]) => p !== path && pl.lines.includes(lineId) && pl.x === col,
	);
	if (clash) {
		for (const [p, pl] of Object.entries(layout.placements)) {
			if (p !== path && pl.lines.includes(lineId) && pl.x >= col) pl.x += 1;
		}
	}
	layout.placements[path] = { lines: [lineId], x: col };
}

/**
 * Builds the render model. `entries` should already be filtered to one book and
 * sorted into the desired default order (the index sorts by order key, then
 * title). `plan` is the reconciled outline: its planned rows become ghost cards
 * spliced onto the line they name, at the spot their manuscript order implies
 * relative to the real cards already there.
 */
export function canvasModel(
	entries: NovelEntry[],
	layout: LineLayout,
	plan: OutlineReconciliation = EMPTY_PLAN,
): CanvasModel {
	const lines: CanvasLine[] = [...layout.lines]
		.sort((a, b) => a.order - b.order)
		.map((def) => ({ def, cards: [] as CanvasCard[] }));
	const lineById = new Map(lines.map((line) => [line.def.id, line]));

	const unplaced: NovelEntry[] = [];
	const defaultCol = manuscriptColumns(entries, plan.planned);

	entries.forEach((entry) => {
		const placement = layout.placements[entry.file.path];
		const targetLines = placement
			? placement.lines.map((id) => lineById.get(id)).filter((l): l is CanvasLine => l !== undefined)
			: [];

		if (targetLines.length === 0) {
			unplaced.push(entry);
			return;
		}

		const x = placement.x;
		for (const line of targetLines) line.cards.push(realCard(entry, x, plan));
	});

	// A ghost the user has dragged has its own placement (keyed by the note's
	// future path) — position it exactly like a real card. The rest fall on the
	// line their row names, spliced by manuscript order.
	const plannedUnplaced: PlannedEntry[] = [];
	const looseByLine = new Map<string, PlannedEntry[]>();
	for (const p of plan.planned) {
		const placement = layout.placements[p.expectedPath];
		const placedLines = placement
			? placement.lines.map((id) => lineById.get(id)).filter((l): l is CanvasLine => l !== undefined)
			: [];

		if (placedLines.length > 0 && placement) {
			for (const line of placedLines) line.cards.push(plannedCard(p, placement.x, plan));
			continue;
		}
		if (!p.lineId || !lineById.has(p.lineId)) {
			plannedUnplaced.push(p);
			continue;
		}
		const list = looseByLine.get(p.lineId) ?? [];
		list.push(p);
		looseByLine.set(p.lineId, list);
	}

	for (const line of lines) line.cards.sort(byX);

	// Splice the loose ghosts onto the line their row names, at the array spot
	// their manuscript order implies, carrying their manuscript column.
	for (const line of lines) {
		const toInsert = looseByLine.get(line.def.id);
		if (!toInsert || toInsert.length === 0) continue;

		toInsert.sort((a, b) => byManuscriptOrder(plannedOrderKey(a), plannedOrderKey(b)));
		for (const p of toInsert) {
			const key = plannedOrderKey(p);
			let at = line.cards.length;
			for (let i = 0; i < line.cards.length; i++) {
				if (byManuscriptOrder(key, cardOrderKey(line.cards[i])) < 0) {
					at = i;
					break;
				}
			}
			line.cards.splice(at, 0, plannedCard(p, defaultCol.get(p.expectedPath) ?? at, plan));
		}
	}

	// Settle every line's columns (push apart overlaps, keep gaps) and size the
	// horizontal axis to the widest card.
	let columnCount = 1;
	for (const line of lines) {
		resolveColumns(line.cards);
		for (const card of line.cards) columnCount = Math.max(columnCount, card.x + 1);
	}

	return { lines, unplaced, plannedUnplaced, columnCount };
}

/**
 * Colors handed out to newly created lines, in no particular order. Twenty
 * hues spaced evenly around the color wheel (varying saturation/lightness
 * slightly between neighbours) so consecutive picks read as clearly distinct,
 * not just lighter/darker shades of the same color.
 */
const LINE_COLOR_PALETTE = [
	"#c32222", // red
	"#ce673b", // burnt orange
	"#d08c25", // amber
	"#b8aa2e", // olive
	"#b8da2f", // lime
	"#7ac431", // grass
	"#43c322", // green
	"#3bce4a", // emerald
	"#25d069", // spring green
	"#2eb88e", // teal
	"#2fdada", // cyan
	"#3198c4", // sky
	"#2263c3", // blue
	"#3b4ace", // indigo
	"#4725d0", // violet
	"#732eb8", // purple
	"#b82fda", // magenta
	"#c431b5", // fuchsia
	"#c32283", // rose
	"#ce3b67", // pink
];

/** A random color for a newly created line, so lines don't all start out identical. */
export function randomLineColor(): string {
	return LINE_COLOR_PALETTE[Math.floor(Math.random() * LINE_COLOR_PALETTE.length)];
}

export interface StarterLineOptions {
	id?: string;
	name: string;
	color: string;
}

/**
 * A first layout for a book that has no Lines file yet: a single line with every
 * entry placed on it, in the order given.
 */
export function starterLayout(entries: NovelEntry[], line: StarterLineOptions): LineLayout {
	const id = line.id ?? DEFAULT_LINE_ID;
	const placements: Record<string, Placement> = {};
	entries.forEach((entry, i) => {
		placements[entry.file.path] = { lines: [id], x: i };
	});
	return {
		lines: [{ id, name: line.name, color: line.color, order: 0 }],
		placements,
	};
}

/**
 * A first layout for a book whose outline names lines: one line per distinct
 * outline `Line` value (in table order, each given its own random color), with
 * each real entry placed on the line its outline row names — or the first
 * line when no row matches or the row names no line. Each entry's column is its
 * position in the manuscript, shared across every line, so cards line up by
 * reading order regardless of which line they sit on. Falls back to
 * `starterLayout`'s single "Main line" when the outline names no lines. Ghost
 * cards for the still-unwritten rows are added afterwards by `canvasModel`
 * from the reconciled outline.
 */
export function starterLayoutFromOutline(
	entries: NovelEntry[],
	rows: OutlineRow[],
	book: string,
	language: string,
): LineLayout {
	const names = outlineLineNames(rows);
	if (names.length === 0) return starterLayout(entries, { name: "Main line", color: randomLineColor() });

	let layout: LineLayout = { lines: [], placements: {} };
	const idByRef = new Map<string, string>();
	for (const name of names) {
		const added = addLine(layout, name, randomLineColor());
		layout = added.layout;
		idByRef.set(name.toLowerCase(), added.id);
	}
	const firstId = layout.lines[0].id;
	for (const line of layout.lines) idByRef.set(line.id.toLowerCase(), line.id);

	const lineIdFor = (entry: NovelEntry): string => {
		const row =
			rows.find((r) => expectedNotePath(r, book, language) === entry.file.path) ??
			rows.find((r) => outlineRowType(r) === entry.type && outlineRowNumber(r) === entry.order);
		const ref = row?.line?.trim().toLowerCase();
		return (ref && idByRef.get(ref)) || firstId;
	};

	entries.forEach((entry, i) => {
		layout.placements[entry.file.path] = { lines: [lineIdFor(entry)], x: i };
	});
	return layout;
}

/** True when the layout has no lines defined (needs the "create lines" flow). */
export function isLayoutEmpty(layout: LineLayout): boolean {
	return layout.lines.length === 0;
}

/* ---- editing operations (all pure, return a new layout) ---- */

export function cloneLayout(layout: LineLayout): LineLayout {
	return {
		lines: layout.lines.map((t) => ({ ...t })),
		placements: Object.fromEntries(
			Object.entries(layout.placements).map(([path, p]) => [path, { lines: [...p.lines], x: p.x }]),
		),
	};
}

export function layoutsEqual(a: LineLayout, b: LineLayout): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

/** The line a new or re-homed card falls onto: the topmost one, or null if there are none. */
export function defaultLineId(layout: LineLayout): string | null {
	let best: Line | null = null;
	for (const t of layout.lines) {
		if (!best || t.order < best.order) best = t;
	}
	return best ? best.id : null;
}

/**
 * After the notes for `createdPaths` have been created, writes a real placement
 * for each at the column its ghost card showed at (pushing any card already on
 * that column right, like a drag). Every other card keeps its placement. A
 * ghost that was neither created nor already dragged into place stays loose.
 */
export function applyPlannedPlacements(
	layout: LineLayout,
	model: CanvasModel,
	createdPaths: Set<string>,
): LineLayout {
	const next = cloneLayout(layout);
	for (const line of model.lines) {
		for (const card of line.cards) {
			if (card.kind !== "planned" || !card.planned) continue;
			if (!createdPaths.has(card.planned.expectedPath)) continue;
			placeAt(next, card.planned.expectedPath, line.def.id, card.x);
		}
	}
	return next;
}

/**
 * Moves a card onto `toLineId` at `toColumn`, leaving whatever line it was on.
 * The exact column is kept — gaps to the left are preserved — and a card
 * already sitting there (with everything to its right on that line) is shoved
 * one column over.
 */
export function moveCard(
	layout: LineLayout,
	path: string,
	toLineId: string,
	toColumn: number,
): LineLayout {
	const next = cloneLayout(layout);
	placeAt(next, path, toLineId, toColumn);
	return next;
}

/**
 * Snaps the board back to the Story Outline. Ghost cards (planned rows with no
 * note yet) return to the line their `Line` cell names — any placement a drag
 * wrote for them is dropped, so `canvasModel` positions them straight from the
 * outline again. A real note whose row names a line that exists in
 * `Lines.md` (`plan.fulfilledLineIds`) moves onto that line too, the same way
 * a ghost does — a real note with no row, or whose row names no valid line,
 * keeps whatever line it's already on. Every placed card's column then snaps
 * to its index in the manuscript-ordered merge of real entries and planned
 * rows. The undoable "Align cards to Story Outline " action — only offered
 * when a Story Outline exists, since without one the card order and line are
 * entirely the user's.
 */
export function alignToOutlineOrder(
	layout: LineLayout,
	entries: NovelEntry[],
	plan: OutlineReconciliation = EMPTY_PLAN,
): LineLayout {
	const columns = manuscriptColumns(entries, plan.planned);
	const next = cloneLayout(layout);
	for (const p of plan.planned) delete next.placements[p.expectedPath];
	for (const [path, placement] of Object.entries(next.placements)) {
		const lineId = plan.fulfilledLineIds[path];
		if (lineId) placement.lines = [lineId];
		const col = columns.get(path);
		if (col !== undefined) placement.x = col;
	}
	return next;
}

/**
 * Adds any entry that has no placement yet to `lineId`, at its manuscript
 * column (the next free column when that one is taken). Used on load and when
 * notes are added while the view is open, so nothing silently disappears.
 */
export function reconcilePlacements(
	layout: LineLayout,
	entryPaths: string[],
	lineId: string | null,
): { layout: LineLayout; changed: boolean } {
	if (!lineId) return { layout, changed: false };
	const missing = entryPaths.filter((p) => !layout.placements[p]);
	if (missing.length === 0) return { layout, changed: false };

	const next = cloneLayout(layout);
	const taken = new Set(
		Object.values(next.placements)
			.filter((p) => p.lines.includes(lineId))
			.map((p) => p.x),
	);
	for (const path of missing) {
		let x = Math.max(0, entryPaths.indexOf(path));
		while (taken.has(x)) x++;
		taken.add(x);
		next.placements[path] = { lines: [lineId], x };
	}
	return { layout: next, changed: true };
}

function lineIdFromName(name: string, taken: Set<string>): string {
	const base =
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "line";
	let id = base;
	let n = 2;
	while (taken.has(id)) id = `${base}-${n++}`;
	return id;
}

export function addLine(
	layout: LineLayout,
	name: string,
	color: string,
): { layout: LineLayout; id: string } {
	const next = cloneLayout(layout);
	const id = lineIdFromName(name, new Set(next.lines.map((t) => t.id)));
	const order = next.lines.reduce((max, t) => Math.max(max, t.order), -1) + 1;
	next.lines.push({ id, name, color, order });
	return { layout: next, id };
}

export function renameLine(layout: LineLayout, id: string, name: string): LineLayout {
	const next = cloneLayout(layout);
	const line = next.lines.find((t) => t.id === id);
	if (line) line.name = name;
	return next;
}

export function recolorLine(layout: LineLayout, id: string, color: string): LineLayout {
	const next = cloneLayout(layout);
	const line = next.lines.find((t) => t.id === id);
	if (line) line.color = color;
	return next;
}

/** Swaps a line with its neighbour in the sort order. `dir` is -1 (up) or 1 (down). */
export function moveLine(layout: LineLayout, id: string, dir: -1 | 1): LineLayout {
	const sorted = [...layout.lines].sort((a, b) => a.order - b.order);
	const i = sorted.findIndex((t) => t.id === id);
	const j = i + dir;
	if (i < 0 || j < 0 || j >= sorted.length) return layout;

	const next = cloneLayout(layout);
	const a = next.lines.find((t) => t.id === sorted[i].id);
	const b = next.lines.find((t) => t.id === sorted[j].id);
	if (a && b) {
		const tmp = a.order;
		a.order = b.order;
		b.order = tmp;
	}
	return next;
}

/**
 * Removes a line. Cards that were only on it fall onto the remaining topmost
 * line, keeping their column (pushed right only where it collides); cards also
 * on another line just lose this one.
 */
export function removeLine(layout: LineLayout, id: string): LineLayout {
	const next = cloneLayout(layout);
	next.lines = next.lines.filter((t) => t.id !== id);
	const fallback = defaultLineId(next);

	for (const [path, p] of Object.entries(next.placements)) {
		if (!p.lines.includes(id)) continue;
		const rest = p.lines.filter((t) => t !== id);
		if (rest.length > 0) p.lines = rest;
		else if (fallback) placeAt(next, path, fallback, p.x);
		else p.lines = [];
	}
	return next;
}
