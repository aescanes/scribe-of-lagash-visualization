// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 aescanes

import { App, Component, TFile } from "obsidian";
import { FRONTMATTER_KEYS, NovelEntry, EntryType } from "../types";

function toStringArray(value: unknown): string[] {
	if (value === null || value === undefined) return [];
	if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
	return String(value)
		.split(",")
		.map((v) => v.trim())
		.filter(Boolean);
}

function toStringOrNull(value: unknown): string | null {
	if (value === null || value === undefined || value === "") return null;
	return String(value);
}

function toNumberOrNull(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;
	const n = Number(value);
	return Number.isNaN(n) ? null : n;
}

/**
 * Scans the vault for notes that declare a scribe-visualization-type frontmatter key and
 * keeps a live, in-memory index of the resulting chapters/scenes. Views
 * subscribe via `onChange` and re-render whenever the index is rebuilt.
 */
export class VaultIndex extends Component {
	private entries: NovelEntry[] = [];
	private listeners: Array<() => void> = [];

	constructor(private app: App) {
		super();
	}

	onload(): void {
		this.rebuild();
		this.registerEvent(this.app.metadataCache.on("changed", () => this.rebuild()));
		this.registerEvent(this.app.metadataCache.on("deleted", () => this.rebuild()));
		this.registerEvent(this.app.vault.on("rename", () => this.rebuild()));
	}

	onChange(listener: () => void): () => void {
		this.listeners.push(listener);
		return () => {
			this.listeners = this.listeners.filter((l) => l !== listener);
		};
	}

	getEntries(): NovelEntry[] {
		return this.entries;
	}

	getTimelineNames(): string[] {
		const names = new Set<string>();
		for (const entry of this.entries) {
			for (const t of entry.timelines) names.add(t);
		}
		return Array.from(names).sort();
	}

	private rebuild(): void {
		const entries: NovelEntry[] = [];

		for (const file of this.app.vault.getMarkdownFiles()) {
			const entry = this.parseFile(file);
			if (entry) entries.push(entry);
		}

		entries.sort((a, b) => {
			if (a.order !== null && b.order !== null) return a.order - b.order;
			if (a.order !== null) return -1;
			if (b.order !== null) return 1;
			return a.title.localeCompare(b.title);
		});

		this.entries = entries;
		for (const listener of this.listeners) listener();
	}

	private parseFile(file: TFile): NovelEntry | null {
		const cache = this.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter;
		if (!frontmatter) return null;

		const rawType = frontmatter[FRONTMATTER_KEYS.type];
		if (rawType !== "chapter" && rawType !== "scene") return null;

		const type: EntryType = rawType;

		return {
			file,
			type,
			title: file.basename,
			order: toNumberOrNull(frontmatter[FRONTMATTER_KEYS.order]),
			timelines: toStringArray(frontmatter[FRONTMATTER_KEYS.timelines]),
			date: toStringOrNull(frontmatter[FRONTMATTER_KEYS.date]),
			characters: toStringArray(frontmatter[FRONTMATTER_KEYS.characters]),
			places: toStringArray(frontmatter[FRONTMATTER_KEYS.places]),
			status: toStringOrNull(frontmatter[FRONTMATTER_KEYS.status]),
			parent: toStringOrNull(frontmatter[FRONTMATTER_KEYS.parent]),
		};
	}
}
