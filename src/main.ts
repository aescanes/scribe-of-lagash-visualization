// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { Plugin, WorkspaceLeaf } from "obsidian";
import { VaultIndex } from "./data/vaultIndex";
import { DEFAULT_SETTINGS, ScribeVisualizationSettings } from "./settings/settings";
import { ScribeVisualizationSettingTab } from "./settings/settingsTab";
import { LineView, VIEW_TYPE_LINE_VIEW } from "./views/lineView";

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

		this.registerView(VIEW_TYPE_LINE_VIEW, (leaf) => new LineView(leaf, this));

		this.addRibbonIcon("chart-no-axes-gantt", "Open lines", () => {
			this.activateView(VIEW_TYPE_LINE_VIEW);
		});

		this.addCommand({
			id: "open-lines",
			name: "Open lines",
			callback: () => this.activateView(VIEW_TYPE_LINE_VIEW),
		});

		this.addSettingTab(new ScribeVisualizationSettingTab(this.app, this));
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
