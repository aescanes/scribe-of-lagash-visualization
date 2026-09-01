// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import { scaffoldNoteBody } from "./noteScaffold";
import { OutlineRow, PlannedEntry } from "../types";

function row(over: Partial<OutlineRow> = {}): OutlineRow {
	return {
		rowIndex: 0,
		act: null,
		folder: null,
		chapter: 1,
		scene: null,
		line: null,
		summary: "",
		date: null,
		characters: [],
		places: [],
		status: null,
		...over,
	};
}

function planned(over: Partial<PlannedEntry> = {}): PlannedEntry {
	return {
		row: row(),
		type: "chapter",
		label: "Chapter 1",
		expectedPath: "Book/Chapter 1.md",
		lineId: null,
		...over,
	};
}

test("scaffoldNoteBody with no optional cells is empty", () => {
	assert.equal(scaffoldNoteBody(planned()), "");
});

test("scaffoldNoteBody puts the Summary in the body, with no title heading", () => {
	const body = scaffoldNoteBody(planned({ row: row({ summary: "Berlín 2029." }) }));
	assert.equal(body, "Berlín 2029.\n");
});

test("scaffoldNoteBody writes only the frontmatter keys the row filled in", () => {
	const body = scaffoldNoteBody(
		planned({
			row: row({
				summary: "The committee applauds.",
				date: "2029-03-01",
				characters: ["Matthias", "Elke"],
				status: "draft",
			}),
		}),
	);
	assert.equal(
		body,
		[
			"---",
			'scribe-visualization-date: "2029-03-01"',
			'scribe-visualization-characters: ["Matthias", "Elke"]',
			'scribe-visualization-status: "draft"',
			"---",
			"",
			"The committee applauds.",
			"",
		].join("\n"),
	);
});
