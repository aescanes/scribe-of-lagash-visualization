// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { App, PluginSettingTab, Setting } from "obsidian";
import type ScribeVisualizationPlugin from "../main";
import { availableLanguages, languageLabel } from "../data/titleParser";

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
				"Point the plugin at the folder that hold each book's notes. Notes are " +
				"classified as chapters or scenes by their title (e.g. \"Chapter 1\", \"Scene II\"). " +
				"Add a scribe-visualization-type frontmatter field (\"chapter\" or \"scene\") to " +
				"override the title for a specific note.",
		});

		new Setting(containerEl)
			.setName("Book folder")
			.setDesc(
				"Add here the folder containing the book's chapter/scene notes. " +
					"Leave empty to scan the whole vault for frontmatter-tagged notes instead.",
			)
			.addText((text) => {
				text.setPlaceholder("Novels/The Silent City");
				text.setValue(this.plugin.settings.bookFolders.join("\n"));
				text.onChange(async (value) => {
					this.plugin.settings.bookFolders = value
						.split("\n")
						.map((line) => line.trim())
						.filter(Boolean);
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Timeline file name")
			.setDesc("Name of the companion file created inside each book folder to store the timeline layout.")
			.addText((text) => {
				text.setValue(this.plugin.settings.timelineFileName);
				text.onChange(async (value) => {
					this.plugin.settings.timelineFileName = value.trim() || "Timelines.md";
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Title language")
			.setDesc("Which language's patterns to use when reading chapter/scene numbers from note titles.")
			.addDropdown((dropdown) => {
				for (const lang of availableLanguages()) dropdown.addOption(lang, languageLabel(lang));
				dropdown.setValue(this.plugin.settings.titleLanguage);
				dropdown.onChange(async (value) => {
					this.plugin.settings.titleLanguage = value;
					await this.plugin.saveSettings();
				});
			});

		const timelineNames = this.plugin.vaultIndex.getTimelineNames();

		new Setting(containerEl)
			.setName("Default timeline")
			.setDesc(
				"Which scribe-visualization-timelines value to show when the Timeline view opens. " +
					"Leave blank to show every entry regardless of timeline.",
			)
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
