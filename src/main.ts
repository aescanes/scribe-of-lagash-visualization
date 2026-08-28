// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 aescanes

import { Plugin, WorkspaceLeaf } from "obsidian";
import { VaultIndex } from "./data/vaultIndex";
import { DEFAULT_SETTINGS, ScribeVisualizationSettings } from "./settings/settings";
import { ScribeVisualizationSettingTab } from "./settings/settingsTab";
import { TimelineView, VIEW_TYPE_TIMELINE } from "./views/timelineView";
import { BASES_VIEW_TYPE_TIMELINE, ScribeTimelineBasesView } from "./views/basesTimelineView";

export default class ScribeVisualizationPlugin extends Plugin {
	settings: ScribeVisualizationSettings;
	vaultIndex: VaultIndex;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.vaultIndex = new VaultIndex(this.app);
		this.addChild(this.vaultIndex);

		this.registerView(VIEW_TYPE_TIMELINE, (leaf) => new TimelineView(leaf, this));

		this.registerBasesView(BASES_VIEW_TYPE_TIMELINE, {
			name: "Chapter timeline",
			icon: "clock",
			factory: (controller, containerEl) => new ScribeTimelineBasesView(controller, containerEl),
		});

		this.addRibbonIcon("clock", "Open chapter timeline", () => {
			this.activateTimelineView();
		});

		this.addCommand({
			id: "open-chapter-timeline",
			name: "Open chapter timeline",
			callback: () => this.activateTimelineView(),
		});

		this.addSettingTab(new ScribeVisualizationSettingTab(this.app, this));
	}

	onunload(): void {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_TIMELINE);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async activateTimelineView(): Promise<void> {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_TIMELINE)[0] ?? null;
		if (!leaf) {
			leaf = workspace.getLeaf("tab");
			await leaf.setViewState({ type: VIEW_TYPE_TIMELINE, active: true });
		}

		workspace.revealLeaf(leaf);
	}
}
