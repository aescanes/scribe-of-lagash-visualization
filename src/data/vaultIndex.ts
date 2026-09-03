// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { App, Component, debounce, TFile } from "obsidian";
import { FRONTMATTER_KEYS, NovelEntry } from "../types";
import { byManuscriptOrder } from "./manuscriptOrder";
import { folderContext } from "./pathContext";
import { DEFAULT_LANGUAGE, parseTitle } from "./titleParser";
import { countWords } from "./wordCount";

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

/** Normalizes a folder path for prefix matching (no leading/trailing slash). */
export function normalizeFolder(folder: string): string {
	return folder.replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * Scans configured book folders for notes whose title parses as a chapter or
 * scene (see titleParser) and keeps a live, in-memory index of them. Views
 * subscribe via `onChange` and re-render whenever the index is rebuilt.
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

	/** Rebuilds the index; safe to call from anywhere (e.g. when settings change). */
	async rebuild(): Promise<void> {
		const { bookFolders, titleLanguage } = this.getConfig();
		// Longest first so a nested book folder wins over its parent.
		const folders = bookFolders.map(normalizeFolder).filter(Boolean).sort((a, b) => b.length - a.length);
		const language = titleLanguage || DEFAULT_LANGUAGE;

		const candidates = this.app.vault.getMarkdownFiles().flatMap((file) => {
			const base = folders.find((f) => file.path === f || file.path.startsWith(`${f}/`));
			if (folders.length > 0 && base === undefined) return [];
			return [{ file, base: base ?? "" }];
		});

		const parsed = await Promise.all(candidates.map(({ file, base }) => this.parseFile(file, language, base)));
		const entries = parsed.filter((entry): entry is NovelEntry => entry !== null);

		entries.sort((a, b) =>
			byManuscriptOrder(
				{ path: a.file.path, order: a.order, title: a.title },
				{ path: b.file.path, order: b.order, title: b.title },
			),
		);

		this.entries = entries;
		for (const listener of this.listeners) listener();
	}

	private async parseFile(file: TFile, language: string, baseFolder: string): Promise<NovelEntry | null> {
		const parsed = parseTitle(file.basename, language);
		if (!parsed) return null;

		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
		const content = await this.app.vault.cachedRead(file);

		return {
			file,
			type: parsed.type,
			title: file.basename,
			bookFolder: baseFolder,
			context: folderContext(file.path, baseFolder),
			order: parsed.number,
			date: toStringOrNull(frontmatter[FRONTMATTER_KEYS.date]),
			characters: toStringArray(frontmatter[FRONTMATTER_KEYS.characters]),
			places: toStringArray(frontmatter[FRONTMATTER_KEYS.places]),
			status: toStringOrNull(frontmatter[FRONTMATTER_KEYS.status]),
			wordCount: countWords(content),
		};
	}
}
