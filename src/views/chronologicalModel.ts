// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { NovelEntry, PlannedEntry } from "../types";
import { OutlineReconciliation } from "../data/outline";
import { ParsedDate, dateConflict, dateFormatHint, describeElapsed, formatStoryDate, parseStoryDate, toDayNumber } from "../data/dateParser";
import { CanvasCard, CanvasGap, CanvasModel, LINE_COLOR_PALETTE, manuscriptColumns } from "./canvasModel";

/**
 * Pure model for the read-only Chronological view: every chapter/scene on one
 * derived line, ordered by its in-story date. Nothing here is saved. No
 * Obsidian APIs — unit-tested.
 */

export const CHRONOLOGICAL_LINE_ID = "chronological";

export type DateOrder = "asc" | "desc";

export const DEFAULT_DATE_ORDER: DateOrder = "asc";

/** Coerces untrusted view state to a known order. */
export function parseDateOrder(value: unknown): DateOrder {
	return value === "desc" ? "desc" : DEFAULT_DATE_ORDER;
}

/** A gap is "too big" past this many times the average gap between neighbouring dated cards. */
export const GAP_FACTOR = 2;
/** Width of a time-gap marker, in columns — narrower than a card. */
export const GAP_COLUMN_WIDTH = 0.25;
/** Two gaps are the least that makes an average worth comparing against. */
const MIN_CARDS_FOR_GAPS = 3;

interface Item {
	path: string;
	/** Manuscript column — breaks ties between equal dates. */
	column: number;
	date: ParsedDate | null;
	card: CanvasCard;
	entry: NovelEntry | null;
	planned: PlannedEntry | null;
	/** Why the card has a ⚠, shown on the card (or in the "No date" strip). */
	mark: string | null;
}

function unrecognized(text: string): string {
	return `Date "${text}" not recognized — use ${dateFormatHint()}`;
}

export function chronologicalModel(
	entries: NovelEntry[],
	plan: OutlineReconciliation,
	order: DateOrder,
	language: string,
): CanvasModel {
	const columns = manuscriptColumns(entries, plan.planned);
	const fulfilled = new Set(plan.fulfilledPaths);

	const items: Item[] = [];
	for (const entry of entries) {
		const path = entry.file.path;
		const noteText = entry.date;
		const outlineText = plan.fulfilledDates[path] ?? null;
		// A card has one date: its outline row's, falling back to the note's.
		const text = outlineText ?? noteText;
		const date = parseStoryDate(text);

		const mark = text && !date ? unrecognized(text) : dateConflict(noteText, outlineText, fulfilled.has(path));
		items.push({
			path,
			column: columns.get(path) ?? 0,
			date,
			entry,
			planned: null,
			mark,
			card: {
				kind: "real",
				entry,
				planned: null,
				x: 0,
				summary: plan.previews[path] ?? null,
				mark,
				dateLabel: date ? formatStoryDate(date, language) : null,
			},
		});
	}
	for (const p of plan.planned) {
		const text = p.row.date;
		const date = parseStoryDate(text);
		const mark = text && !date ? unrecognized(text) : null;
		items.push({
			path: p.expectedPath,
			column: columns.get(p.expectedPath) ?? 0,
			date,
			entry: null,
			planned: p,
			mark,
			card: {
				kind: "planned",
				entry: null,
				planned: p,
				x: 0,
				summary: p.row.summary || null,
				mark,
				dateLabel: date ? formatStoryDate(date, language) : null,
			},
		});
	}

	const dated: Item[] = [];
	const unplaced: NovelEntry[] = [];
	const plannedUnplaced: PlannedEntry[] = [];
	const unplacedMarks: Record<string, string> = {};
	for (const item of items) {
		if (item.date) {
			dated.push(item);
			continue;
		}
		if (item.entry) unplaced.push(item.entry);
		else if (item.planned) plannedUnplaced.push(item.planned);
		if (item.mark) unplacedMarks[item.path] = item.mark;
	}
	// The strip keeps manuscript order, whatever the sort direction.
	unplaced.sort((a, b) => (columns.get(a.file.path) ?? 0) - (columns.get(b.file.path) ?? 0));
	plannedUnplaced.sort(
		(a, b) => (columns.get(a.expectedPath) ?? 0) - (columns.get(b.expectedPath) ?? 0),
	);

	const sign = order === "desc" ? -1 : 1;
	dated.sort((a, b) => sign * ((a.date?.key ?? 0) - (b.date?.key ?? 0)) || a.column - b.column);

	// Each marker takes a slice of the axis, so the cards after it shift over.
	const days = dated.map((item) => toDayNumber(item.date as ParsedDate));
	const spans = days.slice(1).map((d, i) => Math.abs(d - days[i]));
	const limit =
		dated.length >= MIN_CARDS_FOR_GAPS ? GAP_FACTOR * (spans.reduce((a, b) => a + b, 0) / spans.length) : Infinity;
	const gaps: CanvasGap[] = [];
	let column = 0;
	const cards = dated.map((item, i) => {
		if (i > 0 && spans[i - 1] > limit) {
			gaps.push({ x: column, width: GAP_COLUMN_WIDTH, label: describeElapsed(spans[i - 1], language) });
			column += GAP_COLUMN_WIDTH;
		}
		return { ...item.card, x: column++ };
	});

	return {
		lines:
			cards.length === 0
				? []
				: [
					{
						def: { id: CHRONOLOGICAL_LINE_ID, name: "Chronological", color: LINE_COLOR_PALETTE[0], order: 0 },
						cards,
						gaps,
					},
				],
		unplaced,
		plannedUnplaced,
		unplacedMarks,
		columnCount: Math.max(1, column),
	};
}
