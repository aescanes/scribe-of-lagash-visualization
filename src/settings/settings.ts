// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

export interface ScribeVisualizationSettings {
	/**
	 * Vault-relative folders that each hold one book's chapter/scene notes.
	 * Notes inside are classified by title (see titleParser). When empty, the
	 * plugin falls back to scanning the whole vault for frontmatter-tagged notes.
	 */
	bookFolders: string[];

	/**
	 * Name of the per-book Lines file that stores the default view. The plugin
	 * prefixes it with "(SL) " on disk (see `withScribePrefix`).
	 */
	lineFileName: string;

	/**
	 * Name of the optional per-book Outline file — a hand-edited table planning
	 * chapters/scenes ahead of the notes. Empty means the feature is off; naming
	 * a file that doesn't exist yet creates it with an empty table skeleton whose
	 * header comment explains which columns to fill for each book layout (see
	 * `ensureOutlineFile`). The plugin prefixes it with "(SL) " on disk (see
	 * `withScribePrefix`).
	 */
	outlineFileName: string;

	/** Language pattern table used to parse note titles. */
	titleLanguage: string;
}

export const DEFAULT_SETTINGS: ScribeVisualizationSettings = {
	bookFolders: [],
	lineFileName: "StoryLines.md",
	outlineFileName: "",
	titleLanguage: "en",
};
