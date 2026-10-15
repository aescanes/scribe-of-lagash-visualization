// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { EntryType, LineLayout, NovelEntry, OutlineRow } from "../types";
import { OutlineReconciliation, outlineRowType } from "../data/outline";
import { outlineUnitsOf } from "../data/outlineGenerate";
import { dateConflict, displayDate, parseStoryDate } from "../data/dateParser";
import { checkStatus } from "../data/outlineStatus";
import { mergeSources } from "./derivedLines";
import { actLabel, unitLabel } from "../data/titleParser";

/**
 * Render model of the Plot matrix view: the Story Outline as a matrix, one row per
 * outline row. With no Outline file the rows come from the notes instead and
 * the matrix is read-only. Pure, unit-tested; no Obsidian APIs.
 */

export type PlotMatrixMode = "outline" | "notes";

export interface PlotMatrixRowTarget {
	/** Index of the row's line in the outline file's body: where an edit lands. */
	lineIndex: number;
	chapterText: string | null;
	sceneText: string | null;
}

export interface PlotMatrixRow {
	/** Stable key: the note's path, or a ghost row's expected path. */
	key: string;
	type: EntryType;
	/** The outline row's raw Act / Chapter / Scene cells (the editors' values); null in notes mode. */
	act: string | null;
	/** The Act as shown, with its word ("Act I" / "Acto I"); in notes mode the folder name as it is. */
	actLabel: string | null;
	chapterText: string | null;
	sceneText: string | null;
	/** Display text of the Act / Chapter / Scene square, e.g. "Chapter 1 › Scene 2". */
	unit: string;
	/** Path of the real note this row stands for, to open it; null for a ghost row. */
	path: string | null;
	ghost: boolean;
	/** A table row with no Chapter or Scene yet: nothing to create until the writer numbers it. */
	blank: boolean;
	/** The `Line` cell's text, and the color of the line it names (null when unknown). */
	line: string;
	lineColor: string | null;
	synopsis: string;
	characters: string[];
	locations: string[];
	/** The raw `Date` cell, its readable form, and whether it failed to parse. */
	date: string;
	dateLabel: string | null;
	dateInvalid: boolean;
	/** The raw `Status` cell. `statusInvalid` when it is neither empty nor one of the offered statuses. */
	status: string;
	statusLabel: string;
	statusInvalid: boolean;
	comments: string;
	/** ⚠ text about the Act / Chapter / Scene square (folder, type, duplicate title), or null. */
	mark: string | null;
	/**
	 * ⚠ texts shown in the cell they are about: the line named but unknown or
	 * placed elsewhere, and a property of the real note that disagrees with this
	 * row. Empty in notes mode, which has no outline to disagree with.
	 */
	cellMarks: Partial<Record<"Line" | "Characters" | "Locations" | "Date" | "Status", string>>;
	/** What a cell edit needs to find this row; null when the row can't be edited (notes mode). */
	target: PlotMatrixRowTarget | null;
}

export interface PlotMatrixModel {
	mode: PlotMatrixMode;
	/** Only the outline-backed matrix can be edited. */
	editable: boolean;
	/** The lines of Lines.md, for the Line column's picker. */
	lines: { name: string; color: string }[];
	rows: PlotMatrixRow[];
}

export interface PlotMatrixContext {
	entries: NovelEntry[];
	layout: LineLayout;
	recon: OutlineReconciliation;
	outlineRows: OutlineRow[];
	/** Table rows with no Chapter or Scene (`scanOutlineTable`'s `blanks`), shown so they can be filled in. */
	blankRows: OutlineRow[];
	/** Whether the Outline file exists (it may still have no rows). */
	outlineExists: boolean;
	language: string;
}

function dateFields(raw: string, language: string): Pick<PlotMatrixRow, "date" | "dateLabel" | "dateInvalid"> {
	const trimmed = raw.trim();
	return {
		date: trimmed,
		dateLabel: displayDate(trimmed, language),
		dateInvalid: trimmed !== "" && parseStoryDate(trimmed) === null,
	};
}

function statusFields(raw: string): Pick<PlotMatrixRow, "status" | "statusLabel" | "statusInvalid"> {
	const check = checkStatus(raw);
	return {
		status: raw.trim(),
		statusLabel: check.kind === "known" ? check.status : raw.trim(),
		statusInvalid: check.kind === "unknown",
	};
}

function lineResolver(layout: LineLayout): (ref: string) => string | null {
	const colorByRef = new Map<string, string>();
	for (const line of layout.lines) {
		colorByRef.set(line.id.toLowerCase(), line.color);
		colorByRef.set(line.name.toLowerCase(), line.color);
	}
	return (ref) => colorByRef.get(ref.trim().toLowerCase()) ?? null;
}

function outlineRowUnit(row: OutlineRow, language: string): string {
	const parts: string[] = [];
	if (row.chapter !== null) parts.push(`${unitLabel("chapter", language)} ${row.chapterText ?? row.chapter}`);
	if (row.scene !== null) parts.push(`${unitLabel("scene", language)} ${row.sceneText ?? row.scene}`);
	return parts.join(" › ");
}

