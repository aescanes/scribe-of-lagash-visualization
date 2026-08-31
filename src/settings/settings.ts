// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

export interface ScribeVisualizationSettings {
	/**
	 * Vault-relative folders that each hold one book's chapter/scene notes.
	 * Notes inside are classified by title (see titleParser). When empty, the
	 * plugin falls back to scanning the whole vault for frontmatter-tagged notes.
	 */
	bookFolders: string[];

	/** Name of the per-book Line file that stores the default view. */
	lineFileName: string;

	/** Language pattern table used to parse note titles. */
	titleLanguage: string;
}

export const DEFAULT_SETTINGS: ScribeVisualizationSettings = {
	bookFolders: [],
	lineFileName: "Lines.md",
	titleLanguage: "en",
};
