// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { App, Component, debounce, TFile } from "obsidian";
import { FRONTMATTER_KEYS, LEGACY_PLACES_KEY, NovelEntry } from "../types";
import { byManuscriptOrder } from "./manuscriptOrder";
import { folderContext } from "./pathContext";
import { DEFAULT_LANGUAGE, parseTitle } from "./titleParser";
import { countWords } from "./wordCount";

/** Settings the index needs; supplied lazily so it always reads current values. */
export interface VaultIndexConfig {
	storyFolder: string;
	titleLanguage: string;
}

/** Frontmatter cells are `any`; only strings/numbers/booleans coerce meaningfully. */
function scalarToString(value: unknown): string {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return "";
}

function toStringArray(value: unknown): string[] {
	if (Array.isArray(value)) return value.map((v) => scalarToString(v).trim()).filter(Boolean);
	return scalarToString(value)
		.split(",")
		.map((v) => v.trim())
		.filter(Boolean);
}

function toStringOrNull(value: unknown): string | null {
	return scalarToString(value) || null;
}

/** Normalizes a folder path for prefix matching (no leading/trailing slash). */
export function normalizeFolder(folder: string): string {
	return folder.replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * Scans the configured story folder for notes whose title parses as a chapter
 * or scene (see titleParser) and keeps a live, in-memory index of them. Views
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

	/** The configured story folder, normalized; "" means none configured (whole-vault scan). */
	getStoryFolder(): string {
		return normalizeFolder(this.getConfig().storyFolder);
	}

	/** Entries under one book folder (pass "" for the no-book-folder whole-vault case). */
	getEntriesForBook(bookFolder: string): NovelEntry[] {
		const target = normalizeFolder(bookFolder);
		return this.entries.filter((e) => e.bookFolder === target);
	}

	/** Rebuilds the index; safe to call from anywhere (e.g. when settings change). */
	async rebuild(): Promise<void> {
		const { storyFolder, titleLanguage } = this.getConfig();
		const folder = normalizeFolder(storyFolder);
		const language = titleLanguage || DEFAULT_LANGUAGE;

		const candidates = this.app.vault.getMarkdownFiles().flatMap((file) => {
			if (folder && file.path !== folder && !file.path.startsWith(`${folder}/`)) return [];
			return [{ file, base: folder }];
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
			locations: toStringArray(frontmatter[FRONTMATTER_KEYS.locations] ?? frontmatter[LEGACY_PLACES_KEY]),
			status: toStringOrNull(frontmatter[FRONTMATTER_KEYS.status]),
			wordCount: countWords(content),
		};
	}
}