/** How a real note's properties disagree with its outline row, one text per cell that does. */
function propertyMarks(row: OutlineRow, entry: NovelEntry): PlotMatrixRow["cellMarks"] {
	const marks: PlotMatrixRow["cellMarks"] = {};
	const characters = mergeSources(entry.characters, row.characters, "characters", true).conflict;
	if (characters) marks.Characters = characters;
	const locations = mergeSources(entry.locations, row.locations, "locations", true).conflict;
	if (locations) marks.Locations = locations;
	const date = dateConflict(entry.date, row.date, true);
	if (date) marks.Date = date;

	const note = entry.status?.trim() ?? "";
	const outline = row.status?.trim() ?? "";
	if (note && !outline) {
		marks.Status = `status differs between the note and the story outline (note: ${note}; story outline: empty)`;
	} else if (note && outline && note.toLowerCase() !== outline.toLowerCase()) {
		marks.Status = `status differs between the note and the story outline (note: ${note}; story outline: ${outline})`;
	}
	return marks;
}

function outlineRows(ctx: PlotMatrixContext, colorOf: (ref: string) => string | null): PlotMatrixRow[] {
	const plannedByRow = new Map(ctx.recon.planned.map((p) => [p.row.rowIndex, p]));
	const entryByPath = new Map(ctx.entries.map((e) => [e.file.path, e]));
	const ordered = [...ctx.outlineRows, ...ctx.blankRows].sort((a, b) => (a.sourceLine ?? 0) - (b.sourceLine ?? 0));
	return ordered.map((row) => {
		const blank = row.chapter === null && row.scene === null;
		const path = blank ? null : ctx.recon.rowPaths[row.rowIndex] ?? null;
		const entry = path ? entryByPath.get(path) ?? null : null;
		const planned = plannedByRow.get(row.rowIndex) ?? null;
		const key = blank ? `blank ${row.sourceLine}` : path ?? planned?.expectedPath ?? `row ${row.rowIndex}`;
		return {
			key,
			type: outlineRowType(row),
			act: row.act,
			actLabel: row.act ? `${actLabel(ctx.language)} ${row.act}` : null,
			chapterText: row.chapterText,
			sceneText: row.sceneText,
			unit: blank ? "" : outlineRowUnit(row, ctx.language),
			path,
			ghost: path === null,
			blank,
			line: row.line ?? "",
			lineColor: row.line ? colorOf(row.line) : null,
			synopsis: row.summary,
			characters: row.characters,
			locations: row.locations,
			...dateFields(row.date ?? "", ctx.language),
			...statusFields(row.status ?? ""),
			comments: row.comments ?? "",
			mark: ctx.recon.unitMarks[key] ?? null,
			cellMarks: {
				...(entry ? propertyMarks(row, entry) : {}),
				...(ctx.recon.lineMarks[key] ? { Line: ctx.recon.lineMarks[key] } : {}),
			},
			target: { lineIndex: row.sourceLine ?? -1, chapterText: row.chapterText, sceneText: row.sceneText },
		};
	});
}

function noteRows(ctx: PlotMatrixContext, colorOf: (ref: string) => string | null): PlotMatrixRow[] {
	const lineById = new Map(ctx.layout.lines.map((l) => [l.id, l]));
	return ctx.entries.map((entry) => {
		const { chapterFolder, outerFolders } = outlineUnitsOf(entry, ctx.language);
		const placed = ctx.layout.placements[entry.file.path]?.lines[0];
		const lineName = placed ? lineById.get(placed)?.name ?? "" : "";
		return {
			key: entry.file.path,
			type: entry.type,
			act: outerFolders.length > 0 ? outerFolders.join("/") : null,
			actLabel: outerFolders.length > 0 ? outerFolders.join("/") : null,
			chapterText: null,
			sceneText: null,
			unit: chapterFolder ? `${chapterFolder} › ${entry.title}` : entry.title,
			path: entry.file.path,
			ghost: false,
			blank: false,
			line: lineName,
			lineColor: lineName ? colorOf(lineName) : null,
			synopsis: entry.excerpt ?? "",
			characters: entry.characters,
			locations: entry.locations,
			...dateFields(entry.date ?? "", ctx.language),
			...statusFields(entry.status ?? ""),
			comments: "",
			mark: ctx.recon.marks[entry.file.path] ?? null,
			cellMarks: {},
			target: null,
		};
	});
}

export function plotMatrixModel(ctx: PlotMatrixContext): PlotMatrixModel {
	const colorOf = lineResolver(ctx.layout);
	const lines = [...ctx.layout.lines].sort((a, b) => a.order - b.order).map(({ name, color }) => ({ name, color }));
	if (ctx.outlineExists) return { mode: "outline", editable: true, lines, rows: outlineRows(ctx, colorOf) };
	return { mode: "notes", editable: false, lines, rows: noteRows(ctx, colorOf) };
}
