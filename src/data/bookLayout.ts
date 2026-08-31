// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { BookLayout, Placement, TimelineDef } from "../types";

/**
 * Pure helpers for the per-book timeline layout: constructing it, coercing
 * loosely-typed parsed YAML into a well-formed shape, and computing its
 * companion-file path. No Obsidian APIs — kept separate from timelineFile.ts
 * so it stays unit-testable.
 */

export const DEFAULT_TIMELINE_FILE = "Timelines.md";
export const DEFAULT_TIMELINE_COLOR = "#888888";

export function emptyBookLayout(): BookLayout {
	return { timelines: [], placements: {} };
}

function trimSlashes(path: string): string {
	return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

/** Vault-relative path to a book's companion file. */
export function timelineFilePath(bookFolder: string, fileName: string): string {
	const folder = trimSlashes(bookFolder);
	const name = trimSlashes(fileName.trim()) || DEFAULT_TIMELINE_FILE;
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

/** Coerces arbitrary parsed YAML into a well-formed BookLayout. */
export function parseBookLayout(raw: unknown): BookLayout {
	const layout = emptyBookLayout();
	if (!raw || typeof raw !== "object") return layout;
	const obj = raw as Record<string, unknown>;

	if (Array.isArray(obj.timelines)) {
		obj.timelines.forEach((item, i) => {
			if (!item || typeof item !== "object") return;
			const t = item as Record<string, unknown>;
			const id = asString(t.id, "");
			if (!id) return;
			const def: TimelineDef = {
				id,
				name: asString(t.name, id),
				color: asString(t.color, DEFAULT_TIMELINE_COLOR),
				order: asNumber(t.order, i),
			};
			layout.timelines.push(def);
		});
	}

	if (obj.placements && typeof obj.placements === "object") {
		for (const [path, value] of Object.entries(obj.placements as Record<string, unknown>)) {
			if (!value || typeof value !== "object") continue;
			const p = value as Record<string, unknown>;
			const placement: Placement = {
				timelines: asStringArray(p.timelines),
				x: asNumber(p.x, 0),
			};
			layout.placements[path] = placement;
		}
	}

	return layout;
}
