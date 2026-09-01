// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { FRONTMATTER_KEYS, PlannedEntry } from "../types";

/**
 * Builds the starter content for a note created from a planned outline row: a
 * minimal frontmatter block (only the keys the row filled in) followed by the
 * title and the row's Summary as a blockquote. Pure — no Obsidian imports —
 * mirrors the manual YAML serialization `lineFile.ts` uses for a brand-new
 * file, so a stray colon or quote in a Summary/character name still round-trips.
 */

function frontmatterLines(planned: PlannedEntry): string[] {
	const { row } = planned;
	const lines: string[] = [];
	if (row.date) lines.push(`${FRONTMATTER_KEYS.date}: ${JSON.stringify(row.date)}`);
	if (row.characters.length > 0) {
		lines.push(`${FRONTMATTER_KEYS.characters}: [${row.characters.map((c) => JSON.stringify(c)).join(", ")}]`);
	}
	if (row.places.length > 0) {
		lines.push(`${FRONTMATTER_KEYS.places}: [${row.places.map((p) => JSON.stringify(p)).join(", ")}]`);
	}
	if (row.status) lines.push(`${FRONTMATTER_KEYS.status}: ${JSON.stringify(row.status)}`);
	return lines;
}

/** Starter content for the note a ghost card creates. Never used to overwrite an existing note. */
export function scaffoldNoteBody(planned: PlannedEntry): string {
	const parts: string[] = [];

	const fm = frontmatterLines(planned);
	if (fm.length > 0) parts.push(["---", ...fm, "---", ""].join("\n"));

	parts.push(`# ${planned.label}`);
	if (planned.row.summary) parts.push("", `> ${planned.row.summary}`);
	parts.push("");

	return parts.join("\n");
}
