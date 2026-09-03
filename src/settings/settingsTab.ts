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

		containerEl.createEl("p", {
			text:
				"Point the plugin at the folder that holds a book's notes. Notes are " +
				"classified as acts, chapters or scenes by their title (e.g. \"Act 1\", \"Chapter 1\", \"Scene II\"); " +
				"their manuscript order comes from the folder structure.",
		});
		containerEl.createEl("p", {
			text:
				"A chapter/scene can be a " +
				"single note or a folder — pick one style per book, don't mix them. " +
				"See the plugin's README for the supported layouts.",
		});

		new Setting(containerEl)
			.setName("Book folder")
			.setDesc(
				"The folder containing the book's act/chapter/scene notes. " +
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
			.setName("StoryLines file name")
			.setDesc(
				"Name of the StoryLines file created inside the book folder to store its default view. " +
					'The plugin prefixes it with "(SL) " so it stands out — e.g. "StoryLines" ' +
					'becomes "(SL) StoryLines.md".',
			)
			.addText((text) => {
				text.setPlaceholder("StoryLines.md");
				text.setValue(this.plugin.settings.lineFileName);
				text.onChange(async (value) => {
					this.plugin.settings.lineFileName = value.trim();
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Story Outline file name")
			.setDesc(
				createFragment((frag) => {
					frag.appendText(
						"Optional. Name a Markdown file (including the .md extension) to plan chapters/scenes as a table before " +
							"the notes exist (columns: Act, Chapter, Scene, Line, Synopsis, …).",
					);
					frag.createEl("br");
					frag.createEl("br");
					frag.appendText(
						"The plugin creates an empty file with a guide below the table " +
							"explaining which columns to fill for each book layout. Leave empty to turn this off. The " +
							"file is prefixed with \"(SL) \", e.g. \"Story Outline\" becomes \"(SL) Story Outline.md\".",
					);
				}),
			)
			.addText((text) => {
				text.setValue(this.plugin.settings.outlineFileName);
				text.onChange(async (value) => {
					this.plugin.settings.outlineFileName = value.trim();
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Title / Folder language")
			.setDesc("Which language's patterns to use when reading act/chapter/scene numbers from note titles and folders.")
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
