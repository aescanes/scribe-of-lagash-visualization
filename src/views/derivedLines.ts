// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { NovelEntry, PlannedEntry } from "../types";
import { OutlineReconciliation } from "../data/outline";
import { CanvasCard, CanvasLine, CanvasModel, LINE_COLOR_PALETTE, manuscriptColumns } from "./canvasModel";

/**
 * Shared pure model for the read-only "derived lines" views (Characters,
 * Locations): one line per distinct name, each holding the chapters/scenes
 * that list it, on the same manuscript-order columns the StoryLines view starts
 * from. Nothing here is ever saved — the lines and the card-on-several-lines
 * duplication exist only for rendering. No Obsidian APIs — unit-tested through
 * the per-view wrappers.
 */

/** Match key for a name: wikilink brackets/alias stripped, lowercase. */
export function nameKey(name: string): string {
	const inner = name.trim().replace(/^\[\[/, "").replace(/\]\]$/, "");
	const target = inner.split("|")[0] ?? inner;
	return target.trim().toLowerCase();
}

function displayName(name: string): string {
	const inner = name.trim().replace(/^\[\[/, "").replace(/\]\]$/, "");
	return (inner.split("|")[0] ?? inner).trim();
}

/** Stable colour per name, so it survives sessions without being stored. */
function nameColor(key: string): string {
	let hash = 0;
	for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
	return LINE_COLOR_PALETTE[hash % LINE_COLOR_PALETTE.length];
}

interface NamedItem {
	key: string;
	name: string;
}

function named(names: string[]): NamedItem[] {
	const seen = new Set<string>();
	const out: NamedItem[] = [];
	for (const raw of names) {
		const key = nameKey(raw);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push({ key, name: displayName(raw) });
	}
	return out;
}

/**
 * The names a card is drawn under: its outline row's when the row lists any,
 * else the note's own (outline, then note, then nothing). When both sides list
 * some and they differ, `conflict` describes how — advisory only, the outline's
 * names are still the ones drawn. A note that lists none is not a conflict, and
 * neither is an outline with no row for the note (no outline, nothing to
 * disagree with). But a row that lists none while the note does is flagged: the
 * outline is the source of truth, so its gap is worth a look.
 */
function mergeSources(
	fromNote: string[],
	fromOutline: string[],
	noun: string,
	hasRow: boolean,
): { names: NamedItem[]; conflict: string | null } {
	const note = named(fromNote);
	const outline = named(fromOutline);
	const noteKeys = new Set(note.map((c) => c.key));
	const outlineKeys = new Set(outline.map((c) => c.key));

	const names = outline.length > 0 ? outline : note;

	if (note.length > 0 && outline.length === 0 && hasRow) {
		return {
			names,
			conflict: `${noun} differ between the note and the story outline (only in the note: ${note.map((c) => c.name).join(", ")})`,
		};
	}
	if (note.length === 0 || outline.length === 0) return { names, conflict: null };

	const onlyNote = note.filter((c) => !outlineKeys.has(c.key)).map((c) => c.name);
	const onlyOutline = outline.filter((c) => !noteKeys.has(c.key)).map((c) => c.name);
	if (onlyNote.length === 0 && onlyOutline.length === 0) return { names, conflict: null };

	const parts: string[] = [];
	if (onlyNote.length > 0) parts.push(`only in the note: ${onlyNote.join(", ")}`);
	if (onlyOutline.length > 0) parts.push(`only in the story outline: ${onlyOutline.join(", ")}`);
	return { names, conflict: `${noun} differ between the note and the story outline (${parts.join("; ")})` };
}

interface Item {
	path: string;
	column: number;
	names: NamedItem[];
	card: CanvasCard;
	entry: NovelEntry | null;
	planned: PlannedEntry | null;
}

/** What differs between the derived-lines views: where the names come from. */
export interface DerivedLinesSource {
	/** Prefix of the synthetic line ids, e.g. "character:". */
	linePrefix: string;
	/** Plural noun used in the conflict message, e.g. "characters". */
	noun: string;
	fromEntry(entry: NovelEntry): string[];
	/** Outline row names for a real note it fulfils. */
	fromOutlineFulfilled(plan: OutlineReconciliation, path: string): string[];
	fromPlanned(planned: PlannedEntry): string[];
}

export function derivedLinesModel(
	entries: NovelEntry[],
	plan: OutlineReconciliation,
	source: DerivedLinesSource,
): CanvasModel {
	const columns = manuscriptColumns(entries, plan.planned);
	const fulfilled = new Set(plan.fulfilledPaths);

	const items: Item[] = [];
	for (const entry of entries) {
		const path = entry.file.path;
		const { names, conflict } = mergeSources(
				source.fromEntry(entry),
				source.fromOutlineFulfilled(plan, path),
				source.noun,
				fulfilled.has(path),
			);
		const column = columns.get(path) ?? 0;
		items.push({
			path,
			column,
			names,
			entry,
			planned: null,
			card: {
				kind: "real",
				entry,
				planned: null,
				x: column,
				summary: plan.previews[path] ?? null,
				mark: conflict,
			},
		});
	}
	for (const p of plan.planned) {
		const column = columns.get(p.expectedPath) ?? 0;
		items.push({
			path: p.expectedPath,
			column,
			names: named(source.fromPlanned(p)),
			entry: null,
			planned: p,
			card: { kind: "planned", entry: null, planned: p, x: column, summary: p.row.summary || null, mark: null },
		});
	}
	// Manuscript order, so the first spelling seen for a name is the one
	// from the earliest chapter that lists it.
	items.sort((a, b) => a.column - b.column);

	const byKey = new Map<string, CanvasLine>();
	const unplaced: NovelEntry[] = [];
	const plannedUnplaced: PlannedEntry[] = [];
	for (const item of items) {
		if (item.names.length === 0) {
			if (item.entry) unplaced.push(item.entry);
			else if (item.planned) plannedUnplaced.push(item.planned);
			continue;
		}
		for (const c of item.names) {
			let line = byKey.get(c.key);
			if (!line) {
				line = {
					def: { id: source.linePrefix + c.key, name: c.name, color: nameColor(c.key), order: 0 },
					cards: [],
				};
				byKey.set(c.key, line);
			}
			line.cards.push({ ...item.card });
		}
	}

	const lines = Array.from(byKey.values()).sort((a, b) =>
		a.def.name.localeCompare(b.def.name, undefined, { sensitivity: "base" }),
	);
	lines.forEach((line, i) => (line.def.order = i));

	let columnCount = 1;
	for (const line of lines) for (const card of line.cards) columnCount = Math.max(columnCount, card.x + 1);

	return { lines, unplaced, plannedUnplaced, columnCount };
}
