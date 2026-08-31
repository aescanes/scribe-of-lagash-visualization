// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

/**
 * Pure comparator for the order chapters/scenes appear in the manuscript, when
 * there is no explicit `order` frontmatter (there isn't any more): by containing
 * folder first — so all of "Act I/…" precedes "Act II/…" — then by the number
 * parsed from the title, then by name. Un-numbered units ("Prologue") sort after
 * numbered ones in the same folder.
 *
 * Folder names are compared as plain strings, so name them so they sort the way
 * you want ("Act 1" / "Act 2", or "01" / "02").
 */

export interface OrderedEntry {
	path: string;
	order: number | null;
	title: string;
}

function folderOf(path: string): string {
	const i = path.lastIndexOf("/");
	return i === -1 ? "" : path.slice(0, i);
}

export function byManuscriptOrder(a: OrderedEntry, b: OrderedEntry): number {
	const fa = folderOf(a.path);
	const fb = folderOf(b.path);
	if (fa !== fb) return fa < fb ? -1 : 1;
	if (a.order !== null && b.order !== null && a.order !== b.order) return a.order - b.order;
	if (a.order !== null && b.order === null) return -1;
	if (a.order === null && b.order !== null) return 1;
	return a.title.localeCompare(b.title);
}
