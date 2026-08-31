// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { Line, LineLayout, NovelEntry, Placement } from "../types";

/**
 * Pure layout logic for the book's default view: turns the set of discovered
 * entries plus the saved line layout into a render model, and builds the
 * starter layout for a brand-new book. No Obsidian APIs — unit-tested.
 */

export interface CanvasCard {
	entry: NovelEntry;
	/** Column index along the horizontal axis. */
	x: number;
}

export interface CanvasLine {
	def: Line;
	/** Cards on this line, left to right. */
	cards: CanvasCard[];
}

export interface CanvasModel {
	lines: CanvasLine[];
	/** Entries with no placement, or whose placement names only unknown lines. */
	unplaced: NovelEntry[];
	/** Number of columns to size the horizontal axis (at least 1). */
	columnCount: number;
}

const DEFAULT_LINE_ID = "main";

function byX(a: CanvasCard, b: CanvasCard): number {
	return a.x - b.x;
}

/**
 * Builds the render model. `entries` should already be filtered to one book and
 * sorted into the desired default order (the index sorts by order key, then
 * title).
 */
export function canvasModel(entries: NovelEntry[], layout: LineLayout): CanvasModel {
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
		for (const line of targetLines) line.cards.push({ entry, x });
	});

	for (const line of lines) line.cards.sort(byX);

	return { lines, unplaced, columnCount: Math.max(1, maxX + 1) };
}

export interface StarterLineOptions {
	id?: string;
	name: string;
	color: string;
}

/**
 * A first layout for a book that has no Line file yet: a single line with every
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

/** Per-line ordered list of the visible card paths, taken from a render model. */
export function lineOrderFromModel(model: CanvasModel): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	for (const line of model.lines) out[line.def.id] = line.cards.map((c) => c.entry.file.path);
	return out;
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
