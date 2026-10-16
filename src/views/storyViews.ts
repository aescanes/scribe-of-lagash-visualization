// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { LineLayout, NovelEntry } from "../types";
import { OutlineReconciliation } from "../data/outline";
import { canvasModel, CanvasModel } from "./canvasModel";
import { charactersModel } from "./charactersModel";
import { locationsModel } from "./locationsModel";
import { chronologicalModel, DateOrder } from "./chronologicalModel";
import { dateFormatHint } from "../data/dateParser";
import { CardInfoField } from "./cardInfo";
import { PlotMatrixContext, PlotMatrixModel, plotMatrixModel } from "./plotMatrixModel";

/**
 * The views of the Visualization tab (StoryLines, Characters, Locations, Chronological, Plot matrix), described
 * once so the tab never has to ask "which view am I in?" — it reads `editable` /
 * `buildModel` off the descriptor.
 * A new view is one entry here plus its model function.
 * No Obsidian APIs — unit-tested.
 */

export type StoryView = "storylines" | "plotMatrix" | "characters" | "locations" | "chronological";

export interface StoryViewContext {
	entries: NovelEntry[];
	layout: LineLayout;
	recon: OutlineReconciliation;
	/** Chronological view only: oldest first or newest first. */
	dateOrder: DateOrder;
	/** Title language, used to spell out dates on the cards. */
	language: string;
}

/** A view drawn as lines of cards (every view but Plot matrix). */
export interface StoryViewDef {
	kind: "board";
	label: string;
	/**
	 * Whether the board can be edited (drag, line controls, undo, notes created
	 * from ghost cards) and persists to Lines.md. A view that isn't editable
	 * derives its lines from the notes and writes nothing.
	 */
	editable: boolean;
	/** Info the cards leave out because the lines already say it (e.g. the Characters view lists no characters). */
	hides?: CardInfoField[];
	/** Whether the toolbar offers an oldest-first / newest-first toggle (the Chronological view). */
	hasDateOrder?: boolean;
	/** Shown above the board when the model has no lines; null for none. */
	emptyNotice: string | null;
	/** Heading of the strip holding cards the model couldn't place; null = the editable default. */
	unplacedLabel: string | null;
	buildModel(ctx: StoryViewContext): CanvasModel;
}

/**
 * The Plot matrix view: the Story Outline as a matrix. It never edits `Lines.md`
 * (`editable` is about that file); the matrix edits the Outline file itself,
 * and only when one exists — see `PlotMatrixModel.editable`.
 */
export interface PlotMatrixViewDef {
	kind: "matrix";
	label: string;
	editable: false;
	buildPlotMatrix(ctx: PlotMatrixContext): PlotMatrixModel;
}

export const DEFAULT_STORY_VIEW: StoryView = "storylines";

/** Insertion order is the order of the selector's options. */
export const STORY_VIEWS: Record<Exclude<StoryView, "plotMatrix">, StoryViewDef> & { plotMatrix: PlotMatrixViewDef } = {
	storylines: {
		kind: "board",
		label: "StoryLines",
		editable: true,
		emptyNotice: null,
		unplacedLabel: null,
		buildModel: ({ entries, layout, recon }) => canvasModel(entries, layout, recon),
	},
	plotMatrix: {
		kind: "matrix",
		label: "Plot Matrix",
		editable: false,
		buildPlotMatrix: plotMatrixModel,
	},
	characters: {
		kind: "board",
		label: "Characters",
		editable: false,
		hides: ["characters"],
		emptyNotice:
			"No characters found. List them in a note's scribe-note-characters property " +
			"or in the Characters column of the story outline.",
		unplacedLabel: "No characters listed",
		buildModel: ({ entries, recon }) => charactersModel(entries, recon),
	},
	locations: {
		kind: "board",
		label: "Locations",
		editable: false,
		hides: ["locations"],
		emptyNotice:
			"No locations found. List them in a note's scribe-note-locations property " +
			"or in the Locations column of the story outline.",
		unplacedLabel: "No locations listed",
		buildModel: ({ entries, recon }) => locationsModel(entries, recon),
	},
	chronological: {
		kind: "board",
		label: "Chronological",
		editable: false,
		hasDateOrder: true,
		emptyNotice:
			"No dated notes found. Add a scribe-note-date property to a note or a Date to " +
			`the story outline (${dateFormatHint()}).`,
		unplacedLabel: "No date",
		buildModel: ({ entries, recon, dateOrder, language }) =>
			chronologicalModel(entries, recon, dateOrder, language),
	},
};

export function isStoryView(value: unknown): value is StoryView {
	return typeof value === "string" && Object.prototype.hasOwnProperty.call(STORY_VIEWS, value);
}

/** Coerces untrusted view state (or a `<select>` value) to a known view. */
export function parseStoryView(value: unknown): StoryView {
	return isStoryView(value) ? value : DEFAULT_STORY_VIEW;
}

export function storyViewIds(): StoryView[] {
	return Object.keys(STORY_VIEWS).filter(isStoryView);
}
