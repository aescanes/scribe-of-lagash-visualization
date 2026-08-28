// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 aescanes

/**
 * Pure helpers for turning a note's location into a short breadcrumb shown next
 * to its title, e.g. "Book/Act I/Chapter I/Scene 1.md" scanned under "Book"
 * becomes the segments ["Act I", "Chapter I"] → "Act I - Chapter I".
 */

function trimSlashes(path: string): string {
	return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * Folder segments between `baseFolder` and the file at `filePath`. The base
 * folder and the file name itself are excluded. When `baseFolder` is empty,
 * every parent folder of the file is returned.
 */
export function folderContext(filePath: string, baseFolder = ""): string[] {
	const path = trimSlashes(filePath);
	const slash = path.lastIndexOf("/");
	const dir = slash === -1 ? "" : path.slice(0, slash);

	const base = trimSlashes(baseFolder);
	let rel = dir;
	if (base) {
		if (dir === base) rel = "";
		else if (dir.startsWith(`${base}/`)) rel = dir.slice(base.length + 1);
	}

	return rel ? rel.split("/") : [];
}

/** Renders context segments the way they appear on a card, or "" when there are none. */
export function formatFolderContext(segments: string[]): string {
	return segments.join(" - ");
}
