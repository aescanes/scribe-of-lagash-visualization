// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { setIcon } from "obsidian";
import { dateFormatHint } from "../data/dateParser";
import { OutlineColumn } from "../data/outlineEdit";
import { NO_STATUS, OUTLINE_STATUSES, statusHint } from "../data/outlineStatus";
import { FRONTMATTER_KEYS } from "../types";
import { PlotMatrixModel, PlotMatrixRow } from "./plotMatrixModel";

/**
 * DOM for the Plot matrix. Builds nodes from a `PlotMatrixModel` and reports
 * edits through callbacks; it holds no state and writes nothing itself.
 */

export interface PlotMatrixCallbacks {
	/** Opens the real note behind a row. */
	openNote(path: string): void;
	/** Writes one cell of the Outline table; the caller re-renders afterwards. */
	editCell(row: PlotMatrixRow, column: OutlineColumn, value: string): Promise<void>;
	addRow(): Promise<void>;
}

/** How the notes' frontmatter keys are written in prose; shown as code, so not UI text to case. */
const NOTE_KEYS_PATTERN = "scribe-note-*";

/** Columns after the first (Act / Chapter / Scene), in matrix order. */
const FIELD_COLUMNS = ["Line", "Synopsis", "Characters", "Locations", "Date", "Status", "Comments"] as const;
type FieldColumn = (typeof FIELD_COLUMNS)[number];

/** One short line under each column title: what goes there and, where it is a closed set, the values. */
const COLUMN_HINTS: Record<"Act / Chapter / Scene" | FieldColumn, string> = {
	"Act / Chapter / Scene": "Where the row sits. Chapter and Scene start with a number (3, IV).",
	Line: "Pick one of your StoryLines lines.",
	Synopsis: "Brief summary or general overview of the main points.",
	Characters: "Names separated by commas.",
	Locations: "Places separated by commas.",
	Date: "2026-11-03, November 2026, November 3, 2026…",
	Status: `${[NO_STATUS, ...OUTLINE_STATUSES].join(", ")}.`,
	Comments: "Your own remarks. Never copied to a note.",
};

/** Lucide icon beside each column title; characters, locations and date match the cards'. */
const COLUMN_ICONS: Record<keyof typeof COLUMN_HINTS, string> = {
	"Act / Chapter / Scene": "book-open",
	Line: "route",
	Synopsis: "text",
	Characters: "users",
	Locations: "map-pin",
	Date: "calendar",
	Status: "list-checks",
	Comments: "message-square",
};

/** The note property each column reads when the matrix is built from the notes. */
const NOTE_PROPERTIES: Partial<Record<FieldColumn, string>> = {
	Characters: FRONTMATTER_KEYS.characters,
	Locations: FRONTMATTER_KEYS.locations,
	Date: FRONTMATTER_KEYS.date,
	Status: FRONTMATTER_KEYS.status,
};

/** Read-only, the synopsis is the note's own first paragraph rather than something typed here. */
const READ_ONLY_SYNOPSIS_HINT = "First paragraph of the note.";

/** Comments live only in the outline table, so a notes-only matrix has nowhere to read them from. */
function visibleColumns(model: PlotMatrixModel): readonly FieldColumn[] {
	return model.editable ? FIELD_COLUMNS : FIELD_COLUMNS.filter((c) => c !== "Comments");
}

const MULTILINE: ReadonlySet<FieldColumn> = new Set(["Synopsis", "Comments"]);

function rawValue(row: PlotMatrixRow, column: FieldColumn): string {
	switch (column) {
		case "Line":
			return row.line;
		case "Synopsis":
			return row.synopsis;
		case "Characters":
			return row.characters.join(", ");
		case "Locations":
			return row.locations.join(", ");
		case "Date":
			return row.date;
		case "Status":
			return row.status;
		case "Comments":
			return row.comments;
	}
}

