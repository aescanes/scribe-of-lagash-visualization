// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { BookLayout, NovelEntry, Placement, TimelineDef } from "../types";

/**
 * Pure layout logic for the timeline canvas: turns the set of discovered
 * entries plus the saved book layout into a render model, and builds the
 * starter layout for a brand-new book. No Obsidian APIs — unit-tested.
 */

export interface CanvasCard {
	entry: NovelEntry;
	/** Column index along the horizontal axis. */
	x: number;
}

export interface CanvasLane {
	def: TimelineDef;
	/** Cards on this lane, left to right. */
	cards: CanvasCard[];
}

export interface CanvasModel {
	lanes: CanvasLane[];
	/** Entries with no placement, or whose placement names only unknown lanes. */
	unplaced: NovelEntry[];
	/** Number of columns to size the horizontal axis (at least 1). */
	columnCount: number;
}

const DEFAULT_LANE_ID = "main";

function byX(a: CanvasCard, b: CanvasCard): number {
	return a.x - b.x;
}

/**
 * Builds the canvas render model. `entries` should already be filtered to one
 * book and sorted into the desired default order (the index sorts by order key,
 * then title).
 */
export function canvasModel(entries: NovelEntry[], layout: BookLayout): CanvasModel {
	const lanes: CanvasLane[] = [...layout.timelines]
		.sort((a, b) => a.order - b.order)
		.map((def) => ({ def, cards: [] as CanvasCard[] }));
	const laneById = new Map(lanes.map((lane) => [lane.def.id, lane]));

	const unplaced: NovelEntry[] = [];
	let maxX = 0;

	entries.forEach((entry, i) => {
		const placement = layout.placements[entry.file.path];
		const targetLanes = placement
			? placement.timelines.map((id) => laneById.get(id)).filter((l): l is CanvasLane => l !== undefined)
			: [];

		if (targetLanes.length === 0) {
			unplaced.push(entry);
			return;
		}

		const x = placement ? placement.x : i;
		maxX = Math.max(maxX, x);
		for (const lane of targetLanes) lane.cards.push({ entry, x });
	});

	for (const lane of lanes) lane.cards.sort(byX);

	return { lanes, unplaced, columnCount: Math.max(1, maxX + 1) };
}

export interface StarterLaneOptions {
	id?: string;
	name: string;
	color: string;
}

/**
 * A first layout for a book that has no companion file yet: a single lane with
 * every entry placed on it, in the order given.
 */
export function starterLayout(entries: NovelEntry[], lane: StarterLaneOptions): BookLayout {
	const id = lane.id ?? DEFAULT_LANE_ID;
	const placements: Record<string, Placement> = {};
	entries.forEach((entry, i) => {
		placements[entry.file.path] = { timelines: [id], x: i };
	});
	return {
		timelines: [{ id, name: lane.name, color: lane.color, order: 0 }],
		placements,
	};
}

/** True when the layout has no lanes defined (needs the "create timeline" flow). */
export function isLayoutEmpty(layout: BookLayout): boolean {
	return layout.timelines.length === 0;
}

/* ---- Phase 2: editing operations (all pure, return a new layout) ---- */

export function cloneLayout(layout: BookLayout): BookLayout {
	return {
		timelines: layout.timelines.map((t) => ({ ...t })),
		placements: Object.fromEntries(
			Object.entries(layout.placements).map(([path, p]) => [
				path,
				{ timelines: [...p.timelines], x: p.x },
			]),
		),
	};
}

export function layoutsEqual(a: BookLayout, b: BookLayout): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

/** The lane a new or re-homed card falls onto: the topmost one, or null if there are none. */
export function defaultLaneId(layout: BookLayout): string | null {
	let best: TimelineDef | null = null;
	for (const t of layout.timelines) {
		if (!best || t.order < best.order) best = t;
	}
	return best ? best.id : null;
}

/** Per-lane ordered list of the visible card paths, taken from a render model. */
export function laneOrderFromModel(model: CanvasModel): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	for (const lane of model.lanes) out[lane.def.id] = lane.cards.map((c) => c.entry.file.path);
	return out;
}

function compactLane(layout: BookLayout, laneId: string): void {
	const paths = Object.keys(layout.placements)
		.filter((p) => layout.placements[p].timelines.includes(laneId))
		.sort((a, b) => layout.placements[a].x - layout.placements[b].x);
	paths.forEach((p, i) => {
		layout.placements[p].x = i;
	});
}

