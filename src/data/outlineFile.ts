// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { App, normalizePath, parseYaml, TFile } from "obsidian";
import { OutlineRow } from "../types";
import { withMdExtension, withScribePrefix } from "./lineLayout";
import { OUTLINE_COLUMNS, parseOutlineTable, scanOutlineTable } from "./outline";
import { CellEditResult, OutlineColumn, appendOutlineRow, ensureOutlineColumns, setOutlineCell } from "./outlineEdit";
import { replaceFirstTable } from "./outlineGenerate";
import { OUTLINE_GUIDE, refreshOutlineGuide } from "./outlineGuide";

/**
 * Reads the optional per-book "Outline file" — a Markdown table
 * planning the book's chapters/scenes, described in
 * `docs/feature-plans/outline-file-plan.md`. The plugin *creates* this file
 * (the empty skeleton, once, when the user names it in settings) and otherwise
 * only appends header columns the table lacks; the rows are edited by hand.
 */

const MARKER_KEY = "scribe-visualization";
const MARKER_VALUE = "outline";

/** Lets the file's table use the full pane width (see `styles.css`); written into new outline files. */
const OUTLINE_WIDE_CLASS = "scribe-outline-wide";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function splitFrontmatter(content: string): { frontmatter: unknown; body: string } {
	const match = FRONTMATTER_RE.exec(content);
	if (!match) return { frontmatter: null, body: content };
	try {
		return { frontmatter: parseYaml(match[1]), body: content.slice(match[0].length) };
	} catch {
		return { frontmatter: null, body: content };
	}
}

function hasMarker(frontmatter: unknown): boolean {
	if (!frontmatter || typeof frontmatter !== "object") return false;
	return (frontmatter as Record<string, unknown>)[MARKER_KEY] === MARKER_VALUE;
}

/** Vault-relative path to a book's Outline file, or "" when unnamed (feature off). */
export function outlineFilePath(bookFolder: string, fileName: string): string {
	const name = withScribePrefix(withMdExtension(fileName));
	if (!name) return "";
	const folder = bookFolder.replace(/^\/+/, "").replace(/\/+$/, "");
	return folder ? `${folder}/${name}` : name;
}

/**
 * Reads and parses the Outline file's table. Returns `[]` when `path` is
 * empty (feature off), the file doesn't exist, or it lacks the
 * `scribe-visualization: outline` marker.
 */
export async function readOutline(app: App, path: string): Promise<OutlineRow[]> {
	return (await readOutlineFile(app, path)).rows;
}

/** `readOutline` plus whether a usable (marked) Outline file exists — it may have no rows yet. */
export async function readOutlineFile(
	app: App,
	path: string,
): Promise<{ exists: boolean; rows: OutlineRow[]; blankRows: OutlineRow[] }> {
	if (!path) return { exists: false, rows: [], blankRows: [] };
	const file = app.vault.getAbstractFileByPath(normalizePath(path));
	if (!(file instanceof TFile)) return { exists: false, rows: [], blankRows: [] };

	const content = await app.vault.read(file);
	const { frontmatter, body } = splitFrontmatter(content);
	if (!hasMarker(frontmatter)) return { exists: false, rows: [], blankRows: [] };
	const { rows, blanks } = scanOutlineTable(body);
	return { exists: true, rows: rows.map((r) => r.row), blankRows: blanks.map((r) => r.row) };
}

/**
 * Creates `path` with an empty table skeleton when it doesn't exist yet. Does
 * nothing if `path` is empty or the file is already there — the plugin never
 * overwrites an outline the user has edited. Returns whether a new file was written.
 */
export async function ensureOutlineFile(app: App, path: string): Promise<boolean> {
	if (!path) return false;
	const normalized = normalizePath(path);
	if (app.vault.getAbstractFileByPath(normalized) instanceof TFile) return false;

	const body = [
		"---",
		`${MARKER_KEY}: ${MARKER_VALUE}`,
		`cssclasses: [${OUTLINE_WIDE_CLASS}]`,
		"---",
		"",
		"<!-- Managed by Scribe of Lagash - Visualization.",
		"",
		"     Edit the table below by hand, or cell by cell in the Plot matrix view.",
		"     The plugin only changes the cell you edit there, and adds any column",
		"     that is missing. Click a placeholder card in the StoryLines view to",
		"     create a row's note.",
		"     A guide to the columns is at the bottom of this file. -->",
		"",
		`| ${OUTLINE_COLUMNS.join(" | ")} |`,
		`| ${OUTLINE_COLUMNS.map((name) => "-".repeat(name.length)).join(" | ")} |`,
		`| ${OUTLINE_COLUMNS.map((name) => " ".repeat(name.length)).join(" | ")} |`,
		"",
		"---",
		"",
		OUTLINE_GUIDE,
	].join("\n");
	await app.vault.create(normalized, body);
	return true;
}

/**
 * Adds any column the Outline table lacks (`OUTLINE_COLUMNS`), leaving the
 * rest of the file untouched. Does nothing — and doesn't write — when the file
 * is missing, unmarked, or already complete, so the change event a write fires
 * ends the loop on the next read. Returns whether it wrote.
 */
