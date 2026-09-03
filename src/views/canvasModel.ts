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
	let maxX = 0;

	entries.forEach((entry, i) => {
		const placement = layout.placements[entry.file.path];
		const targetLines = placement
			? placement.lines.map((id) => lineById.get(id)).filter((l): l is CanvasLine => l !== undefined)
			: [];

		if (targetLines.length === 0) {
			unplaced.push(entry);
			return;
		}

		const x = placement ? placement.x : i;
		maxX = Math.max(maxX, x);
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
			maxX = Math.max(maxX, placement.x);
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

	// Splice the loose ghosts in by manuscript order, then re-index that one
	// line's cards 0..n for display (saved placements are untouched).
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
			line.cards.splice(at, 0, plannedCard(p, 0, plan));
		}
		line.cards.forEach((card, i) => {
			card.x = i;
		});
		maxX = Math.max(maxX, line.cards.length - 1);
	}

	return { lines, unplaced, plannedUnplaced, columnCount: Math.max(1, maxX + 1) };
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
 * line when no row matches or the row names no line. Falls back to
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

	const nextX = new Map<string, number>();
	for (const entry of entries) {
		const lineId = lineIdFor(entry);
		const x = nextX.get(lineId) ?? 0;
		nextX.set(lineId, x + 1);
		layout.placements[entry.file.path] = { lines: [lineId], x };
	}
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
 * Per-line ordered list of the visible card paths (real notes by their path,
 * ghosts by the path their note will get), taken from a render model — the
 * order `moveCard` reorders against.
 */
export function lineOrderFromModel(model: CanvasModel): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	for (const line of model.lines) {
		out[line.def.id] = line.cards.map((c) =>
			c.entry ? c.entry.file.path : (c.planned as PlannedEntry).expectedPath,
		);
	}
	return out;
}

/**
 * After the notes for `createdPaths` have been created, writes a real placement
 * for each — at the display slot it held as a ghost — and renumbers the other
 * cards on those lines densely. Lines with none of `createdPaths` are left as
 * they were. A ghost that was neither created nor already dragged into place
 * stays loose (manuscript-positioned, no placement).
 */
export function applyPlannedPlacements(
	layout: LineLayout,
	model: CanvasModel,
	createdPaths: Set<string>,
): LineLayout {
	const next = cloneLayout(layout);
	for (const line of model.lines) {
		const touched = line.cards.some(
			(c) => c.kind === "planned" && c.planned !== null && createdPaths.has(c.planned.expectedPath),
		);
		if (!touched) continue;

		let x = 0;
		for (const card of line.cards) {
			const path = card.entry ? card.entry.file.path : card.planned?.expectedPath;
			if (!path) continue;
			const looseGhost = card.kind === "planned" && !createdPaths.has(path) && !next.placements[path];
			if (looseGhost) continue;
			next.placements[path] = { lines: [line.def.id], x: x++ };
		}
	}
	return next;
}

function compactLine(layout: LineLayout, lineId: string): void {
	const paths = Object.keys(layout.placements)
		.filter((p) => layout.placements[p].lines.includes(lineId))
		.sort((a, b) => layout.placements[a].x - layout.placements[b].x);
	paths.forEach((p, i) => {
		layout.placements[p].x = i;
	});
}

/**
 * Moves a card onto `toLineId` at position `toIndex` (the card leaves whatever
 * line it was on), then renumbers the affected lines so every column index is
 * dense. `lineOrder` is the current visible order per line, from
 * `lineOrderFromModel`.
 */
export function moveCard(
	layout: LineLayout,
	path: string,
	toLineId: string,
	toIndex: number,
	lineOrder: Record<string, string[]>,
): LineLayout {
	const next = cloneLayout(layout);
	const existing = next.placements[path];
	const fromLines = existing ? existing.lines.filter((id) => id !== toLineId) : [];
	next.placements[path] = { lines: [toLineId], x: 0 };

	const target = (lineOrder[toLineId] ?? []).filter((p) => p !== path);
	const at = Math.max(0, Math.min(Math.trunc(toIndex), target.length));
	const ordered = [...target.slice(0, at), path, ...target.slice(at)];
	ordered.forEach((p, i) => {
		if (next.placements[p]) next.placements[p].x = i;
	});

	for (const lineId of fromLines) {
		(lineOrder[lineId] ?? [])
			.filter((p) => p !== path)
			.forEach((p, i) => {
				if (next.placements[p]) next.placements[p].x = i;
			});
	}
	return next;
}

/**
 * Adds any entry that has no placement yet to `lineId` (used on load and when
 * notes are added while the view is open, so nothing silently disappears).
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
	// Start after the visible cards already on the line (ignore stale placements).
	let nextX = entryPaths.filter((p) => next.placements[p]?.lines.includes(lineId)).length;
	for (const path of missing) next.placements[path] = { lines: [lineId], x: nextX++ };
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
 * line; cards also on another line just lose this one.
 */
export function removeLine(layout: LineLayout, id: string): LineLayout {
	const next = cloneLayout(layout);
	next.lines = next.lines.filter((t) => t.id !== id);
	const fallback = defaultLineId(next);

	for (const p of Object.values(next.placements)) {
		if (!p.lines.includes(id)) continue;
		const rest = p.lines.filter((t) => t !== id);
		p.lines = rest.length > 0 ? rest : fallback ? [fallback] : [];
	}
	if (fallback) compactLine(next, fallback);
	return next;
}
