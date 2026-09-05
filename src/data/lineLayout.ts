// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { Line, LineLayout, Placement } from "../types";

/**
 * Pure helpers for the per-book line layout: constructing it, coercing
 * loosely-typed parsed YAML into a well-formed shape, and computing its
 * Line-file path. No Obsidian APIs — kept separate from lineFile.ts so it stays
 * unit-testable.
 */

export const DEFAULT_LINE_FILE = "StoryLines.md";
export const DEFAULT_LINE_COLOR = "#888888";

/** Prefix put on every file the plugin manages, so they stand out in the vault. */
export const SCRIBE_FILE_PREFIX = "(SL) ";

/**
 * Prefixes a file name with "(SL) ". Idempotent — a name the user already typed
 * with the prefix (or an empty name) is returned unchanged.
 */
export function withScribePrefix(fileName: string): string {
	const name = fileName.trim();
	if (!name || name.startsWith(SCRIBE_FILE_PREFIX)) return name;
	return `${SCRIBE_FILE_PREFIX}${name}`;
}

/**
 * Makes the ".md" extension optional in a file name typed in settings: trims it,
 * drops a trailing ".md" (any case), and re-appends ".md". Empty stays empty.
 * "StoryLines" and "storylines.MD" both become "StoryLines.md".
 */
export function withMdExtension(fileName: string): string {
	const base = fileName.trim().replace(/\.md$/i, "").trim();
	return base ? `${base}.md` : "";
}

export function emptyLineLayout(): LineLayout {
	return { lines: [], placements: {} };
}

function trimSlashes(path: string): string {
	return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

/** Vault-relative path to a book's Lines file. */
export function lineFilePath(bookFolder: string, fileName: string): string {
	const folder = trimSlashes(bookFolder);
	const name = withScribePrefix(withMdExtension(trimSlashes(fileName.trim())) || DEFAULT_LINE_FILE);
	return folder ? `${folder}/${name}` : name;
}

function asString(value: unknown, fallback: string): string {
	return typeof value === "string" && value !== "" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.map((v) => String(v)).filter(Boolean);
}

/** Coerces arbitrary parsed YAML into a well-formed LineLayout. */
export function parseLineLayout(raw: unknown): LineLayout {
	const layout = emptyLineLayout();
	if (!raw || typeof raw !== "object") return layout;
	const obj = raw as Record<string, unknown>;

	if (Array.isArray(obj.lines)) {
		obj.lines.forEach((item, i) => {
			if (!item || typeof item !== "object") return;
			const t = item as Record<string, unknown>;
			const id = asString(t.id, "");
			if (!id) return;
			const line: Line = {
				id,
				name: asString(t.name, id),
				color: asString(t.color, DEFAULT_LINE_COLOR),
				order: asNumber(t.order, i),
			};
			layout.lines.push(line);
		});
	}

	if (obj.placements && typeof obj.placements === "object") {
		for (const [path, value] of Object.entries(obj.placements)) {
			if (!value || typeof value !== "object") continue;
			const p = value as Record<string, unknown>;
			const placement: Placement = {
				lines: asStringArray(p.lines),
				x: asNumber(p.x, 0),
			};
			layout.placements[path] = placement;
		}
	}

	return layout;
}
