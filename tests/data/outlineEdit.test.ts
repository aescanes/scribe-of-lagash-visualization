// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";
import { ensureOutlineColumns } from "../../src/data/outlineEdit";
import { OUTLINE_COLUMNS, parseOutlineTable } from "../../src/data/outline";

const FULL_HEADER = `| ${OUTLINE_COLUMNS.join(" | ")} |`;

test("ensureOutlineColumns leaves a complete table untouched", () => {
	const body = `Intro\n\n${FULL_HEADER}\n| --- |\n|  |\n`;
	const out = ensureOutlineColumns(body);
	assert.equal(out.body, body);
	assert.deepEqual(out.added, []);
});

test("ensureOutlineColumns does nothing when there is no table", () => {
	const out = ensureOutlineColumns("Just notes.\n");
	assert.equal(out.body, "Just notes.\n");
	assert.deepEqual(out.added, []);
});

test("ensureOutlineColumns appends missing columns and keeps existing cells", () => {
	const body = [
		"| Chapter | Scene | Line |",
		"| ------- | ----- | ---- |",
		"| 1       |       | Main |",
		"",
		"after",
	].join("\n");
	const out = ensureOutlineColumns(body);
	assert.deepEqual(out.added, ["Act", "Synopsis", "Characters", "Locations", "Date", "Status", "Comments"]);

	const rows = parseOutlineTable(out.body);
	assert.equal(rows.length, 1);
	assert.equal(rows[0].chapter, 1);
	assert.equal(rows[0].line, "Main");
	assert.ok(out.body.endsWith("\nafter"));
	assert.equal(ensureOutlineColumns(out.body).added.length, 0, "a second pass finds nothing to add");
});

test("ensureOutlineColumns puts a missing column at its canonical place, not at the end", () => {
	const body = "| Chapter | Line | Synopsis |\n| --- | --- | --- |\n| 1 | Main | text |\n";
	const out = ensureOutlineColumns(body);
	const header = out.body.split("\n")[0].split("|").map((c) => c.trim()).filter(Boolean);
	assert.deepEqual(header, [
		"Act", "Chapter", "Scene", "Line", "Synopsis", "Characters", "Locations", "Date", "Status", "Comments",
	]);
	const rows = parseOutlineTable(out.body);
	assert.deepEqual([rows[0].chapter, rows[0].scene, rows[0].line, rows[0].summary], [1, null, "Main", "text"]);
});

test("ensureOutlineColumns matches headers case-insensitively and counts Places as Locations", () => {
	const body = "| ACT | chapter | Scene | Line | Synopsis | Characters | Places | Date | Status |\n| - | - | - | - | - | - | - | - | - |\n";
	const out = ensureOutlineColumns(body);
	assert.deepEqual(out.added, ["Comments"]);
});

test("ensureOutlineColumns pads a row shorter than the header so new cells line up", () => {
	const body = "| Chapter | Scene | Line |\n| --- | --- | --- |\n| 1 |\n";
	const out = ensureOutlineColumns(body);
	const row = out.body.split("\n")[2];
	const header = out.body.split("\n")[0];
	assert.equal(row.split("|").length, header.split("|").length);
});

test("ensureOutlineColumns handles rows without trailing pipes", () => {
	const body = "Chapter | Line\n--- | ---\n1 | Main\n";
	const out = ensureOutlineColumns(body);
	const rows = parseOutlineTable(out.body);
	assert.equal(rows[0].chapter, 1);
	assert.equal(rows[0].line, "Main");
});

test("ensureOutlineColumns keeps CRLF line endings", () => {
	const body = "| Chapter |\r\n| --- |\r\n| 1 |\r\n";
	const out = ensureOutlineColumns(body).body;
	assert.ok(!/[^\r]\n/.test(out), "every newline is still preceded by \\r");
	assert.equal(parseOutlineTable(out)[0].chapter, 1);
});

test("parseOutlineTable reads the Comments column", () => {
	const rows = parseOutlineTable("| Chapter | Comments |\n| --- | --- |\n| 1 | rewrite the ending |\n| 2 | |\n");
	assert.equal(rows[0].comments, "rewrite the ending");
	assert.equal(rows[1].comments, null);
});

import { setOutlineCell } from "../../src/data/outlineEdit";

const EDIT_TABLE = [
	"intro",
	"| Chapter | Scene | Line | Synopsis |",
	"| ------- | ----- | ---- | -------- |",
	"| 1       |       | Main | first    |",
	"| skipped |       |      |          |",
	"| 2       |       | Main | second   |",
	"",
	"outro",
].join("\n");

const t = (rowIndex: number, chapterText: string) => ({ rowIndex, chapterText, sceneText: null });

