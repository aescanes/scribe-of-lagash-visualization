// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

export interface ScribeVisualizationSettings {
	/**
	 * Vault-relative folder holding the story's chapter/scene notes. Notes
	 * inside are classified by title (see titleParser). Empty means scan the
	 * whole vault. One story per vault — see the "Open questions" section of
	 * `docs/feature-plans/line-view-plan.md` for why this is a single path
	 * rather than a list.
	 */
	storyFolder: string;

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
	storyFolder: "",
	lineFileName: "StoryLines.md",
	outlineFileName: "",
	titleLanguage: "en",
};
