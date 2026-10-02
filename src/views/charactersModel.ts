// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { NovelEntry, PlannedEntry } from "../types";
import { OutlineReconciliation } from "../data/outline";
import { CanvasCard, CanvasLine, CanvasModel, LINE_COLOR_PALETTE, manuscriptColumns } from "./canvasModel";

/**
 * Pure model for the read-only Characters mode view: one derived line per
 * character, each holding the chapters/scenes that name them, on the same
 * manuscript-order columns the StoryLines mode starts from. Nothing here is
 * ever saved — the lines and the card-on-several-lines duplication exist only
 * for rendering. No Obsidian APIs — unit-tested.
 */

export const CHARACTER_LINE_PREFIX = "character:";

/** Match key for a character name: wikilink brackets/alias stripped, lowercase. */
export function characterKey(name: string): string {
	const inner = name.trim().replace(/^\[\[/, "").replace(/\]\]$/, "");
	const target = inner.split("|")[0] ?? inner;
	return target.trim().toLowerCase();
}

function displayName(name: string): string {
	const inner = name.trim().replace(/^\[\[/, "").replace(/\]\]$/, "");
	return (inner.split("|")[0] ?? inner).trim();
}

/** Stable colour per character, so it survives sessions without being stored. */
function characterColor(key: string): string {
	let hash = 0;
	for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
	return LINE_COLOR_PALETTE[hash % LINE_COLOR_PALETTE.length];
}

interface NamedCharacter {
	key: string;
	name: string;
}

function named(names: string[]): NamedCharacter[] {
	const seen = new Set<string>();
	const out: NamedCharacter[] = [];
	for (const raw of names) {
		const key = characterKey(raw);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push({ key, name: displayName(raw) });
	}
	return out;
}

/**
 * The note's own characters and its outline row's, merged. When both sides list
 * some and they differ, `conflict` describes how — advisory only, the union is
 * what gets drawn. A side that lists none is not a conflict: the outline's
 * Characters column is optional.
 */
function mergeSources(
	fromNote: string[],
	fromOutline: string[],
): { characters: NamedCharacter[]; conflict: string | null } {
	const note = named(fromNote);
	const outline = named(fromOutline);
	const noteKeys = new Set(note.map((c) => c.key));
	const outlineKeys = new Set(outline.map((c) => c.key));

	const characters = [...note];
	for (const c of outline) if (!noteKeys.has(c.key)) characters.push(c);

	if (note.length === 0 || outline.length === 0) return { characters, conflict: null };

	const onlyNote = note.filter((c) => !outlineKeys.has(c.key)).map((c) => c.name);
	const onlyOutline = outline.filter((c) => !noteKeys.has(c.key)).map((c) => c.name);
	if (onlyNote.length === 0 && onlyOutline.length === 0) return { characters, conflict: null };

	const parts: string[] = [];
	if (onlyNote.length > 0) parts.push(`only in the note: ${onlyNote.join(", ")}`);
	if (onlyOutline.length > 0) parts.push(`only in the story outline: ${onlyOutline.join(", ")}`);
	return { characters, conflict: `characters differ between the note and the story outline (${parts.join("; ")})` };
}

interface Item {
	path: string;
	column: number;
	characters: NamedCharacter[];
	card: CanvasCard;
	entry: NovelEntry | null;
	planned: PlannedEntry | null;
}

export function charactersModel(entries: NovelEntry[], plan: OutlineReconciliation): CanvasModel {
	const columns = manuscriptColumns(entries, plan.planned);

	const items: Item[] = [];
	for (const entry of entries) {
		const path = entry.file.path;
		const { characters, conflict } = mergeSources(entry.characters, plan.fulfilledCharacters[path] ?? []);
		const column = columns.get(path) ?? 0;
		items.push({
			path,
			column,
			characters,
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
			characters: named(p.row.characters),
			entry: null,
			planned: p,
			card: { kind: "planned", entry: null, planned: p, x: column, summary: p.row.summary || null, mark: null },
		});
	}
	// Manuscript order, so the first spelling seen for a character is the one
	// from the earliest chapter that names them.
	items.sort((a, b) => a.column - b.column);

	const byKey = new Map<string, CanvasLine>();
	const unplaced: NovelEntry[] = [];
	const plannedUnplaced: PlannedEntry[] = [];
	for (const item of items) {
		if (item.characters.length === 0) {
			if (item.entry) unplaced.push(item.entry);
			else if (item.planned) plannedUnplaced.push(item.planned);
			continue;
		}
		for (const c of item.characters) {
			let line = byKey.get(c.key);
			if (!line) {
				line = {
					def: { id: CHARACTER_LINE_PREFIX + c.key, name: c.name, color: characterColor(c.key), order: 0 },
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
