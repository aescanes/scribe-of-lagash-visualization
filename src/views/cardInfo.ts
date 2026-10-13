// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { NovelEntry, OutlineRow } from "../types";
import { OutlineReconciliation } from "../data/outline";

/**
 * Which people / places a card lists under its text. Pure — no Obsidian APIs.
 * The outline row wins over the note's own frontmatter; the note fills in when
 * the row lists none (the row is all a planned card has). A view that groups by one of
 * these fields leaves it off the cards, since the lines already say it.
 */

export type CardInfoField = "characters" | "locations";

export interface CardMeta {
	characters: string[];
	locations: string[];
}

/** Outline, then note, then nothing. */
function pick(outline: string[], note: string[]): string[] {
	return outline.length > 0 ? outline : note;
}

function without(meta: CardMeta, hides: readonly CardInfoField[]): CardMeta {
	return {
		characters: hides.includes("characters") ? [] : meta.characters,
		locations: hides.includes("locations") ? [] : meta.locations,
	};
}

export function realCardMeta(
	entry: NovelEntry,
	recon: Pick<OutlineReconciliation, "fulfilledCharacters" | "fulfilledLocations"> | null,
	hides: readonly CardInfoField[],
): CardMeta {
	const path = entry.file.path;
	return without(
		{
			characters: pick(recon?.fulfilledCharacters[path] ?? [], entry.characters),
			locations: pick(recon?.fulfilledLocations[path] ?? [], entry.locations),
		},
		hides,
	);
}

export function plannedCardMeta(row: OutlineRow, hides: readonly CardInfoField[]): CardMeta {
	return without({ characters: row.characters, locations: row.locations }, hides);
}

export interface CardMetaRow {
	field: CardInfoField;
	text: string;
}

/** One row per field that has something to show: characters first, then locations. */
export function metaRows(meta: CardMeta): CardMetaRow[] {
	const rows: CardMetaRow[] = [];
	if (meta.characters.length > 0) rows.push({ field: "characters", text: meta.characters.join(", ") });
	if (meta.locations.length > 0) rows.push({ field: "locations", text: meta.locations.join(", ") });
	return rows;
}
