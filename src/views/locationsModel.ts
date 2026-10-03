// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { OutlineReconciliation } from "../data/outline";
import { CanvasModel } from "./canvasModel";
import { derivedLinesModel, nameKey } from "./derivedLines";
import { NovelEntry } from "../types";

/**
 * Pure model for the read-only Locations view: one derived line per
 * location (see `derivedLinesModel`). No Obsidian APIs — unit-tested.
 */

export const LOCATION_LINE_PREFIX = "location:";

/** Match key for a location name: wikilink brackets/alias stripped, lowercase. */
export const locationKey = nameKey;

export function locationsModel(entries: NovelEntry[], plan: OutlineReconciliation): CanvasModel {
	return derivedLinesModel(entries, plan, {
		linePrefix: LOCATION_LINE_PREFIX,
		noun: "locations",
		fromEntry: (entry) => entry.locations,
		fromOutlineFulfilled: (p, path) => p.fulfilledLocations[path] ?? [],
		fromPlanned: (planned) => planned.row.locations,
	});
}
