// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import { ParsedDate, compareDates, dateFormatHint, describeElapsed, displayDate, toDayNumber, formatStoryDate, parseStoryDate } from "../../src/data/dateParser";

function ymd(text: string): [number, number | null, number | null] | null {
	const d = parseStoryDate(text);
	return d ? [d.year, d.month, d.day] : null;
}

function parsed(text: string): ParsedDate {
	const d = parseStoryDate(text);
	assert.ok(d, `expected "${text}" to parse`);
	return d;
}

test("parses ISO year, year-month and full dates", () => {
	assert.deepEqual(ymd("2026"), [2026, null, null]);
	assert.deepEqual(ymd("2026-11"), [2026, 11, null]);
	assert.deepEqual(ymd("2026-11-03"), [2026, 11, 3]);
	assert.deepEqual(ymd("  2026-11-03  "), [2026, 11, 3]);
});

test("parses English month names", () => {
	assert.deepEqual(ymd("November 2026"), [2026, 11, null]);
	assert.deepEqual(ymd("november 2026"), [2026, 11, null]);
	assert.deepEqual(ymd("November 3, 2026"), [2026, 11, 3]);
	assert.deepEqual(ymd("November 3 2026"), [2026, 11, 3]);
	assert.deepEqual(ymd("3 November 2026"), [2026, 11, 3]);
});

test("parses Spanish month names, with or without accents and the de connector", () => {
	assert.deepEqual(ymd("Noviembre 2026"), [2026, 11, null]);
	assert.deepEqual(ymd("noviembre de 2026"), [2026, 11, null]);
	assert.deepEqual(ymd("3 de noviembre de 2026"), [2026, 11, 3]);
	assert.deepEqual(ymd("3 noviembre 2026"), [2026, 11, 3]);
	assert.deepEqual(ymd("noviembre 3, 2026"), [2026, 11, 3]);
	assert.deepEqual(ymd("Setiembre 2026"), [2026, 9, null]);
	assert.deepEqual(ymd("DICIEMBRE 2026"), [2026, 12, null]);
});

test("a month followed by one number is a year, never a day", () => {
	assert.deepEqual(ymd("November 1"), [1, 11, null]);
	assert.deepEqual(ymd("December 1"), [1, 12, null]);
	assert.deepEqual(ymd("January 2"), [2, 1, null]);
	assert.deepEqual(ymd("November 26"), [26, 11, null]);
	assert.deepEqual(ymd("November 3, 1"), [1, 11, 3]);
});

test("rejects forms that are ambiguous, incomplete or not dates", () => {
	for (const text of [
		"",
		"   ",
		"November",
		"Noviembre",
		"3 November",
		"03/01/2026",
		"2026/11/03",
		"Nov 2026",
		"ene 2026",
		"3rd November 2026",
		"Monday November 3 2026",
		"sometime",
		"2026-13",
		"2026-00-10",
		"2026-02-30",
		"2025-02-29",
		"November 31, 2026",
		"November 0",
		"November 3, 0",
		"26-11-03",
		"2026-1-3",
	]) {
		assert.equal(parseStoryDate(text), null, `"${text}" should not parse`);
	}
	assert.equal(parseStoryDate(null), null);
	assert.equal(parseStoryDate(undefined), null);
});

test("validates days against the month and the leap rule", () => {
	assert.deepEqual(ymd("2024-02-29"), [2024, 2, 29]);
	assert.deepEqual(ymd("2000-02-29"), [2000, 2, 29]);
	assert.equal(parseStoryDate("1900-02-29"), null);
	assert.deepEqual(ymd("April 30, 2026"), [2026, 4, 30]);
	assert.equal(parseStoryDate("April 31, 2026"), null);
});

test("the sort key orders by period start", () => {
	const order = ["November 1", "2026", "November 2026", "November 3, 2026", "2026-11-10", "2026-12", "2027"];
	const sorted = [...order].sort((a, b) => compareDates(parsed(a), parsed(b)));
	assert.deepEqual(sorted, order);
	assert.equal(compareDates(parsed("2026-11-03"), parsed("November 3, 2026")), 0);
});

test("formatStoryDate keeps the date's precision", () => {
	assert.equal(formatStoryDate(parsed("2026-11-03"), "en"), "November 3, 2026");
	assert.equal(formatStoryDate(parsed("2026-11"), "en"), "November 2026");
	assert.equal(formatStoryDate(parsed("2026"), "en"), "2026");
	assert.equal(formatStoryDate(parsed("2026-11-03"), "es"), "3 de noviembre de 2026");
	assert.equal(formatStoryDate(parsed("2026-11"), "es"), "noviembre de 2026");
	assert.equal(formatStoryDate(parsed("2026"), "es"), "2026");
});

test("formatStoryDate spells out a false year so it can't read as a day", () => {
	assert.equal(formatStoryDate(parsed("November 1"), "en"), "November, year 1");
	assert.equal(formatStoryDate(parsed("November 3, 1"), "en"), "November 3, year 1");
	assert.equal(formatStoryDate(parsed("noviembre 1"), "es"), "noviembre, año 1");
	assert.equal(formatStoryDate(parsed("3 de noviembre de 1"), "es"), "3 de noviembre, año 1");
});

test("formatStoryDate falls back to English for an unknown language", () => {
	assert.equal(formatStoryDate(parsed("2026-11-03"), "xx"), "November 3, 2026");
});

test("dateFormatHint describes the accepted forms", () => {
	assert.match(dateFormatHint(), /2026-11-03/);
});

test("displayDate shows the readable form, or the writer's own text when it isn't a date", () => {
	assert.equal(displayDate("2026-11-03", "en"), "November 3, 2026");
	assert.equal(displayDate(" 2026-11-03 ", "es"), "3 de noviembre de 2026");
	assert.equal(displayDate("Nov 3", "en"), "Nov 3");
	assert.equal(displayDate("", "en"), null);
	assert.equal(displayDate(null, "en"), null);
});

test("toDayNumber counts days from the start of each period", () => {
	assert.equal(toDayNumber(parsed("2026-11-04")) - toDayNumber(parsed("2026-11-03")), 1);
	assert.equal(toDayNumber(parsed("2026-03-01")) - toDayNumber(parsed("2026-02-28")), 1);
	assert.equal(toDayNumber(parsed("2024-03-01")) - toDayNumber(parsed("2024-02-28")), 2);
	assert.equal(toDayNumber(parsed("2027")) - toDayNumber(parsed("2026")), 365);
	assert.equal(toDayNumber(parsed("2025")) - toDayNumber(parsed("2024")), 366);
	assert.equal(toDayNumber(parsed("June 1991")), toDayNumber(parsed("1991-06-01")));
	assert.equal(toDayNumber(parsed("November 2")) - toDayNumber(parsed("November 1")), 365);
});

test("describeElapsed picks days, months or years and speaks both languages", () => {
	assert.equal(describeElapsed(1, "en"), "1 day later");
	assert.equal(describeElapsed(12, "en"), "12 days later");
	assert.equal(describeElapsed(90, "en"), "about 3 months later");
	assert.equal(describeElapsed(3650, "en"), "about 10 years later");
	assert.equal(describeElapsed(12, "es"), "12 días después");
	assert.equal(describeElapsed(1, "es"), "1 día después");
	assert.equal(describeElapsed(3650, "es"), "unos 10 años después");
});
