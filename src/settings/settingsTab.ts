// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { App, Notice, PluginSettingTab, Setting, SettingDefinitionItem } from "obsidian";
import type ScribeVisualizationPlugin from "../main";
import { availableLanguages, languageLabel } from "../data/titleParser";

/** One settings row: shared between the declarative (Obsidian 1.13+) and imperative (fallback) render paths. */
interface SettingRow {
	name: string;
	desc: string | DocumentFragment;
	render: (setting: Setting) => void;
}

const INTRO_NAME = "How this plugin works";

/**
 * Fresh `DocumentFragment` each call — a fragment's children move into the DOM
 * on insertion, emptying it, so the same instance can't be reused across the
 * two render paths (or across repeated opens of the tab).
 */
function introDesc(): DocumentFragment {
	return createFragment((frag) => {
		frag.appendText(
			"Point the plugin at the folder that holds a book's notes. Notes are " +
				'classified as acts, chapters or scenes by their title (e.g. "Act 1", "Chapter 1", "Scene II"); ' +
				"their manuscript order comes from the folder structure.",
		);
		frag.createEl("br");
		frag.createEl("br");
		frag.appendText(
			"A chapter/scene can be a single note or a folder — pick one style per book, don't mix them. " +
				"See the plugin's README for the supported layouts.",
		);
	});
}

export class ScribeVisualizationSettingTab extends PluginSettingTab {
	plugin: ScribeVisualizationPlugin;

	constructor(app: App, plugin: ScribeVisualizationPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private settingRows(): SettingRow[] {
		return [
			{
				name: "Book folder",
				desc: "The folder containing the book's act/chapter/scene notes. Leave empty to scan the whole vault.",
				render: (setting) => {
					setting.addText((text) => {
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
				},
			},
			{
				name: "StoryLines file name",
				desc:
					"Name of the file created inside the book folder to store its default view. " +
					'The ".md" extension is optional and the plugin prefixes the name with "(SL) " so it ' +
					'stands out — "StoryLines" and "StoryLines.md" both become "(SL) StoryLines.md". ' +
					"The file is created automatically when you first open the StoryLines view for a book.",
				render: (setting) => {
					setting.addText((text) => {
						text.setPlaceholder("StoryLines");
						text.setValue(this.plugin.settings.lineFileName);
						text.onChange(async (value) => {
							this.plugin.settings.lineFileName = value.trim();
							await this.plugin.saveSettings();
						});
					});
				},
			},
			{
				name: "Story Outline file name",
				desc: createFragment((frag) => {
					frag.appendText(
						"Optional. Name a file to plan chapters/scenes as a table before the notes exist " +
							"(columns: Act, Chapter, Scene, Line, Synopsis, …). Leave empty to turn this off. " +
							'The ".md" is optional — "Outline" and "Outline.md" both become "(SL) Outline.md".',
					);
				}),
				render: (setting) => {
					setting
						.addText((text) => {
							text.setPlaceholder("Story Outline");
							text.setValue(this.plugin.settings.outlineFileName);
							text.onChange(async (value) => {
								this.plugin.settings.outlineFileName = value.trim();
								await this.plugin.saveSettings();
							});
						})
						.addButton((button) => {
							button.setButtonText("Create");
							button.onClick(async () => {
								if (!this.plugin.settings.outlineFileName) {
									new Notice("Enter a Story Outline file name first.");
									return;
								}
								const created = await this.plugin.createOutlineFiles();
								new Notice(
									created > 0
										? `Created ${created} Story Outline file${created === 1 ? "" : "s"}.`
										: "The Story Outline file already exists — left it untouched.",
								);
							});
						});
				},
			},
			{
				name: "Title / Folder language",
				desc: "Which language's patterns to use when reading act/chapter/scene numbers from note titles and folders.",
				render: (setting) => {
					setting.addDropdown((dropdown) => {
						for (const lang of availableLanguages()) dropdown.addOption(lang, languageLabel(lang));
						dropdown.setValue(this.plugin.settings.titleLanguage);
						dropdown.onChange(async (value) => {
							this.plugin.settings.titleLanguage = value;
							await this.plugin.saveSettings();
						});
					});
				},
			},
		];
	}

	/**
	 * Declarative settings (Obsidian 1.13+): makes this tab's settings show up in
	 * Obsidian's global settings search. When this returns a non-empty array,
	 * Obsidian renders from it directly and never calls `display()`; on older
	 * Obsidian versions this method doesn't exist yet, so `display()` below
	 * still drives rendering unchanged. Both paths share `settingRows()` so a
	 * row's behavior can't drift between the two.
	 */
	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{ name: INTRO_NAME, desc: introDesc() },
			...this.settingRows().map(({ name, desc, render }) => ({ name, desc, render })),
		];
	}

	/** @deprecated Fallback for Obsidian < 1.13.0; see `getSettingDefinitions()`. */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.appendChild(introDesc());

		for (const { name, desc, render } of this.settingRows()) {
			render(new Setting(containerEl).setName(name).setDesc(desc));
		}
	}
}
