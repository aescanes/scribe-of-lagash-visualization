// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import { emptyLineLayout, lineFilePath, parseLineLayout } from "./lineLayout";

test("lineFilePath joins folder and name, tolerating slashes", () => {
	assert.equal(lineFilePath("Book", "Lines.md"), "Book/Lines.md");
	assert.equal(lineFilePath("/Book/The City/", "Lines.md"), "Book/The City/Lines.md");
	assert.equal(lineFilePath("Book", "  "), "Book/Lines.md");
	assert.equal(lineFilePath("", "Lines.md"), "Lines.md");
});

test("parseLineLayout returns an empty layout for junk input", () => {
	assert.deepEqual(parseLineLayout(null), emptyLineLayout());
	assert.deepEqual(parseLineLayout("nope"), emptyLineLayout());
	assert.deepEqual(parseLineLayout({}), emptyLineLayout());
});

test("parseLineLayout coerces lines and fills defaults", () => {
	const layout = parseLineLayout({
		lines: [
			{ id: "main", name: "Main line", color: "#e06c75", order: 0 },
			{ id: "backstory" },
			{ name: "no id — dropped" },
		],
	});
	assert.equal(layout.lines.length, 2);
	assert.deepEqual(layout.lines[1], { id: "backstory", name: "backstory", color: "#888888", order: 1 });
});

test("parseLineLayout coerces placements", () => {
	const layout = parseLineLayout({
		placements: {
			"Book/Chapter 1.md": { lines: ["main"], x: 0 },
			"Book/Chapter 2.md": { lines: ["main", "backstory"], x: "3" },
			"Book/bad.md": 42,
		},
	});
	assert.deepEqual(layout.placements["Book/Chapter 1.md"], { lines: ["main"], x: 0 });
	assert.deepEqual(layout.placements["Book/Chapter 2.md"], { lines: ["main", "backstory"], x: 3 });
	assert.equal("Book/bad.md" in layout.placements, false);
});

test("parseLineLayout still reads the pre-0.4 `timelines` key", () => {
	const layout = parseLineLayout({
		timelines: [{ id: "main", name: "Main", color: "#111", order: 0 }],
		placements: { "Book/Chapter 1.md": { timelines: ["main"], x: 2 } },
	});
	assert.equal(layout.lines[0].id, "main");
	assert.deepEqual(layout.placements["Book/Chapter 1.md"], { lines: ["main"], x: 2 });
});
