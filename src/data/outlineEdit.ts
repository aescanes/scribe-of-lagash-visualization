// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import {
	OUTLINE_COLUMNS,
	escapeCell,
	isSeparatorRow,
	scanOutlineTable,
	splitTableRow,
	tableCellSpans,
} from "./outline";
import { parseLeadingNumber } from "./titleParser";

/**
 * Pure edits to an Outline file's Markdown table that change only what they
 * must: everything outside the touched cells, and every other line, comes back
 * byte-for-byte. No Obsidian APIs — unit-tested.
 */

/** Header names as the parser matches them: lowercase, legacy `places` = `locations`. */
function canonicalColumn(header: string): string {
	const name = header.trim().toLowerCase();
	return name === "places" ? "locations" : name;
}

/** Appends `texts` as new cells to a table line, whether or not it ends with a pipe. */
function appendCells(line: string, texts: string[]): string {
	const trimmed = line.replace(/\s+$/, "");
	const suffix = texts.map((text) => ` ${text} |`).join("");
	return (trimmed.endsWith("|") ? trimmed : `${trimmed} |`) + suffix;
}

/** Inserts a cell at column `index` of a table line; a line shorter than that is padded and extended. */
function insertCell(line: string, index: number, text: string): string {
	const spans = tableCellSpans(line);
	if (index >= spans.length) {
		return appendCells(line, [...Array<string>(index - spans.length).fill(""), text]);
	}
	// Without a leading pipe, a new first cell needs one or it would read as padding.
	if (index === 0 && !line.trimStart().startsWith("|")) return `| ${text} | ${line.trimStart()}`;
	const at = spans[index].start;
	return `${line.slice(0, at)} ${text} |${line.slice(at)}`;
}

/**
 * Adds any of `OUTLINE_COLUMNS` that the first table in `body` lacks. A missing
 * column goes right after the nearest column before it in `OUTLINE_COLUMNS` that
 * the table has (`Act`, which has none before it, goes first), so `Scene` lands
 * after `Chapter` rather than at the far end. Each gets a separator cell and an
 * empty cell in every row; a row shorter than the insert position is padded.
 * Returns the same `body` string, and no `added` names, when the table is
 * already complete or there is no table.
 */
export function ensureOutlineColumns(body: string): { body: string; added: string[] } {
	const raw = body.split("\n");
	// A trailing \r (CRLF) is carried aside so the edits never mix line endings.
	const cr = raw.map((line) => (line.endsWith("\r") ? "\r" : ""));
	const lines = raw.map((line, i) => (cr[i] ? line.slice(0, -1) : line));

	let headerAt = -1;
	for (let i = 0; i < lines.length - 1; i++) {
		if (!lines[i].includes("|")) continue;
		if (isSeparatorRow(splitTableRow(lines[i + 1]))) {
			headerAt = i;
			break;
		}
	}
	if (headerAt === -1) return { body, added: [] };

	const names = splitTableRow(lines[headerAt]).map(canonicalColumn);
	const missing = OUTLINE_COLUMNS.filter((name) => !names.includes(name.toLowerCase()));
	if (missing.length === 0) return { body, added: [] };

	let rowsEnd = headerAt + 2;
	while (rowsEnd < lines.length && lines[rowsEnd].includes("|")) rowsEnd++;

	for (const name of missing) {
		const canonicalAt = OUTLINE_COLUMNS.indexOf(name);
		let index = 0;
		for (let k = canonicalAt - 1; k >= 0; k--) {
			const found = names.indexOf(OUTLINE_COLUMNS[k].toLowerCase());
			if (found !== -1) {
				index = found + 1;
				break;
			}
		}
		names.splice(index, 0, name.toLowerCase());

		lines[headerAt] = insertCell(lines[headerAt], index, name);
		lines[headerAt + 1] = insertCell(lines[headerAt + 1], index, "-".repeat(Math.max(name.length, 3)));
		for (let i = headerAt + 2; i < rowsEnd; i++) lines[i] = insertCell(lines[i], index, " ".repeat(name.length));
	}

	return { body: lines.map((line, i) => line + cr[i]).join("\n"), added: [...missing] };
}

