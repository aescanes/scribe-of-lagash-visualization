// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { NovelEntry, OutlineRow } from "../types";
import { OutlineReconciliation } from "../data/outline";

/**
 * Which people / places a card lists under its text. Pure — no Obsidian APIs.
 * A note's own frontmatter wins over its outline row; the row fills in when the
 * note lists none (and is all a planned card has). A view that groups by one of
 * these fields leaves it off the cards, since the lines already say it.
 */

export type CardInfoField = "characters" | "locations";

export interface CardMeta {
	characters: string[];
	locations: string[];
}

function pick(note: string[], outline: string[]): string[] {
	return note.length > 0 ? note : outline;
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
			characters: pick(entry.characters, recon?.fulfilledCharacters[path] ?? []),
			locations: pick(entry.locations, recon?.fulfilledLocations[path] ?? []),
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
