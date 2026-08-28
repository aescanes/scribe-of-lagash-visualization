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

/** Result of parsing a note's title (file basename) for its chapter/scene role. */
export interface ParsedTitle {
	type: EntryType;
	/** The chapter/scene number, with roman numerals decoded; null for e.g. "Prologue". */
	number: number | null;
	/** Human label for the matched unit, e.g. "Chapter 3" or "Prologue". */
	label: string;
}

/**
 * How an entry's chapter/scene classification was decided. Lets the UI flag
 * notes whose frontmatter overrides what their title would otherwise say.
 */
export type EntrySource = "title" | "frontmatter";

/**
 * A single chapter or scene, derived from a note's title and/or frontmatter.
 * The note itself remains the source of truth; this is just a parsed view of it.
 */
export interface NovelEntry {
	file: TFile;
	type: EntryType;
	source: EntrySource;
	title: string;
	/**
	 * Folder segments between the scanned book folder and the note, e.g.
	 * ["Act I", "Chapter I"]. Shown next to the title as a breadcrumb.
	 */
	context: string[];
	order: number | null;
	timelines: string[];
	date: string | null;
	characters: string[];
	places: string[];
	status: string | null;
	parent: string | null;
}

/** One horizontal lane in the timeline canvas. */
export interface TimelineDef {
	id: string;
	name: string;
	/** Any CSS color string; chosen by the user. */
	color: string;
	/** Sort order of the lane, top to bottom. */
	order: number;
}

/** Where a single note's card sits on the canvas. */
export interface Placement {
	/** IDs of the timelines this card belongs to. */
	timelines: string[];
	/** Column index along the horizontal (manuscript / chronological) axis. */
	x: number;
}

/**
 * The full visualization layout for one book, persisted to the per-book
 * companion file (default "Timelines.md") inside the book folder. Keyed by
 * vault-relative note path.
 */
export interface BookLayout {
	timelines: TimelineDef[];
	placements: Record<string, Placement>;
}