test("setOutlineCell changes only the edited cell", () => {
	const r = setOutlineCell(EDIT_TABLE, t(0, "1"), "Synopsis", "new text");
	assert.ok(r.ok);
	const before = EDIT_TABLE.split("\n");
	const after = r.body.split("\n");
	assert.equal(after.length, before.length);
	for (let i = 0; i < before.length; i++) {
		if (i !== 3) assert.equal(after[i], before[i], `line ${i} untouched`);
	}
	assert.deepEqual(parseOutlineTable(r.body).map((x) => x.summary), ["new text", "second"]);
});

test("setOutlineCell addresses rows by parsed index, skipping rows the parser skips", () => {
	const r = setOutlineCell(EDIT_TABLE, t(1, "2"), "Line", "Other");
	assert.ok(r.ok);
	assert.deepEqual(parseOutlineTable(r.body).map((x) => x.line), ["Main", "Other"]);
});

test("setOutlineCell refuses a stale row and a missing column", () => {
	assert.deepEqual(setOutlineCell(EDIT_TABLE, t(0, "9"), "Line", "x"), { ok: false, reason: "stale" });
	assert.deepEqual(setOutlineCell(EDIT_TABLE, t(5, "1"), "Line", "x"), { ok: false, reason: "no-row" });
	assert.deepEqual(setOutlineCell(EDIT_TABLE, t(0, "1"), "Date", "x"), { ok: false, reason: "no-column" });
});

test("setOutlineCell escapes pipes and newlines so the value round-trips", () => {
	const r = setOutlineCell(EDIT_TABLE, t(0, "1"), "Synopsis", "a | b\nc");
	assert.ok(r.ok);
	const rows = parseOutlineTable(r.body);
	assert.equal(rows[0].summary, "a | b c");
	assert.equal(rows.length, 2);
});

test("setOutlineCell extends a row shorter than the column", () => {
	const body = "| Chapter | Line | Synopsis |\n| --- | --- | --- |\n| 1 |\n";
	const r = setOutlineCell(body, t(0, "1"), "Synopsis", "hi");
	assert.ok(r.ok);
	assert.equal(parseOutlineTable(r.body)[0].summary, "hi");
});

test("setOutlineCell edits a Places column as Locations, and keeps CRLF", () => {
	const body = "| Chapter | Places |\r\n| --- | --- |\r\n| 1 | Rome |\r\n";
	const r = setOutlineCell(body, t(0, "1"), "Locations", "Paris");
	assert.ok(r.ok);
	assert.deepEqual(parseOutlineTable(r.body)[0].locations, ["Paris"]);
	assert.ok(!/[^\r]\n/.test(r.body));
});

test("a cell that already holds an escaped pipe parses as one cell", () => {
	const rows = parseOutlineTable("| Chapter | Synopsis |\n| --- | --- |\n| 1 | a \\| b |\n");
	assert.equal(rows[0].summary, "a | b");
});

import { appendOutlineRow, unitEditProblem } from "../../src/data/outlineEdit";

test("appendOutlineRow adds a numbered empty row after the table, leaving the rest alone", () => {
	const out = appendOutlineRow(EDIT_TABLE);
	assert.ok(out);
	const lines = out.split("\n");
	assert.equal(lines.length, EDIT_TABLE.split("\n").length + 1);
	assert.equal(lines[lines.length - 1], "outro");
	const rows = parseOutlineTable(out);
	assert.equal(rows.length, 3);
	assert.equal(rows[2].chapter, 3);
});

test("appendOutlineRow numbers scenes when the table has no Chapter column, and starts at 1", () => {
	const scenes = appendOutlineRow("| Scene | Line |\n| --- | --- |\n| 4 | A |\n");
	assert.ok(scenes);
	assert.equal(parseOutlineTable(scenes)[1].scene, 5);
	const first = appendOutlineRow("| Chapter | Line |\n| --- | --- |\n");
	assert.ok(first);
	assert.equal(parseOutlineTable(first)[0].chapter, 1);
	assert.equal(appendOutlineRow("no table"), null);
	assert.equal(appendOutlineRow("| Line |\n| --- |\n"), null);
});

test("unitEditProblem keeps a row parseable", () => {
	const row = { chapterText: "1", sceneText: null };
	assert.equal(unitEditProblem(row, "Chapter", "3 - The storm"), null);
	assert.equal(unitEditProblem(row, "Chapter", "IV"), null);
	assert.ok(unitEditProblem(row, "Chapter", "storm"));
	assert.ok(unitEditProblem(row, "Chapter", ""), "can't empty the only Chapter/Scene");
	assert.equal(unitEditProblem({ chapterText: "1", sceneText: "2" }, "Scene", ""), null);
});
