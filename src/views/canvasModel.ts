// SPDX-License-Identifier: GPL-3.0-or-later
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
