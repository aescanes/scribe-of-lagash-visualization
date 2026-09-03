// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { LineLayout, NovelEntry } from "../types";
import { DEFAULT_LANGUAGE, parseTitle } from "./titleParser";

/**
 * Builds an Outline table from the notes that already exist — the starting
 * point for the "Generate outline from notes" command. Pure. The Summary
 * column is left blank for the author to fill in; a scene row's Chapter number
 * is read back from its chapter folder's name.
 */

const COLUMNS = ["Folder", "Chapter", "Scene", "Line", "Synopsis"];

function cell(value: string | number | null): string {
	return value === null || value === undefined ? "" : String(value);
}

/**
 * Whether an entry can be written as an Outline row. The table is keyed by
 * Chapter / Scene number, so a standalone unit with no number ("Prologue",
 * "Epilogue", "Interlude") has no row — `parseOutlineTable` would drop it anyway.
 * The "Generate outline from notes" command reports how many it skipped.
 */
export function isOutlineRowable(entry: NovelEntry): boolean {
	return entry.type === "scene" || entry.order !== null;
}

export function generateOutlineTable(
	entries: NovelEntry[],
	layout: LineLayout,
	language: string = DEFAULT_LANGUAGE,
): string {
	const lineNameById = new Map(layout.lines.map((l) => [l.id, l.name]));

	const rows = entries.filter(isOutlineRowable).map((entry) => {
		const isScene = entry.type === "scene";
		const folder = (isScene ? entry.context.slice(0, -1) : entry.context).join("/");
		const chapterFolder = isScene ? entry.context[entry.context.length - 1] : undefined;
		const chapter = isScene
			? chapterFolder
				? parseTitle(chapterFolder, language)?.number ?? null
				: null
			: entry.order;
		const scene = isScene ? entry.order : null;

		const placedLine = layout.placements[entry.file.path]?.lines[0];
		const line = placedLine ? lineNameById.get(placedLine) ?? placedLine : "";

		return [cell(folder), cell(chapter), cell(scene), cell(line), ""];
	});

	const widths = COLUMNS.map((name, i) =>
		Math.max(name.length, 3, ...rows.map((r) => r[i].length)),
	);
	const line = (parts: string[]): string =>
		`| ${parts.map((p, i) => p.padEnd(widths[i])).join(" | ")} |`;

	return [line(COLUMNS), line(widths.map((w) => "-".repeat(w))), ...rows.map(line)].join("\n");
}

/**
 * Swaps the first Markdown table in `body` for `table`, keeping any surrounding
 * text (the help comment, the author's own notes). Appends when there's no
 * table yet.
 */
export function replaceFirstTable(body: string, table: string): string {
	const lines = body.split(/\r?\n/);

	let start = -1;
	let end = -1;
	for (let i = 0; i < lines.length - 1; i++) {
		const sep = lines[i + 1].trim();
		if (lines[i].includes("|") && sep.includes("-") && /^\|?[\s:|-]+\|?$/.test(sep)) {
			start = i;
			end = i + 2;
			while (end < lines.length && lines[end].includes("|")) end++;
			break;
		}
	}

	if (start === -1) return `${body.replace(/\s+$/, "")}\n\n${table}\n`;
	return [...lines.slice(0, start), ...table.split("\n"), ...lines.slice(end)].join("\n");
}
