// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { App, normalizePath, parseYaml, TFile } from "obsidian";
import { OutlineRow } from "../types";
import { withScribePrefix } from "./lineLayout";
import { parseOutlineTable } from "./outline";
import { replaceFirstTable } from "./outlineGenerate";

/**
 * Reads the optional per-book "Outline file" — a hand-edited Markdown table
 * planning the book's chapters/scenes, described in
 * `docs/feature-plans/outline-file-plan.md`. The plugin only ever *creates*
 * this file (the empty skeleton, once, when the user names it in settings);
 * the table itself is edited by hand and never rewritten by the plugin.
 */

const MARKER_KEY = "scribe-visualization";
const MARKER_VALUE = "outline";

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
	const name = withScribePrefix(fileName.trim());
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
	if (!path) return [];
	const file = app.vault.getAbstractFileByPath(normalizePath(path));
	if (!(file instanceof TFile)) return [];

	const content = await app.vault.read(file);
	const { frontmatter, body } = splitFrontmatter(content);
	if (!hasMarker(frontmatter)) return [];
	return parseOutlineTable(body);
}

/**
 * Creates `path` with an empty table skeleton when it doesn't exist yet. Does
 * nothing if `path` is empty or the file is already there — the plugin never
 * overwrites a hand-edited outline.
 */
export async function ensureOutlineFile(app: App, path: string): Promise<void> {
	if (!path) return;
	const normalized = normalizePath(path);
	if (app.vault.getAbstractFileByPath(normalized) instanceof TFile) return;

	const body = [
		"---",
		`${MARKER_KEY}: ${MARKER_VALUE}`,
		"---",
		"",
		"<!-- Managed by Scribe of Lagash - Visualization — created once, never",
		"     rewritten by the plugin. Edit the table below by hand; click a",
		"     placeholder card in the StoryLines view to create a row's note.",
		"     A guide to the columns is at the bottom of this file. -->",
		"",
		"| Act | Chapter | Scene | Line | Synopsis |",
		"| --- | ------- | ----- | ---- | -------- |",
		"|     |         |       |      |          |",
		"",
		"---",
		"",
		"## Filling in the outline",
		"",
		"Each row plans one chapter or scene. Fill the columns that match how this",
		"book is (or will be) organised on disk — pick **one** layout per book:",
		"",
		"| Layout | Columns to fill | The row's note |",
		"| --- | --- | --- |",
		"| Chapters as files | `Chapter` | `Chapter 1.md` |",
		"| …grouped in acts | `Act` + `Chapter` | `Act I/Chapter 1.md` |",
		"| Scenes in chapter folders | `Chapter` + `Scene` | `Chapter 1/Scene 2.md` |",
		"| …grouped in acts | `Act` + `Chapter` + `Scene` | `Act I/Chapter 1/Scene 2.md` |",
		"| Scenes with no chapter | `Scene` (+ optional `Act`) | `Scene 2.md` |",
		"| Custom folder | `Folder` (overrides `Act`) | `<Folder>/Chapter 1.md` |",
		"",
		"- Numbers may be digits or roman numerals (`IV`). The Act / Chapter / Scene",
		"  words and the folder names follow the **Title language** setting.",
		"- `Line` — a line name or id from the StoryLines file.",
		"- `Synopsis` — shown on the card, and becomes the note body when the note",
		"  is created.",
		"- Also recognised: `Folder`, `Date`, `Characters`, `Places`, `Status`.",
		"- A row with neither a Chapter nor a Scene value is ignored. Prologue /",
		"  Epilogue / Interlude have no number and can't be planned here — create",
		"  those notes directly.",
		'- Do **not** mix "chapter as a file" and "chapter as a folder" in one book.',
		"",
	].join("\n");
	await app.vault.create(normalized, body);
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

	const content = await app.vault.read(file);
	const { frontmatter, body } = splitFrontmatter(content);
	if (!hasMarker(frontmatter)) return false;
	if (parseOutlineTable(body).length > 0) return false;

	const head = content.slice(0, content.length - body.length);
	await app.vault.modify(file, head + replaceFirstTable(body, table));
	return true;
}