/**
 * Moves a card onto `toLaneId` at position `toIndex` (single-membership: the
 * card leaves whatever lane it was on), then renumbers the affected lanes so
 * every column index is dense. `laneOrder` is the current visible order per
 * lane, from `laneOrderFromModel`.
 */
export function moveCard(
	layout: BookLayout,
	path: string,
	toLaneId: string,
	toIndex: number,
	laneOrder: Record<string, string[]>,
): BookLayout {
	const next = cloneLayout(layout);
	const existing = next.placements[path];
	const fromLanes = existing ? existing.timelines.filter((id) => id !== toLaneId) : [];
	next.placements[path] = { timelines: [toLaneId], x: 0 };

	const target = (laneOrder[toLaneId] ?? []).filter((p) => p !== path);
	const at = Math.max(0, Math.min(Math.trunc(toIndex), target.length));
	const ordered = [...target.slice(0, at), path, ...target.slice(at)];
	ordered.forEach((p, i) => {
		if (next.placements[p]) next.placements[p].x = i;
	});

	for (const laneId of fromLanes) {
		(laneOrder[laneId] ?? [])
			.filter((p) => p !== path)
			.forEach((p, i) => {
				if (next.placements[p]) next.placements[p].x = i;
			});
	}
	return next;
}

/**
 * Adds any entry that has no placement yet to `laneId` (used on load and when
 * notes are added while the canvas is open, so nothing silently disappears).
 */
export function reconcilePlacements(
	layout: BookLayout,
	entryPaths: string[],
	laneId: string | null,
): { layout: BookLayout; changed: boolean } {
	if (!laneId) return { layout, changed: false };
	const missing = entryPaths.filter((p) => !layout.placements[p]);
	if (missing.length === 0) return { layout, changed: false };

	const next = cloneLayout(layout);
	// Start after the visible cards already on the lane (ignore stale placements).
	let nextX = entryPaths.filter((p) => next.placements[p]?.timelines.includes(laneId)).length;
	for (const path of missing) next.placements[path] = { timelines: [laneId], x: nextX++ };
	return { layout: next, changed: true };
}

function laneIdFromName(name: string, taken: Set<string>): string {
	const base =
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "lane";
	let id = base;
	let n = 2;
	while (taken.has(id)) id = `${base}-${n++}`;
	return id;
}

export function addLane(
	layout: BookLayout,
	name: string,
	color: string,
): { layout: BookLayout; id: string } {
	const next = cloneLayout(layout);
	const id = laneIdFromName(name, new Set(next.timelines.map((t) => t.id)));
	const order = next.timelines.reduce((max, t) => Math.max(max, t.order), -1) + 1;
	next.timelines.push({ id, name, color, order });
	return { layout: next, id };
}

export function renameLane(layout: BookLayout, id: string, name: string): BookLayout {
	const next = cloneLayout(layout);
	const lane = next.timelines.find((t) => t.id === id);
	if (lane) lane.name = name;
	return next;
}

export function recolorLane(layout: BookLayout, id: string, color: string): BookLayout {
	const next = cloneLayout(layout);
	const lane = next.timelines.find((t) => t.id === id);
	if (lane) lane.color = color;
	return next;
}

/** Swaps a lane with its neighbour in the sort order. `dir` is -1 (up) or 1 (down). */
export function moveLane(layout: BookLayout, id: string, dir: -1 | 1): BookLayout {
	const sorted = [...layout.timelines].sort((a, b) => a.order - b.order);
	const i = sorted.findIndex((t) => t.id === id);
	const j = i + dir;
	if (i < 0 || j < 0 || j >= sorted.length) return layout;

	const next = cloneLayout(layout);
	const a = next.timelines.find((t) => t.id === sorted[i].id);
	const b = next.timelines.find((t) => t.id === sorted[j].id);
	if (a && b) {
		const tmp = a.order;
		a.order = b.order;
		b.order = tmp;
	}
	return next;
}

/**
 * Removes a lane. Cards that were only on it fall onto the remaining topmost
 * lane; cards also on another lane just lose this one.
 */
export function removeLane(layout: BookLayout, id: string): BookLayout {
	const next = cloneLayout(layout);
	next.timelines = next.timelines.filter((t) => t.id !== id);
	const fallback = defaultLaneId(next);

	for (const p of Object.values(next.placements)) {
		if (!p.timelines.includes(id)) continue;
		const rest = p.timelines.filter((t) => t !== id);
		p.timelines = rest.length > 0 ? rest : fallback ? [fallback] : [];
	}
	if (fallback) compactLane(next, fallback);
	return next;
}
