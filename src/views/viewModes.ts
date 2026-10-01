// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { LineLayout, NovelEntry } from "../types";
import { OutlineReconciliation } from "../data/outline";
import { canvasModel, CanvasModel } from "./canvasModel";
import { charactersModel } from "./charactersModel";

/**
 * The modes of the StoryLines tab, described once so the view never has to ask
 * "which mode am I in?" — it reads `editable` / `buildModel` off the descriptor.
 * A new mode (places, dates, …) is one entry here plus its model function.
 * No Obsidian APIs — unit-tested.
 */

export type LineViewMode = "storylines" | "characters";

export interface ModeContext {
	entries: NovelEntry[];
	layout: LineLayout;
	recon: OutlineReconciliation;
}

export interface ViewModeDef {
	label: string;
	/**
	 * Whether the board can be edited (drag, line controls, undo, notes created
	 * from ghost cards) and persists to Lines.md. A mode that isn't editable
	 * derives its lines from the notes and writes nothing.
	 */
	editable: boolean;
	/** Shown above the board when the model has no lines; null for none. */
	emptyNotice: string | null;
	/** Heading of the strip holding cards the model couldn't place; null = the editable default. */
	unplacedLabel: string | null;
	buildModel(ctx: ModeContext): CanvasModel;
}

export const DEFAULT_VIEW_MODE: LineViewMode = "storylines";

/** Insertion order is the order of the selector's options. */
export const VIEW_MODES: Record<LineViewMode, ViewModeDef> = {
	storylines: {
		label: "StoryLines",
		editable: true,
		emptyNotice: null,
		unplacedLabel: null,
		buildModel: ({ entries, layout, recon }) => canvasModel(entries, layout, recon),
	},
	characters: {
		label: "Characters",
		editable: false,
		emptyNotice:
			"No characters found. List them in a note's scribe-note-characters frontmatter " +
			"or in the Characters column of the story outline.",
		unplacedLabel: "No characters listed",
		buildModel: ({ entries, recon }) => charactersModel(entries, recon),
	},
};

export function isViewMode(value: unknown): value is LineViewMode {
	return typeof value === "string" && Object.prototype.hasOwnProperty.call(VIEW_MODES, value);
}

/** Coerces untrusted view state (or a `<select>` value) to a known mode. */
export function parseViewMode(value: unknown): LineViewMode {
	return isViewMode(value) ? value : DEFAULT_VIEW_MODE;
}

export function viewModeIds(): LineViewMode[] {
	return Object.keys(VIEW_MODES).filter(isViewMode);
}
