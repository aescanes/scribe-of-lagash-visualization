// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 aescanes

import { App, PluginSettingTab, Setting } from "obsidian";
import type ScribeVisualizationPlugin from "../main";

export class ScribeVisualizationSettingTab extends PluginSettingTab {
	plugin: ScribeVisualizationPlugin;

	constructor(app: App, plugin: ScribeVisualizationPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Scribe of Lagash: Visualization" });
		containerEl.createEl("p", {
			text:
				"Chapters and scenes are regular notes. Tag a note as one of them by adding " +
				"a scribe-visualization-type frontmatter field set to \"chapter\" or \"scene\".",
		});

		const timelineNames = this.plugin.vaultIndex.getTimelineNames();

		new Setting(containerEl)
			.setName("Default timeline")
			.setDesc("Which scribe-visualization-timelines value to show when the Timeline view opens. Leave blank to show every entry regardless of timeline.")
			.addDropdown((dropdown) => {
				dropdown.addOption("", "All entries");
				for (const name of timelineNames) dropdown.addOption(name, name);
				dropdown.setValue(this.plugin.settings.defaultTimeline);
				dropdown.onChange(async (value) => {
					this.plugin.settings.defaultTimeline = value;
					await this.plugin.saveSettings();
				});
			});
	}
}
