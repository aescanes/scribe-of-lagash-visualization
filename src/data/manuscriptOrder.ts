// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

/**
 * Pure comparator for the order chapters/scenes appear in the manuscript, when
 * there is no explicit `order` frontmatter (there isn't any more): by containing
 * folder first — so all of "Act I/…" precedes "Act II/…" — then by the number
 * parsed from the title, then by name. Un-numbered units ("Prologue") sort after
 * numbered ones in the same folder.
 *
 * Folder segments are compared level by level: when both siblings carry a number
 * (digits or a roman numeral, e.g. "Chapter 2" vs "Chapter 10", "Act I" vs
 * "Act II") they sort by that number, so double-digit chapters don't fall
 * between "Chapter 1" and "Chapter 2"; otherwise the segment is compared as a
 * plain string. A shallower path sorts before a deeper one under the same
 * parent, so a chapter file precedes the scene sub-folders beside it.
 */

import { parseNumberToken } from "./titleParser";

export interface OrderedEntry {
	path: string;
	order: number | null;
	title: string;
}

function folderSegments(path: string): string[] {
	const i = path.lastIndexOf("/");
	return i === -1 ? [] : path.slice(0, i).split("/");
}

/** The first digit-or-roman token in a folder segment ("Chapter 10" → 10, "Act IV" → 4), or null. */
function segmentNumber(segment: string): number | null {
	for (const word of segment.split(/[^A-Za-z0-9]+/)) {
		if (!word) continue;
		const n = parseNumberToken(word);
		if (n !== null) return n;
	}
	return null;
}

function compareFolders(a: string[], b: string[]): number {
	const shared = Math.min(a.length, b.length);
	for (let i = 0; i < shared; i++) {
		if (a[i] === b[i]) continue;
		const na = segmentNumber(a[i]);
		const nb = segmentNumber(b[i]);
		if (na !== null && nb !== null && na !== nb) return na - nb;
		return a[i] < b[i] ? -1 : 1;
	}
	return a.length - b.length;
}

export function byManuscriptOrder(a: OrderedEntry, b: OrderedEntry): number {
	const folders = compareFolders(folderSegments(a.path), folderSegments(b.path));
	if (folders !== 0) return folders;
	if (a.order !== null && b.order !== null && a.order !== b.order) return a.order - b.order;
	if (a.order !== null && b.order === null) return -1;
	if (a.order === null && b.order !== null) return 1;
	return a.title.localeCompare(b.title);
}
