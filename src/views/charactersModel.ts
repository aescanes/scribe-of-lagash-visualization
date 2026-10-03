// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { OutlineReconciliation } from "../data/outline";
import { CanvasModel } from "./canvasModel";
import { derivedLinesModel, nameKey } from "./derivedLines";
import { NovelEntry } from "../types";

/**
 * Pure model for the read-only Characters view: one derived line per
 * character (see `derivedLinesModel`). No Obsidian APIs — unit-tested.
 */

export const CHARACTER_LINE_PREFIX = "character:";

/** Match key for a character name: wikilink brackets/alias stripped, lowercase. */
export const characterKey = nameKey;

export function charactersModel(entries: NovelEntry[], plan: OutlineReconciliation): CanvasModel {
	return derivedLinesModel(entries, plan, {
		linePrefix: CHARACTER_LINE_PREFIX,
		noun: "characters",
		fromEntry: (entry) => entry.characters,
		fromOutlineFulfilled: (p, path) => p.fulfilledCharacters[path] ?? [],
		fromPlanned: (planned) => planned.row.characters,
	});
}
