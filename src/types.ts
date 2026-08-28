// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 aescanes

import type { TFile } from "obsidian";

/**
 * Frontmatter keys the plugin reads from/writes to notes. Namespaced as
 * "scribe-visualization-*" (not just "scribe-*") because other plugins in
 * the Scribe of Lagash series will add their own "scribe-" prefixed keys,
 * and generic names like "type", "order", or "status" could mean something
 * different to each of them.
 */
export const FRONTMATTER_KEYS = {
	type: "scribe-visualization-type",
	order: "scribe-visualization-order",
	timelines: "scribe-visualization-timelines",
	date: "scribe-visualization-date",
	characters: "scribe-visualization-characters",
	places: "scribe-visualization-places",
	status: "scribe-visualization-status",
	parent: "scribe-visualization-parent",
} as const;

export type EntryType = "chapter" | "scene";

/**
 * A single chapter or scene, derived from a note's frontmatter.
 * The note itself remains the source of truth; this is just a parsed view of it.
 */
export interface NovelEntry {
	file: TFile;
	type: EntryType;
	title: string;
	order: number | null;
	timelines: string[];
	date: string | null;
	characters: string[];
	places: string[];
	status: string | null;
	parent: string | null;
}
