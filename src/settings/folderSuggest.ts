// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { AbstractInputSuggest, App, TFolder } from "obsidian";

/**
 * Type-ahead folder suggestions for a plain text input — the same kind of
 * autocomplete Obsidian's own built-in "folder" setting control shows, which
 * the story-folder field lost when it moved off that control onto its own
 * text-plus-"Set"-button row (see `ScribeVisualizationSettingTab.renderStoryFolderField`).
 * Picking a suggestion doesn't redraw the input on its own — `onSelect`'s
 * callback needs to write the chosen folder's path back into it (and into
 * whatever else is tracking the typed value) itself. Selecting a suggestion
 * still only fills the field; it doesn't apply the change — "Set" (or Enter)
 * still does that.
 */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
	}

	protected getSuggestions(query: string): TFolder[] {
		const q = query.toLowerCase();
		return this.app.vault
			.getAllFolders()
			.filter((folder) => folder.path.toLowerCase().includes(q))
			.sort((a, b) => a.path.localeCompare(b.path));
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path);
	}
}