export type OutlineColumn = (typeof OUTLINE_COLUMNS)[number];

export type CellEditResult =
	| { ok: true; body: string }
	| { ok: false; reason: "no-column" | "no-row" | "stale" };

/**
 * Sets one cell of the first table in `body`. `target` names the row the
 * caller was showing (the index of its line in the body, plus its Chapter /
 * Scene cell text): if the table changed underneath and that row no longer sits
 * there, nothing is written (`stale`). The rest of the table is kept as it was;
 * only the edited cell is re-padded. A row shorter than the column is extended
 * with empty cells. Rows with no Chapter or Scene yet can be edited too.
 */
export function setOutlineCell(
	body: string,
	target: { lineIndex: number; chapterText: string | null; sceneText: string | null },
	column: OutlineColumn,
	value: string,
): CellEditResult {
	const { header, rows, blanks } = scanOutlineTable(body);
	const wanted = column.toLowerCase();
	let col = header.indexOf(wanted);
	if (col === -1 && wanted === "locations") col = header.indexOf("places");
	if (col === -1) return { ok: false, reason: "no-column" };

	const found = [...rows, ...blanks].find((r) => r.lineIndex === target.lineIndex);
	if (!found) return { ok: false, reason: "no-row" };
	if (found.row.chapterText !== target.chapterText || found.row.sceneText !== target.sceneText) {
		return { ok: false, reason: "stale" };
	}

	const lines = body.split("\n");
	const cr = lines[found.lineIndex].endsWith("\r") ? "\r" : "";
	const line = cr ? lines[found.lineIndex].slice(0, -1) : lines[found.lineIndex];
	const text = escapeCell(value);

	const spans = tableCellSpans(line);
	if (col < spans.length) {
		const { start, end } = spans[col];
		lines[found.lineIndex] = `${line.slice(0, start)} ${text} ${line.slice(end)}${cr}`;
	} else {
		const empties = Array<string>(col - spans.length).fill("");
		lines[found.lineIndex] = appendCells(line, [...empties, text]) + cr;
	}
	return { ok: true, body: lines.join("\n") };
}

/**
 * Appends an empty row after the first table's last line; the rest of the file
 * is untouched. The row carries no Act, Chapter or Scene: the writer fills them
 * in (the Plot matrix shows such rows, every other view ignores them). Returns
 * null when there is no table.
 */
export function appendOutlineRow(body: string): string | null {
	const raw = body.split("\n");
	const cr = raw.map((line) => (line.endsWith("\r") ? "\r" : ""));
	const lines = raw.map((line, i) => (cr[i] ? line.slice(0, -1) : line));

	let headerAt = -1;
	for (let i = 0; i < lines.length - 1; i++) {
		if (!lines[i].includes("|")) continue;
		if (isSeparatorRow(splitTableRow(lines[i + 1]))) {
			headerAt = i;
			break;
		}
	}
	if (headerAt === -1) return null;

	const columns = splitTableRow(lines[headerAt]).length;
	let last = headerAt + 1;
	while (last + 1 < lines.length && lines[last + 1].includes("|")) last++;

	const newLine = `|${"  |".repeat(columns)}`;
	const eol = cr[last];
	lines.splice(last + 1, 0, newLine);
	cr.splice(last + 1, 0, eol);
	return lines.map((line, i) => line + cr[i]).join("\n");
}

/** Why a Chapter / Scene edit can't be written, or null. The cell must keep the row parseable. */
export function unitEditProblem(
	row: { chapterText: string | null; sceneText: string | null },
	column: "Chapter" | "Scene",
	value: string,
): string | null {
	const text = value.trim();
	if (text !== "" && parseLeadingNumber(text) === null) {
		return `${column} must start with a number (digits or a roman numeral), like "3" or "3 - The storm".`;
	}
	const other = column === "Chapter" ? row.sceneText : row.chapterText;
	if (text === "" && (other === null || other.trim() === "")) {
		return "A row needs a Chapter or a Scene.";
	}
	return null;
}
