// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 aescanes

import { App, Component, debounce, TFile } from "obsidian";
import { EntrySource, EntryType, FRONTMATTER_KEYS, NovelEntry } from "../types";
import { folderContext } from "./pathContext";
import { DEFAULT_LANGUAGE, parseTitle } from "./titleParser";

/** Settings the index needs; supplied lazily so it always reads current values. */
export interface VaultIndexConfig {
	bookFolders: string[];
	titleLanguage: string;
}

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

/** Normalizes a folder path for prefix matching (no leading/trailing slash). */
export function normalizeFolder(folder: string): string {
	return folder.replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * Scans the vault for chapter/scene notes and keeps a live, in-memory index of
 * them. A note qualifies if its title parses as a chapter/scene (see
 * titleParser) or if it declares a scribe-visualization-type frontmatter key,
 * which also overrides the title-based classification. When book folders are
 * configured, only notes inside them are considered.
 *
 * Views subscribe via `onChange` and re-render whenever the index is rebuilt.
 */
export class VaultIndex extends Component {
	private entries: NovelEntry[] = [];
	private listeners: Array<() => void> = [];

	/** Coalesces bursts of vault events into a single rebuild. */
	private scheduleRebuild = debounce(() => this.rebuild(), 200, true);

	constructor(private app: App, private getConfig: () => VaultIndexConfig) {
		super();
	}

	onload(): void {
		// getMarkdownFiles() can be empty this early during a cold Obsidian
		// start, and notes with no frontmatter never fire metadataCache
		// "changed", so do the first real scan once the layout is ready and
		// again when the metadata cache finishes resolving.
		this.app.workspace.onLayoutReady(() => this.rebuild());
		this.registerEvent(this.app.metadataCache.on("resolved", () => this.scheduleRebuild()));
		this.registerEvent(this.app.metadataCache.on("changed", () => this.scheduleRebuild()));
		this.registerEvent(this.app.metadataCache.on("deleted", () => this.scheduleRebuild()));
		this.registerEvent(this.app.vault.on("create", () => this.scheduleRebuild()));
		this.registerEvent(this.app.vault.on("delete", () => this.scheduleRebuild()));
		this.registerEvent(this.app.vault.on("rename", () => this.scheduleRebuild()));
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

	/** Configured book folders, normalized, in the order the user listed them. */
	getBookFolders(): string[] {
		return this.getConfig().bookFolders.map(normalizeFolder).filter(Boolean);
	}

	/** Entries under one book folder (pass "" for the no-book-folder whole-vault case). */
	getEntriesForBook(bookFolder: string): NovelEntry[] {
		const target = normalizeFolder(bookFolder);
		return this.entries.filter((e) => e.bookFolder === target);
	}

	getTimelineNames(): string[] {
		const names = new Set<string>();
		for (const entry of this.entries) {
			for (const t of entry.timelines) names.add(t);
		}
		return Array.from(names).sort();
	}

	/** Rebuilds the index; safe to call from anywhere (e.g. when settings change). */
	rebuild(): void {
		const { bookFolders, titleLanguage } = this.getConfig();
		// Longest first so a nested book folder wins over its parent.
		const folders = bookFolders.map(normalizeFolder).filter(Boolean).sort((a, b) => b.length - a.length);
		const language = titleLanguage || DEFAULT_LANGUAGE;

		const entries: NovelEntry[] = [];
		for (const file of this.app.vault.getMarkdownFiles()) {
			const base = folders.find((f) => file.path === f || file.path.startsWith(`${f}/`));
			if (folders.length > 0 && base === undefined) continue;
			const entry = this.parseFile(file, language, base ?? "");
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

	private parseFile(file: TFile, language: string, baseFolder: string): NovelEntry | null {
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};

		let type: EntryType | null = null;
		let source: EntrySource = "title";
		let parsedNumber: number | null = null;

		const rawType = frontmatter[FRONTMATTER_KEYS.type];
		if (rawType === "chapter" || rawType === "scene") {
			type = rawType;
			source = "frontmatter";
		} else {
			const parsed = parseTitle(file.basename, language);
			if (parsed) {
				type = parsed.type;
				parsedNumber = parsed.number;
			}
		}

		if (!type) return null;

		return {
			file,
			type,
			source,
			title: file.basename,
			bookFolder: baseFolder,
			context: folderContext(file.path, baseFolder),
			order: toNumberOrNull(frontmatter[FRONTMATTER_KEYS.order]) ?? parsedNumber,
			timelines: toStringArray(frontmatter[FRONTMATTER_KEYS.timelines]),
			date: toStringOrNull(frontmatter[FRONTMATTER_KEYS.date]),
			characters: toStringArray(frontmatter[FRONTMATTER_KEYS.characters]),
			places: toStringArray(frontmatter[FRONTMATTER_KEYS.places]),
			status: toStringOrNull(frontmatter[FRONTMATTER_KEYS.status]),
		};
	}
}
