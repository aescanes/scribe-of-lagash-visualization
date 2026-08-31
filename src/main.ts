// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { Plugin, WorkspaceLeaf } from "obsidian";
import { VaultIndex } from "./data/vaultIndex";
import { DEFAULT_SETTINGS, ScribeVisualizationSettings } from "./settings/settings";
import { ScribeVisualizationSettingTab } from "./settings/settingsTab";
import { TimelineView, VIEW_TYPE_TIMELINE } from "./views/timelineView";
import { TimelineCanvasView, VIEW_TYPE_TIMELINE_CANVAS } from "./views/timelineCanvasView";
import { BASES_VIEW_TYPE_TIMELINE, ScribeTimelineBasesView } from "./views/basesTimelineView";

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

		this.registerView(VIEW_TYPE_TIMELINE, (leaf) => new TimelineView(leaf, this));
		this.registerView(VIEW_TYPE_TIMELINE_CANVAS, (leaf) => new TimelineCanvasView(leaf, this));

		this.registerBasesView(BASES_VIEW_TYPE_TIMELINE, {
			name: "Scribe timeline",
			icon: "chart-no-axes-gantt",
			factory: (controller, containerEl) => new ScribeTimelineBasesView(controller, containerEl),
		});

		this.addRibbonIcon("chart-no-axes-gantt", "Open timeline canvas", () => {
			this.activateView(VIEW_TYPE_TIMELINE_CANVAS);
		});

		this.addCommand({
			id: "open-timeline-canvas",
			name: "Open timeline canvas",
			callback: () => this.activateView(VIEW_TYPE_TIMELINE_CANVAS),
		});

		this.addCommand({
			id: "open-chapter-timeline",
			name: "Open simple timeline",
			callback: () => this.activateView(VIEW_TYPE_TIMELINE),
		});

		this.addSettingTab(new ScribeVisualizationSettingTab(this.app, this));
	}

	onunload(): void {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_TIMELINE);
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_TIMELINE_CANVAS);
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
