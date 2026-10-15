// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { LineLayout, NovelEntry } from "../types";
import { OUTLINE_COLUMNS, escapeCell } from "./outline";
import { DEFAULT_LANGUAGE, actLabel, parseTitle } from "./titleParser";

/**
 * Builds an Outline table from the notes that already exist — the starting
 * point for the "Generate outline from notes" command. Pure. Every outline
 * column is written: Act / Chapter / Scene come from the folders and titles
 * (a scene row's Chapter number is read back from its chapter folder's name),
 * Line from the note's placement in Lines.md, and Characters / Locations /
 * Date / Status from the note's own properties. Synopsis and Comments are left
 * blank for the author to fill in.
 */

const COLUMNS: readonly string[] = OUTLINE_COLUMNS;

/**
 * The Act cell for a note: its outermost folder when that reads as "<Act label>
 * <name>" ("Act I" -> "I"). Any other folder has no Act cell to live in, and
 * the row's expected folder then differs from the note's (the usual ⚠).
 */
function actCell(outerFolders: string[], language: string): string {
	const first = outerFolders[0];
	if (!first) return "";
	const match = new RegExp(`^${actLabel(language)}\\s+(.+)$`, "i").exec(first.trim());
	return match ? match[1].trim() : "";
}

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

/**
 * An entry's Chapter / Scene numbers as an Outline row would carry them: a
 * scene's chapter is read back from its chapter folder's name. Also the folder
 * names around it, for the Plot matrix view's notes-only mode.
 */
export function outlineUnitsOf(
	entry: NovelEntry,
	language: string = DEFAULT_LANGUAGE,
): { chapter: number | null; scene: number | null; chapterFolder: string | null; outerFolders: string[] } {
	const isScene = entry.type === "scene";
	// A scene's innermost folder is its chapter only if it reads as one: in an
	// "Act I/Scene 1.md" layout it is the act, and must stay with the outer folders.
	const lastFolder = isScene ? entry.context[entry.context.length - 1] ?? null : null;
	const parsedFolder = lastFolder ? parseTitle(lastFolder, language) : null;
	const chapterFolder = parsedFolder?.type === "chapter" ? lastFolder : null;
	const chapter = isScene ? parsedFolder?.type === "chapter" ? parsedFolder.number : null : entry.order;
	return {
		chapter,
		scene: isScene ? entry.order : null,
		chapterFolder,
		outerFolders: isScene && chapterFolder ? entry.context.slice(0, -1) : entry.context,
	};
}

export function generateOutlineTable(
	entries: NovelEntry[],
	layout: LineLayout,
	language: string = DEFAULT_LANGUAGE,
): string {
	const lineNameById = new Map(layout.lines.map((l) => [l.id, l.name]));
	// A note with no placement lands on the topmost line when the board opens, so that is
	// the line its row should name too.
	const fallbackLine = [...layout.lines].sort((a, b) => a.order - b.order)[0]?.id ?? null;

	const rows = entries.filter(isOutlineRowable).map((entry) => {
		const { chapter, scene, outerFolders } = outlineUnitsOf(entry, language);

		const placedLine = layout.placements[entry.file.path]?.lines[0] ?? fallbackLine;
		const line = placedLine ? lineNameById.get(placedLine) ?? placedLine : "";

		const values: Record<(typeof OUTLINE_COLUMNS)[number], string> = {
			Act: actCell(outerFolders, language),
			Chapter: cell(chapter),
			Scene: cell(scene),
			Line: line,
			Synopsis: "",
			Characters: entry.characters.join(", "),
			Locations: entry.locations.join(", "),
			Date: entry.date ?? "",
			Status: entry.status ?? "",
			Comments: "",
		};
		return OUTLINE_COLUMNS.map((name) => escapeCell(values[name]));
	});

	const widths = COLUMNS.map((name, i) =>
		Math.max(name.length, 3, ...rows.map((r) => r[i].length)),
	);
	const line = (parts: readonly string[]): string =>
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
