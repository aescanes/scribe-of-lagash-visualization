// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { addIcon, Notice, normalizePath, Plugin, WorkspaceLeaf } from "obsidian";
import { lineFilePath, readLineLayout } from "./data/lineFile";
import { ensureOutlineFile, outlineFilePath, writeGeneratedOutline } from "./data/outlineFile";
import { generateOutlineTable } from "./data/outlineGenerate";
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

		this.addRibbonIcon(LINE_ICON_ID, "(SL) Visualization: Open lines", () => {
			this.activateView(VIEW_TYPE_LINE_VIEW);
		}).addClass("scribe-ribbon-icon");

		this.addCommand({
			id: "open-scribe-visualization-lines",
			name: "Open lines",
			callback: () => this.activateView(VIEW_TYPE_LINE_VIEW),
		});

		this.addCommand({
			id: "generate-outline-from-notes",
			name: "Generate outline from notes",
			callback: () => void this.generateOutline(),
		});

		this.addSettingTab(new ScribeVisualizationSettingTab(this.app, this));

		// Covers an Outline file name that was already set (synced settings, a
		// fresh install pointed at an existing data.json) before this session
		// ever called saveSettings().
		this.app.workspace.onLayoutReady(() => void this.ensureOutlineFiles());
	}

	onunload(): void {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_LINE_VIEW);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.vaultIndex.rebuild();
		await this.ensureOutlineFiles();
	}

	/** Creates the empty-table skeleton for each configured book once an Outline file is named. */
	private async ensureOutlineFiles(): Promise<void> {
		const { bookFolders, outlineFileName } = this.settings;
		if (!outlineFileName) return;
		for (const book of bookFolders) {
			await ensureOutlineFile(this.app, outlineFilePath(book, outlineFileName));
		}
	}

	/** Fills a still-empty Outline file from the book's current chapter/scene notes. */
	private async generateOutline(): Promise<void> {
		const book = this.vaultIndex.getBookFolders()[0] ?? "";
		const path = outlineFilePath(book, this.settings.outlineFileName);
		if (!path) {
			new Notice("Set an Outline file name in the plugin settings first.");
			return;
		}

		await ensureOutlineFile(this.app, path);
		const entries = this.vaultIndex.getEntriesForBook(book);
		if (entries.length === 0) {
			new Notice("No chapter or scene notes to build an outline from.");
			return;
		}

		const layout = await readLineLayout(
			this.app,
			normalizePath(lineFilePath(book, this.settings.lineFileName)),
		);
		const table = generateOutlineTable(entries, layout, this.settings.titleLanguage);
		const wrote = await writeGeneratedOutline(this.app, path, table);
		new Notice(
			wrote
				? `Wrote ${entries.length} row${entries.length === 1 ? "" : "s"} to "${path}".`
				: `"${path}" already has an outline — left it untouched.`,
		);
	}

	private async activateView(viewType: string): Promise<void> {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(viewType)[0] ?? null;
		if (!leaf) {
			leaf = workspace.getLeaf("tab");
			await leaf.setViewState({ type: viewType, active: true });
		}

		workspace.revealLeaf(leaf);
	}
}
