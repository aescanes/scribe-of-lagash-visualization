// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { Line, LineLayout, Placement } from "../types";

/**
 * Pure helpers for the per-book line layout: constructing it, coercing
 * loosely-typed parsed YAML into a well-formed shape, and computing its
 * Line-file path. No Obsidian APIs — kept separate from lineFile.ts so it stays
 * unit-testable.
 */

export const DEFAULT_LINE_FILE = "Lines.md";
export const DEFAULT_LINE_COLOR = "#888888";

export function emptyLineLayout(): LineLayout {
	return { lines: [], placements: {} };
}

function trimSlashes(path: string): string {
	return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

/** Vault-relative path to a book's Lines file. */
export function lineFilePath(bookFolder: string, fileName: string): string {
	const folder = trimSlashes(bookFolder);
	const name = trimSlashes(fileName.trim()) || DEFAULT_LINE_FILE;
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

	// `timelines` is the pre-0.4 key name; still read it so old files load.
	const rawLines = Array.isArray(obj.lines) ? obj.lines : obj.timelines;
	if (Array.isArray(rawLines)) {
		rawLines.forEach((item, i) => {
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
		for (const [path, value] of Object.entries(obj.placements as Record<string, unknown>)) {
			if (!value || typeof value !== "object") continue;
			const p = value as Record<string, unknown>;
			const placement: Placement = {
				lines: asStringArray(Array.isArray(p.lines) ? p.lines : p.timelines),
				x: asNumber(p.x, 0),
			};
			layout.placements[path] = placement;
		}
	}

	return layout;
}
