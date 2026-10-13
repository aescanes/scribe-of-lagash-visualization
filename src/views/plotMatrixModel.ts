// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { EntryType, LineLayout, NovelEntry, OutlineRow } from "../types";
import { OutlineReconciliation, outlineRowNumber, outlineRowText, outlineRowType } from "../data/outline";
import { outlineUnitsOf } from "../data/outlineGenerate";
import { displayDate, parseStoryDate } from "../data/dateParser";
import { checkStatus } from "../data/outlineStatus";
import { actLabel, unitLabel } from "../data/titleParser";

/**
 * Render model of the Plot matrix view: the Story Outline as a matrix, one row per
 * outline row. With no Outline file the rows come from the notes instead and
 * the matrix is read-only. Pure, unit-tested; no Obsidian APIs.
 */

export type PlotMatrixMode = "outline" | "notes";

export interface PlotMatrixRowTarget {
	rowIndex: number;
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
	/** ⚠ text from the reconciliation, or null. */
	mark: string | null;
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

function outlineRows(ctx: PlotMatrixContext, colorOf: (ref: string) => string | null): PlotMatrixRow[] {
	const plannedByRow = new Map(ctx.recon.planned.map((p) => [p.row.rowIndex, p]));
	return ctx.outlineRows.map((row) => {
		const path = ctx.recon.rowPaths[row.rowIndex] ?? null;
		const planned = plannedByRow.get(row.rowIndex) ?? null;
		const key = path ?? planned?.expectedPath ?? `row ${row.rowIndex}`;
		return {
			key,
			type: outlineRowType(row),
			act: row.act,
			actLabel: row.act ? `${actLabel(ctx.language)} ${row.act}` : null,
			chapterText: row.chapterText,
			sceneText: row.sceneText,
			unit: outlineRowUnit(row, ctx.language) || `${unitLabel(outlineRowType(row), ctx.language)} ${outlineRowText(row) ?? outlineRowNumber(row)}`,
			path,
			ghost: path === null,
			line: row.line ?? "",
			lineColor: row.line ? colorOf(row.line) : null,
			synopsis: row.summary,
			characters: row.characters,
			locations: row.locations,
			...dateFields(row.date ?? "", ctx.language),
			...statusFields(row.status ?? ""),
			comments: row.comments ?? "",
			mark: ctx.recon.marks[key] ?? null,
			target: { rowIndex: row.rowIndex, chapterText: row.chapterText, sceneText: row.sceneText },
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
			line: lineName,
			lineColor: lineName ? colorOf(lineName) : null,
			synopsis: entry.excerpt ?? "",
			characters: entry.characters,
			locations: entry.locations,
			...dateFields(entry.date ?? "", ctx.language),
			...statusFields(entry.status ?? ""),
			comments: "",
			mark: ctx.recon.marks[entry.file.path] ?? null,
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
