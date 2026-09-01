// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { EntryType, LineLayout, NovelEntry, OutlineRow, PlannedEntry } from "../types";
import { DEFAULT_LANGUAGE, actLabel, parseNumberToken, unitLabel } from "./titleParser";

/**
 * Pure logic for the optional per-book Outline file: parsing its Markdown
 * table, deriving where a planned row's note would live, and reconciling rows
 * against the real notes and line layout. No Obsidian APIs — unit-tested.
 */

type ColumnName =
	| "act"
	| "folder"
	| "chapter"
	| "scene"
	| "line"
	| "summary"
	| "date"
	| "characters"
	| "places"
	| "status";

/** Splits one `| a | b |` line into raw, trimmed cell strings. */
function splitTableRow(line: string): string[] {
	const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
	return trimmed.split("|").map((cell) => cell.trim());
}

/** Strips the user's own `[M]`-style bracket shorthand from a data cell. */
function stripCell(cell: string): string {
	const match = /^\[(.*)\]$/.exec(cell);
	return (match ? match[1] : cell).trim();
}

function isSeparatorRow(cells: string[]): boolean {
	return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

function toStringOrNull(value: string): string | null {
	return value === "" ? null : value;
}

function toNumberOrNull(value: string): number | null {
	return value === "" ? null : parseNumberToken(value);
}

function toStringArray(value: string): string[] {
	return value === ""
		? []
		: value
				.split(",")
				.map((v) => v.trim())
				.filter(Boolean);
}

/**
 * Parses the first Markdown table found in an Outline file's body into rows.
 * Columns are matched by header name, case-insensitively; unrecognized columns
 * are ignored. A row with neither a `Chapter` nor a `Scene` value is dropped —
 * it plans nothing yet.
 */
export function parseOutlineTable(markdownBody: string): OutlineRow[] {
	const lines = markdownBody.split(/\r?\n/);

	let headerAt = -1;
	for (let i = 0; i < lines.length - 1; i++) {
		if (!lines[i].includes("|")) continue;
		if (isSeparatorRow(splitTableRow(lines[i + 1]))) {
			headerAt = i;
			break;
		}
	}
	if (headerAt === -1) return [];

	const header = splitTableRow(lines[headerAt]).map((cell) => cell.toLowerCase());
	const colIndex = (name: ColumnName): number => header.indexOf(name);
	const cellAt = (cells: string[], name: ColumnName): string => {
		const i = colIndex(name);
		return i === -1 || i >= cells.length ? "" : stripCell(cells[i]);
	};

	const rows: OutlineRow[] = [];
	for (let i = headerAt + 2; i < lines.length; i++) {
		const line = lines[i];
		if (!line.includes("|")) break;

		const cells = splitTableRow(line);
		const chapter = toNumberOrNull(cellAt(cells, "chapter"));
		const scene = toNumberOrNull(cellAt(cells, "scene"));
		if (chapter === null && scene === null) continue;

		rows.push({
			rowIndex: rows.length,
			act: toStringOrNull(cellAt(cells, "act")),
			folder: toStringOrNull(cellAt(cells, "folder")),
			chapter,
			scene,
			line: toStringOrNull(cellAt(cells, "line")),
			summary: cellAt(cells, "summary"),
			date: toStringOrNull(cellAt(cells, "date")),
			characters: toStringArray(cellAt(cells, "characters")),
			places: toStringArray(cellAt(cells, "places")),
			status: toStringOrNull(cellAt(cells, "status")),
		});
	}
	return rows;
}

/** "chapter" for a chapter row, "scene" for a row with a Scene value. */
export function outlineRowType(row: OutlineRow): EntryType {
	return row.scene !== null ? "scene" : "chapter";
}

/** The row's unit number — its Scene number, or else its Chapter number. */
export function outlineRowNumber(row: OutlineRow): number | null {
	return row.scene !== null ? row.scene : row.chapter;
}

function trimSlashes(path: string): string {
	return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

function folderOf(path: string): string {
	const i = path.lastIndexOf("/");
	return i === -1 ? "" : path.slice(0, i);
}

/**
 * Vault-relative path a row's note would be created at: `<book>/<folder>/
 * <Chapter unit> <n>.md`, or, for a scene row, `.../<Chapter unit> <n>/
 * <Scene unit> <m>.md` (a scene sits inside its chapter's folder — the
 * existing folder-nesting rule). `folder` is the row's `Folder` cell, else
 * `"<Act label> <Act cell>"` when there's an `Act` cell, else omitted.
 */
export function expectedNotePath(row: OutlineRow, book: string, language: string = DEFAULT_LANGUAGE): string {
	const parts = [trimSlashes(book)].filter(Boolean);

	const folder = row.folder ?? (row.act ? `${actLabel(language)} ${row.act}` : null);
	if (folder) parts.push(trimSlashes(folder));

	if (row.scene !== null) {
		if (row.chapter !== null) parts.push(`${unitLabel("chapter", language)} ${row.chapter}`);
		parts.push(`${unitLabel("scene", language)} ${row.scene}.md`);
	} else if (row.chapter !== null) {
		parts.push(`${unitLabel("chapter", language)} ${row.chapter}.md`);
	}

	return parts.join("/");
}

export interface OutlineReconciliation {
	/** Rows with no matching note yet — rendered as ghost cards. */
	planned: PlannedEntry[];
	/** Vault path -> the matched row's Summary, shown as a card preview. */
	previews: Record<string, string>;
	/** Vault path -> a human-readable description of how the note differs from its row. */
	marks: Record<string, string>;
	/** `Line` cell values that matched no line in Lines.md, for diagnostics. */
	unknownLines: string[];
}

const emptyReconciliation: OutlineReconciliation = {
	planned: [],
	previews: {},
	marks: {},
	unknownLines: [],
};

/**
 * Matches outline rows against the book's real entries and line layout.
 * `entries` should already be scoped to one book (e.g. `getEntriesForBook`).
 * The folder/file structure and Lines.md are always authoritative — a
 * disagreement never changes where a real card sits, it only adds a mark.
 */
export function reconcileOutline(
	rows: OutlineRow[],
	entries: NovelEntry[],
	layout: LineLayout,
	book: string,
	language: string = DEFAULT_LANGUAGE,
): OutlineReconciliation {
	if (rows.length === 0) return emptyReconciliation;

	const lineIdByRef = new Map<string, string>();
	for (const line of layout.lines) {
		lineIdByRef.set(line.id.toLowerCase(), line.id);
		lineIdByRef.set(line.name.toLowerCase(), line.id);
	}
	const lineNameById = new Map(layout.lines.map((l) => [l.id, l.name]));

	const placedLineOf = new Map<string, string>();
	for (const [path, placement] of Object.entries(layout.placements)) {
		if (placement.lines.length > 0) placedLineOf.set(path, placement.lines[0]);
	}

	const entryByPath = new Map(entries.map((e) => [e.file.path, e]));

	const planned: PlannedEntry[] = [];
	const previews: Record<string, string> = {};
	const marks: Record<string, string> = {};
	const unknownLines = new Set<string>();

	for (const row of rows) {
		const type = outlineRowType(row);
		const number = outlineRowNumber(row);
		const expectedPath = expectedNotePath(row, book, language);

		const rowLineId = row.line ? lineIdByRef.get(row.line.toLowerCase()) ?? null : null;
		if (row.line && rowLineId === null) unknownLines.add(row.line);

		const matched =
			entryByPath.get(expectedPath) ?? entries.find((e) => e.type === type && e.order === number) ?? null;

		if (!matched) {
			planned.push({ row, type, label: `${unitLabel(type, language)} ${number}`, expectedPath, lineId: rowLineId });
			continue;
		}

		const path = matched.file.path;
		if (row.summary) previews[path] = row.summary;

		const issues: string[] = [];
		if (row.line) {
			if (rowLineId === null) {
				issues.push(`outline's line "${row.line}" isn't in Lines.md`);
			} else {
				const actualLineId = placedLineOf.get(path);
				if (actualLineId && actualLineId !== rowLineId) {
					issues.push(
						`outline says "${lineNameById.get(rowLineId) ?? row.line}", placed on ` +
							`"${lineNameById.get(actualLineId) ?? actualLineId}"`,
					);
				}
			}
		}
		if (folderOf(expectedPath) !== folderOf(path)) {
			issues.push(`outline expects it under "${folderOf(expectedPath) || trimSlashes(book)}"`);
		}
		if (matched.type !== type) {
			issues.push(`outline plans it as a ${type}, note is a ${matched.type}`);
		}
		if (issues.length > 0) marks[path] = issues.join("; ");
	}

	return { planned, previews, marks, unknownLines: Array.from(unknownLines).sort() };
}
