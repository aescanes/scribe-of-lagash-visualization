// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import { emptyBookLayout, parseBookLayout, timelineFilePath } from "./bookLayout";

test("timelineFilePath joins folder and name, tolerating slashes", () => {
	assert.equal(timelineFilePath("Book", "Timelines.md"), "Book/Timelines.md");
	assert.equal(timelineFilePath("/Book/The City/", "Timelines.md"), "Book/The City/Timelines.md");
	assert.equal(timelineFilePath("Book", "  "), "Book/Timelines.md");
	assert.equal(timelineFilePath("", "Timelines.md"), "Timelines.md");
});

test("parseBookLayout returns an empty layout for junk input", () => {
	assert.deepEqual(parseBookLayout(null), emptyBookLayout());
	assert.deepEqual(parseBookLayout("nope"), emptyBookLayout());
	assert.deepEqual(parseBookLayout({}), emptyBookLayout());
});

test("parseBookLayout coerces timelines and fills defaults", () => {
	const layout = parseBookLayout({
		timelines: [
			{ id: "main", name: "Main line", color: "#e06c75", order: 0 },
			{ id: "backstory" },
			{ name: "no id — dropped" },
		],
	});
	assert.equal(layout.timelines.length, 2);
	assert.deepEqual(layout.timelines[1], { id: "backstory", name: "backstory", color: "#888888", order: 1 });
});

test("parseBookLayout coerces placements", () => {
	const layout = parseBookLayout({
		placements: {
			"Book/Chapter 1.md": { timelines: ["main"], x: 0 },
			"Book/Chapter 2.md": { timelines: ["main", "backstory"], x: "3" },
			"Book/bad.md": 42,
		},
	});
	assert.deepEqual(layout.placements["Book/Chapter 1.md"], { timelines: ["main"], x: 0 });
	assert.deepEqual(layout.placements["Book/Chapter 2.md"], { timelines: ["main", "backstory"], x: 3 });
	assert.equal("Book/bad.md" in layout.placements, false);
});