export async function ensureOutlineColumnsInFile(app: App, path: string): Promise<boolean> {
	if (!path) return false;
	const file = app.vault.getAbstractFileByPath(normalizePath(path));
	if (!(file instanceof TFile)) return false;

	const check = (content: string): boolean => {
		const { frontmatter, body } = splitFrontmatter(content);
		return hasMarker(frontmatter) && ensureOutlineColumns(body).added.length > 0;
	};
	if (!check(await app.vault.read(file))) return false;

	let wrote = false;
	await app.vault.process(file, (content) => {
		if (!check(content)) return content;
		const { body } = splitFrontmatter(content);
		wrote = true;
		return content.slice(0, content.length - body.length) + ensureOutlineColumns(body).body;
	});
	return wrote;
}

/**
 * Brings the column guide below the table up to date, so a file made by an
 * older version learns about new columns and values. Does nothing when the
 * file is missing, unmarked, has no guide, or already matches. Returns whether it wrote.
 */
export async function ensureOutlineGuideInFile(app: App, path: string): Promise<boolean> {
	if (!path) return false;
	const file = app.vault.getAbstractFileByPath(normalizePath(path));
	if (!(file instanceof TFile)) return false;

	const check = (content: string): boolean => {
		const { frontmatter, body } = splitFrontmatter(content);
		return hasMarker(frontmatter) && refreshOutlineGuide(body) !== null;
	};
	if (!check(await app.vault.read(file))) return false;

	let wrote = false;
	await app.vault.process(file, (content) => {
		const { frontmatter, body } = splitFrontmatter(content);
		if (!hasMarker(frontmatter)) return content;
		const next = refreshOutlineGuide(body);
		if (next === null) return content;
		wrote = true;
		return content.slice(0, content.length - body.length) + next;
	});
	return wrote;
}

/**
 * Adds the full-width `cssclasses` entry to the Outline file's frontmatter when it
 * is missing, keeping any classes the user already has. Does nothing for a file
 * that is missing, unmarked, or already has it. Returns whether it wrote.
 */
export async function ensureOutlineWideClass(app: App, path: string): Promise<boolean> {
	if (!path) return false;
	const file = app.vault.getAbstractFileByPath(normalizePath(path));
	if (!(file instanceof TFile)) return false;

	const { frontmatter } = splitFrontmatter(await app.vault.read(file));
	if (!hasMarker(frontmatter)) return false;
	const classes = (frontmatter as Record<string, unknown>).cssclasses;
	const has = Array.isArray(classes) ? classes.includes(OUTLINE_WIDE_CLASS) : classes === OUTLINE_WIDE_CLASS;
	if (has) return false;

	await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
		const current = fm.cssclasses;
		if (Array.isArray(current)) {
			if (!current.includes(OUTLINE_WIDE_CLASS)) current.push(OUTLINE_WIDE_CLASS);
		} else if (typeof current === "string" && current.trim() !== "") {
			fm.cssclasses = [current, OUTLINE_WIDE_CLASS];
		} else {
			fm.cssclasses = [OUTLINE_WIDE_CLASS];
		}
	});
	return true;
}

/**
 * Writes one cell of the Outline table, re-checked against the file's current
 * content inside the atomic `process()` so an edit never lands on a row that
 * moved. `target` is the row as the caller displayed it (see `setOutlineCell`).
 * Returns why it did not write, or `{ ok: true }`.
 */
export async function writeOutlineCell(
	app: App,
	path: string,
	target: { lineIndex: number; chapterText: string | null; sceneText: string | null },
	column: OutlineColumn,
	value: string,
): Promise<{ ok: true } | { ok: false; reason: "no-file" | "no-column" | "no-row" | "stale" }> {
	const file = path ? app.vault.getAbstractFileByPath(normalizePath(path)) : null;
	if (!(file instanceof TFile)) return { ok: false, reason: "no-file" };

	let result: CellEditResult = { ok: false, reason: "no-row" };
	await app.vault.process(file, (content) => {
		const { frontmatter, body } = splitFrontmatter(content);
		if (!hasMarker(frontmatter)) return content;
		result = setOutlineCell(body, target, column, value);
		if (!result.ok) return content;
		return content.slice(0, content.length - body.length) + result.body;
	});
	return result.ok ? { ok: true } : result;
}

/** Appends an empty, numbered row to the Outline table. Returns whether it wrote. */
export async function appendOutlineRowToFile(app: App, path: string): Promise<boolean> {
	const file = path ? app.vault.getAbstractFileByPath(normalizePath(path)) : null;
	if (!(file instanceof TFile)) return false;

	let wrote = false;
	await app.vault.process(file, (content) => {
		const { frontmatter, body } = splitFrontmatter(content);
		if (!hasMarker(frontmatter)) return content;
		const next = appendOutlineRow(body);
		if (next === null) return content;
		wrote = true;
		return content.slice(0, content.length - body.length) + next;
	});
	return wrote;
}

/**
 * Fills the Outline file's table from `table` (built by `generateOutlineTable`),
 * but only when its current table has no data rows — a filled-in outline is
 * never clobbered. Returns whether it wrote. Surrounding text is preserved.
 */
export async function writeGeneratedOutline(app: App, path: string, table: string): Promise<boolean> {
	if (!path) return false;
	const file = app.vault.getAbstractFileByPath(normalizePath(path));
	if (!(file instanceof TFile)) return false;

	let wrote = false;
	// process() is the atomic read-modify-write Obsidian recommends over
	// read()+modify() for editing a file in the background.
	await app.vault.process(file, (content) => {
		const { frontmatter, body } = splitFrontmatter(content);
		if (!hasMarker(frontmatter)) return content;
		if (parseOutlineTable(body).length > 0) return content;

		const head = content.slice(0, content.length - body.length);
		wrote = true;
		return head + replaceFirstTable(body, table);
	});
	return wrote;
}