export function renderPlotMatrix(parent: HTMLElement, model: PlotMatrixModel, cb: PlotMatrixCallbacks): void {
	if (!model.editable) {
		const notice = parent.createDiv({ cls: "scribe-canvas-notice" });
		notice.appendText("Read-only: built from your notes and properties ");
		notice.createEl("code", { text: NOTE_KEYS_PATTERN });
		notice.appendText(".");
		notice.createDiv({ cls: "scribe-canvas-notice-spacer" });
		notice.append("Create a Story Outline file in the plugin settings and create it to edit this matrix.")
	}

	const scroll = parent.createDiv({ cls: "scribe-canvas-scroll scribe-plot-matrix-scroll" });
	const grid = scroll.createDiv({ cls: "scribe-plot-matrix-grid" });

	grid.toggleClass("is-readonly", !model.editable);
	const columns = visibleColumns(model);
	for (const title of ["Act / Chapter / Scene", ...columns] as const) {
		const head = grid.createDiv({ cls: "scribe-plot-matrix-head" });
		const heading = head.createDiv({ cls: "scribe-plot-matrix-head-title" });
		setIcon(heading.createSpan({ cls: "scribe-plot-matrix-head-icon" }), COLUMN_ICONS[title]);
		heading.createSpan({ text: title });
		head.createDiv({
			cls: "scribe-plot-matrix-head-hint",
			text: title === "Synopsis" && !model.editable ? READ_ONLY_SYNOPSIS_HINT : COLUMN_HINTS[title],
		});
		const property = model.editable || title === "Act / Chapter / Scene" ? undefined : NOTE_PROPERTIES[title];
		if (property) {
			const source = head.createDiv({ cls: "scribe-plot-matrix-head-hint" });
			source.createEl("code", { text: property });
		}
	}

	if (model.rows.length === 0) {
		parent.createDiv({
			cls: "scribe-canvas-notice",
			text: "The story outline has no rows yet.",
		});
	}

	let lastAct: string | null = null;
	for (const row of model.rows) {
		if (row.actLabel && row.actLabel !== lastAct) {
			grid.createDiv({ cls: "scribe-plot-matrix-act", text: row.actLabel });
		}
		lastAct = row.actLabel;
		renderRow(grid, row, model, cb);
	}

	if (model.editable) {
		const add = parent.createDiv({ cls: "scribe-plot-matrix-add" });
		const button = add.createEl("button", { text: "Add row" });
		button.addEventListener("click", () => void cb.addRow());
	}
}

function renderRow(grid: HTMLElement, row: PlotMatrixRow, model: PlotMatrixModel, cb: PlotMatrixCallbacks): void {
	const unit = grid.createDiv({
		cls: `scribe-plot-matrix-cell scribe-plot-matrix-unit scribe-plot-matrix-unit--${row.type}${row.ghost ? " is-planned" : ""}`,
	});
	if (row.lineColor) unit.style.setProperty("--scribe-line-color", row.lineColor);
	renderUnit(unit, row, model.editable, cb);

	for (const column of visibleColumns(model)) {
		const cell = grid.createDiv({
			cls: `scribe-plot-matrix-cell${row.ghost ? " is-planned" : ""}${model.editable ? " is-editable" : ""}`,
		});
		renderValue(cell, row, column);
		if (model.editable) {
			cell.addEventListener("click", () => {
				if (cell.hasClass("is-editing")) return;
				startEdit(cell, row, column, model, cb);
			});
		}
	}
}

function renderUnit(unit: HTMLElement, row: PlotMatrixRow, editable: boolean, cb: PlotMatrixCallbacks): void {
	unit.empty();
	if (row.actLabel) unit.createDiv({ cls: "scribe-plot-matrix-unit-act", text: row.actLabel });

	const titleRow = unit.createDiv({ cls: "scribe-plot-matrix-unit-title-row" });
	const title = titleRow.createDiv({ cls: "scribe-plot-matrix-unit-title", text: row.unit });
	if (row.path) {
		const path = row.path;
		title.addClass("is-link");
		title.addEventListener("click", () => cb.openNote(path));
	}
	if (row.mark) {
		titleRow.createSpan({ cls: "scribe-canvas-card-mark", text: "⚠", attr: { "aria-label": row.mark } });
	}
	if (row.ghost && editable) unit.createDiv({ cls: "scribe-plot-matrix-unit-note", text: "No note yet" });

	if (editable && row.target) {
		const edit = unit.createEl("button", { cls: "scribe-plot-matrix-unit-edit clickable-icon", attr: { "aria-label": "Edit act, chapter and scene" } });
		setIcon(edit, "pencil");
		edit.addEventListener("click", (e) => {
			e.stopPropagation();
			startUnitEdit(unit, row, cb);
		});
	}
}

function renderValue(cell: HTMLElement, row: PlotMatrixRow, column: FieldColumn): void {
	cell.empty();
	const raw = rawValue(row, column);

	if (column === "Line") {
		if (raw) {
			const chip = cell.createDiv({ cls: "scribe-plot-matrix-line" });
			chip.createSpan({ cls: "scribe-plot-matrix-line-dot" }).style.setProperty("--scribe-line-color", row.lineColor ?? "var(--text-faint)");
			chip.createSpan({ text: raw });
			if (!row.lineColor) chip.addClass("is-unknown");
		}
		return;
	}
	if (column === "Characters" || column === "Locations") {
		const items = column === "Characters" ? row.characters : row.locations;
		const chips = cell.createDiv({ cls: "scribe-plot-matrix-chips" });
		for (const item of items) chips.createSpan({ cls: "scribe-plot-matrix-chip", text: item });
		return;
	}
	if (column === "Date") {
		if (!raw) return;
		const text = cell.createDiv({ cls: "scribe-plot-matrix-text", text: row.dateLabel ?? raw });
		if (row.dateInvalid) {
			text.createSpan({ cls: "scribe-canvas-card-mark", text: " ⚠", attr: { "aria-label": `Not a recognized date. Use ${dateFormatHint()}.` } });
		}
		return;
	}
	if (column === "Status") {
		if (!raw) return;
		const text = cell.createDiv({ cls: "scribe-plot-matrix-text", text: row.statusLabel });
		if (row.statusInvalid) {
			text.createSpan({
				cls: "scribe-canvas-card-mark",
				text: " ⚠",
				attr: { "aria-label": `Not a recognized status. Use ${statusHint()}.` },
			});
		}
		return;
	}
	if (raw) cell.createDiv({ cls: "scribe-plot-matrix-text", text: raw });
}

