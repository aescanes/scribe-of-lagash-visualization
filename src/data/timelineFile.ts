// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { App, normalizePath, parseYaml, TFile } from "obsidian";
import { BookLayout } from "../types";
import { emptyBookLayout, parseBookLayout } from "./bookLayout";

export { emptyBookLayout, timelineFilePath } from "./bookLayout";

/**
 * Reads and writes the per-book companion file (default "Timelines.md") that
 * stores the timeline canvas layout. The file is a normal Markdown note whose
 * frontmatter holds the data and whose body is free for the user's own notes;
 * writes preserve that body.
 *
 * This is the ONLY file the plugin writes — chapter/scene notes are never
 * modified.
 */

const MARKER_KEY = "scribe-visualization";
const MARKER_VALUE = "book";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** Extracts and parses the YAML frontmatter block from raw file content. */
function parseFrontmatterBlock(content: string): unknown {
	const match = FRONTMATTER_RE.exec(content);
	if (!match) return null;
	try {
		return parseYaml(match[1]);
	} catch {
		return null;
	}
}

export async function readBookLayout(app: App, path: string): Promise<BookLayout> {
	const file = app.vault.getAbstractFileByPath(normalizePath(path));
	if (!(file instanceof TFile)) return emptyBookLayout();
	const content = await app.vault.read(file);
	return parseBookLayout(parseFrontmatterBlock(content));
}

/**
 * Persists a layout to the companion file, creating it if needed and keeping
 * any existing note body intact.
 */
export async function writeBookLayout(app: App, path: string, layout: BookLayout): Promise<void> {
	const normalized = normalizePath(path);
	const existing = app.vault.getAbstractFileByPath(normalized);
	const timelines = [...layout.timelines].sort((a, b) => a.order - b.order);

	if (existing instanceof TFile) {
		await app.fileManager.processFrontMatter(existing, (fm) => {
			fm[MARKER_KEY] = MARKER_VALUE;
			fm.timelines = timelines;
			fm.placements = layout.placements;
		});
		return;
	}

	const body = [
		"---",
		`${MARKER_KEY}: ${MARKER_VALUE}`,
		serializeForNewFile({ timelines, placements: layout.placements }),
		"---",
		"",
		"<!-- Managed by Scribe of Lagash: Visualization. Notes about this book's structure can go below. -->",
		"",
	].join("\n");
	await app.vault.create(normalized, body);
}

/**
 * Minimal YAML serialization for the initial file only; subsequent writes go
 * through Obsidian's own frontmatter serializer via processFrontMatter.
 */
function serializeForNewFile(layout: BookLayout): string {
	const lines: string[] = [];

	if (layout.timelines.length === 0) {
		lines.push("timelines: []");
	} else {
		lines.push("timelines:");
		for (const t of layout.timelines) {
			lines.push(`  - id: ${JSON.stringify(t.id)}`);
			lines.push(`    name: ${JSON.stringify(t.name)}`);
			lines.push(`    color: ${JSON.stringify(t.color)}`);
			lines.push(`    order: ${t.order}`);
		}
	}

	const paths = Object.keys(layout.placements);
	if (paths.length === 0) {
		lines.push("placements: {}");
	} else {
		lines.push("placements:");
		for (const path of paths) {
			const p = layout.placements[path];
			lines.push(`  ${JSON.stringify(path)}:`);
			lines.push(`    timelines: [${p.timelines.map((id) => JSON.stringify(id)).join(", ")}]`);
			lines.push(`    x: ${p.x}`);
		}
	}

	return lines.join("\n");
}
