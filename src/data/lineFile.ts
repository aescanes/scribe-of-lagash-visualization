// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { App, normalizePath, parseYaml, TFile } from "obsidian";
import { LineLayout } from "../types";
import { emptyLineLayout, parseLineLayout } from "./lineLayout";

export { emptyLineLayout, lineFilePath } from "./lineLayout";

/**
 * Reads and writes the per-book "Lines file" (default "Lines.md") that stores a
 * book's default view — its lines and card placements. The file is a normal
 * Markdown note whose frontmatter holds the data and whose body is free for the
 * user's own notes; writes preserve that body.
 *
 * This is the ONLY file the plugin writes — chapter/scene notes are never
 * modified.
 */

const MARKER_KEY = "scribe-visualization";
const MARKER_VALUE = "lines";

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

export async function readLineLayout(app: App, path: string): Promise<LineLayout> {
	const file = app.vault.getAbstractFileByPath(normalizePath(path));
	if (!(file instanceof TFile)) return emptyLineLayout();
	const content = await app.vault.read(file);
	return parseLineLayout(parseFrontmatterBlock(content));
}

/**
 * Persists a layout to the Lines file, creating it if needed and keeping any
 * existing note body intact.
 */
export async function writeLineLayout(app: App, path: string, layout: LineLayout): Promise<void> {
	const normalized = normalizePath(path);
	const existing = app.vault.getAbstractFileByPath(normalized);
	const lines = [...layout.lines].sort((a, b) => a.order - b.order);

	if (existing instanceof TFile) {
		await app.fileManager.processFrontMatter(existing, (fm: Record<string, unknown>) => {
			fm[MARKER_KEY] = MARKER_VALUE;
			fm.lines = lines;
			fm.placements = layout.placements;
		});
		return;
	}

	const body = [
		"---",
		`${MARKER_KEY}: ${MARKER_VALUE}`,
		serializeForNewFile({ lines, placements: layout.placements }),
		"---",
		"",
		"<!-- Managed by Scribe of Lagash - Visualization. Notes about this book can go below. -->",
		"",
	].join("\n");
	await app.vault.create(normalized, body);
}

/**
 * Minimal YAML serialization for the initial file only; subsequent writes go
 * through Obsidian's own frontmatter serializer via processFrontMatter.
 */
function serializeForNewFile(layout: LineLayout): string {
	const out: string[] = [];

	if (layout.lines.length === 0) {
		out.push("lines: []");
	} else {
		out.push("lines:");
		for (const line of layout.lines) {
			out.push(`  - id: ${JSON.stringify(line.id)}`);
			out.push(`    name: ${JSON.stringify(line.name)}`);
			out.push(`    color: ${JSON.stringify(line.color)}`);
			out.push(`    order: ${line.order}`);
		}
	}

	const paths = Object.keys(layout.placements);
	if (paths.length === 0) {
		out.push("placements: {}");
	} else {
		out.push("placements:");
		for (const path of paths) {
			const p = layout.placements[path];
			out.push(`  ${JSON.stringify(path)}:`);
			out.push(`    lines: [${p.lines.map((id) => JSON.stringify(id)).join(", ")}]`);
			out.push(`    x: ${p.x}`);
		}
	}

	return out.join("\n");
}
