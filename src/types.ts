// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import type { TFile } from "obsidian";

/**
 * Frontmatter keys the plugin reads from notes. Namespaced as
 * "scribe-visualization-*" (not just "scribe-*") because other plugins in the
 * Scribe of Lagash series will add their own "scribe-" prefixed keys, and
 * generic names like "date" or "status" could mean something different to each.
 *
 * Chapter/scene classification and order come from the folder structure and the
 * note title, not frontmatter; line membership comes from the Lines file. These
 * keys only add optional detail the cards can show.
 */
export const FRONTMATTER_KEYS = {
	date: "scribe-visualization-date",
	characters: "scribe-visualization-characters",
	places: "scribe-visualization-places",
	status: "scribe-visualization-status",
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
 * A single chapter or scene, derived from a note's title (for type and order)
 * plus optional frontmatter (for card detail). The note itself remains the
 * source of truth; this is just a parsed view of it.
 */
export interface NovelEntry {
	file: TFile;
	type: EntryType;
	title: string;
	/**
	 * The configured book folder this note was found under, or "" when no book
	 * folder is configured and the whole vault is scanned.
	 */
	bookFolder: string;
	/**
	 * Folder segments between the scanned book folder and the note, e.g.
	 * ["Act I", "Chapter I"]. Shown next to the title as a breadcrumb.
	 */
	context: string[];
	/** The number parsed from the title (null for e.g. "Prologue"). */
	order: number | null;
	date: string | null;
	characters: string[];
	places: string[];
	status: string | null;
}

/** One horizontal line in the book's default view. */
export interface Line {
	id: string;
	name: string;
	/** Any CSS color string; chosen by the user. */
	color: string;
	/** Sort order of the line, top to bottom. */
	order: number;
}

/** Where a single note's card sits in the default view. */
export interface Placement {
	/** IDs of the lines this card belongs to. */
	lines: string[];
	/** Column index along the horizontal (manuscript) axis. */
	x: number;
}

/**
 * The book's default view — its lines and where each chapter/scene card sits on
 * them. Persisted to the per-book "Lines file" (default "Lines.md") inside the
 * book folder. Keyed by vault-relative note path.
 */
export interface LineLayout {
	lines: Line[];
	placements: Record<string, Placement>;
}

/**
 * One row of the optional per-book Outline file's table — a chapter or scene
 * the author has planned but may not have written yet. Cells are kept raw
 * (numbers parsed, everything else a string) so `reconcileOutline` can compare
 * them against real notes without losing information.
 */
export interface OutlineRow {
	/** Position in the table, top to bottom; used to order planned entries. */
	rowIndex: number;
	act: string | null;
	/** Explicit folder override; when absent it's derived from `act`. */
	folder: string | null;
	chapter: number | null;
	/** Present only on a row that plans a scene (nested under its chapter). */
	scene: number | null;
	/** Line name or id, matched against `Line.name` / `Line.id` in Lines.md. */
	line: string | null;
	summary: string;
	date: string | null;
	characters: string[];
	places: string[];
	status: string | null;
}

/**
 * An OutlineRow with no matching note yet — rendered as a placeholder ("ghost")
 * card on the line view. Clicking it creates the real note at `expectedPath`.
 */
export interface PlannedEntry {
	row: OutlineRow;
	type: EntryType;
	/** Human label for the card, e.g. "Chapter 3". */
	label: string;
	/** Vault-relative path the note will be created at. */
	expectedPath: string;
	/** Resolved line id, or null when `row.line` matches no line in Lines.md. */
	lineId: string | null;
}
