// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { addIcon, Notice, normalizePath, Plugin, WorkspaceLeaf } from "obsidian";
import { lineFilePath, readLineLayout } from "./data/lineFile";
import { ensureOutlineFile, outlineFilePath, writeGeneratedOutline } from "./data/outlineFile";
import { generateOutlineTable, isOutlineRowable } from "./data/outlineGenerate";
import { VaultIndex } from "./data/vaultIndex";
import { DEFAULT_SETTINGS, ScribeVisualizationSettings } from "./settings/settings";
import { ScribeVisualizationSettingTab } from "./settings/settingsTab";
import { LINE_ICON_ID, LINE_ICON_SVG, LineView, VIEW_TYPE_LINE_VIEW } from "./views/lineView";

export default class ScribeVisualizationPlugin extends Plugin {
	settings: ScribeVisualizationSettings;
	vaultIndex: VaultIndex;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.vaultIndex = new VaultIndex(this.app, () => ({
			bookFolders: this.settings.bookFolders,
			titleLanguage: this.settings.titleLanguage,
		}));
		this.addChild(this.vaultIndex);

		addIcon(LINE_ICON_ID, LINE_ICON_SVG);

		this.registerView(VIEW_TYPE_LINE_VIEW, (leaf) => new LineView(leaf, this));

		this.addRibbonIcon(LINE_ICON_ID, "(SL) Visualization: Open StoryLines", () => {
			void this.activateView(VIEW_TYPE_LINE_VIEW);
		}).addClass("scribe-ribbon-icon");

		this.addCommand({
			id: "open-scribe-visualization-lines",
			name: "Open StoryLines",
			callback: () => this.activateView(VIEW_TYPE_LINE_VIEW),
		});

		this.addCommand({
			id: "generate-outline-from-notes",
			name: "Generate story outline from notes",
			callback: () => void this.generateOutline(),
		});

		this.addSettingTab(new ScribeVisualizationSettingTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<ScribeVisualizationSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...stored };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		void this.vaultIndex.rebuild();
	}

	/**
	 * Creates the empty-table skeleton for each configured book. Only ever
	 * triggered by the explicit "Create" button in settings — never from
	 * `saveSettings()`, which fires on every keystroke and would leave a file
	 * behind for every partial name ("(SL) T", "(SL) Te", …). Returns how many
	 * files it actually created (the rest already existed).
	 */
	async createOutlineFiles(): Promise<number> {
		const { bookFolders, outlineFileName } = this.settings;
		if (!outlineFileName) return 0;
		const books = bookFolders.length > 0 ? bookFolders : [""];
		let created = 0;
		for (const book of books) {
			if (await ensureOutlineFile(this.app, outlineFilePath(book, outlineFileName))) created++;
		}
		return created;
	}

	/** Fills a still-empty Outline file from the book's current chapter/scene notes. */
	private async generateOutline(): Promise<void> {
		const book = this.vaultIndex.getBookFolders()[0] ?? "";
		const path = outlineFilePath(book, this.settings.outlineFileName);
		if (!path) {
			new Notice("Set a Story Outline file name in the plugin settings first.");
			return;
		}

		await ensureOutlineFile(this.app, path);
		const entries = this.vaultIndex.getEntriesForBook(book);
		if (entries.length === 0) {
			new Notice("No chapter or scene notes to build a story outline from.");
			return;
		}

		const rowable = entries.filter(isOutlineRowable).length;
		const skipped = entries.length - rowable;
		if (rowable === 0) {
			new Notice("Only unnumbered notes (e.g. Prologue) found — the story outline table can't represent those.");
			return;
		}

		const layout = await readLineLayout(
			this.app,
			normalizePath(lineFilePath(book, this.settings.lineFileName)),
		);
		const table = generateOutlineTable(entries, layout, this.settings.titleLanguage);
		const wrote = await writeGeneratedOutline(this.app, path, table);
		const skippedNote =
			skipped > 0 ? ` Skipped ${skipped} unnumbered note${skipped === 1 ? "" : "s"} (e.g. Prologue).` : "";
		new Notice(
			wrote
				? `Wrote ${rowable} row${rowable === 1 ? "" : "s"} to "${path}".${skippedNote}`
				: `"${path}" already has a story outline — left it untouched.`,
		);
	}

	private async activateView(viewType: string): Promise<void> {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(viewType)[0] ?? null;
		if (!leaf) {
			leaf = workspace.getLeaf("tab");
			await leaf.setViewState({ type: viewType, active: true });
		}

		await workspace.revealLeaf(leaf);
	}
}