/** Swaps a cell's content for an input; Enter / blur commits, Escape reverts. */
function startEdit(cell: HTMLElement, row: PlotMatrixRow, column: FieldColumn, model: PlotMatrixModel, cb: PlotMatrixCallbacks): void {
	const original = rawValue(row, column);
	cell.addClass("is-editing");
	cell.empty();

	let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
	if (column === "Line" || column === "Status") {
		const select = cell.createEl("select", { cls: "dropdown scribe-plot-matrix-input" });
		if (column === "Line") {
			select.createEl("option", { value: "", text: "None" });
			const names = model.lines.map((l) => l.name);
			if (original && !names.includes(original)) names.push(original);
			for (const name of names) select.createEl("option", { value: name, text: name });
			select.value = original;
		} else {
			// A value outside the list stays as written until the user picks one.
			select.createEl("option", { value: "", text: NO_STATUS });
			for (const status of OUTLINE_STATUSES) select.createEl("option", { value: status, text: status });
			select.value = row.statusInvalid ? "" : row.statusLabel;
		}
		input = select;
	} else if (MULTILINE.has(column)) {
		const area = cell.createEl("textarea", { cls: "scribe-plot-matrix-input" });
		area.value = original;
		input = area;
	} else {
		const text = cell.createEl("input", { type: "text", cls: "scribe-plot-matrix-input" });
		text.value = original;
		if (column === "Date") text.placeholder = "2026-11-03";
		if (column === "Characters" || column === "Locations") text.placeholder = "Separate with commas";
		input = text;
	}
	input.focus();

	let done = false;
	const finish = (commit: boolean): void => {
		if (done) return;
		done = true;
		cell.removeClass("is-editing");
		if (commit && input.value !== original) {
			void cb.editCell(row, column, input.value);
		}
		renderValue(cell, row, column);
	};

	const target: HTMLElement = input;
	// A picker commits when a choice is made; losing focus must not rewrite a value it never offered.
	if (input instanceof HTMLSelectElement) {
		input.addEventListener("change", () => finish(true));
		target.addEventListener("blur", () => finish(false));
	} else {
		target.addEventListener("blur", () => finish(true));
	}
	target.addEventListener("keydown", (e: KeyboardEvent) => {
		if (e.key === "Escape") finish(false);
		else if (e.key === "Enter" && (!(input instanceof HTMLTextAreaElement) || e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			finish(true);
		}
	});
}

/** Three inputs, one per table cell; each commits on its own when it loses focus. */
function startUnitEdit(unit: HTMLElement, row: PlotMatrixRow, cb: PlotMatrixCallbacks): void {
	unit.empty();
	unit.addClass("is-editing");

	const fields: { column: OutlineColumn; label: string; value: string }[] = [
		{ column: "Act", label: "Act", value: row.act ?? "" },
		{ column: "Chapter", label: "Chapter", value: row.chapterText ?? "" },
		{ column: "Scene", label: "Scene", value: row.sceneText ?? "" },
	];
	const inputs: HTMLInputElement[] = [];
	for (const field of fields) {
		const label = unit.createEl("label", { cls: "scribe-plot-matrix-unit-field" });
		label.createSpan({ text: field.label });
		const input = label.createEl("input", { type: "text", cls: "scribe-plot-matrix-input", value: field.value });
		inputs.push(input);
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") input.blur();
			else if (e.key === "Escape") {
				input.value = field.value;
				input.blur();
			}
		});
		input.addEventListener("blur", () => {
			if (input.value === field.value) return;
			const previous = field.value;
			field.value = input.value;
			// Later inputs in this square are written against the row as it now stands.
			if (row.target && field.column === "Chapter") row.target.chapterText = input.value.trim() || null;
			if (row.target && field.column === "Scene") row.target.sceneText = input.value.trim() || null;
			void cb.editCell(row, field.column, input.value).catch(() => {
				field.value = previous;
			});
		});
	}
	// Leaving the square ends the edit. The listener is removed with it, so reopening
	// the editor never stacks handlers from earlier sessions; the check is deferred so a
	// click on the square's padding (focus briefly nowhere) doesn't close it mid-edit.
	const onFocusOut = (): void => {
		window.setTimeout(() => {
			if (!unit.isConnected || unit.contains(unit.doc.activeElement)) return;
			unit.removeEventListener("focusout", onFocusOut);
			unit.removeClass("is-editing");
			renderUnit(unit, row, true, cb);
		}, 0);
	};
	unit.addEventListener("focusout", onFocusOut);
	inputs[1]?.focus();
}
