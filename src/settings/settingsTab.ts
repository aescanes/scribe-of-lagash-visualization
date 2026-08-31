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
				"Point the plugin at the folder that holds a book's notes. Notes are " +
				"classified as chapters or scenes by their title (e.g. \"Chapter 1\", \"Scene II\").",
		});

		new Setting(containerEl)
			.setName("Book folder")
			.setDesc(
				"The folder containing the book's chapter/scene notes. " +
					"Leave empty to scan the whole vault.",
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
			.setName("Line file name")
			.setDesc("Name of the Line file created inside the book folder to store its default view.")
			.addText((text) => {
				text.setValue(this.plugin.settings.lineFileName);
				text.onChange(async (value) => {
					this.plugin.settings.lineFileName = value.trim() || "Lines.md";
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
	}
}
