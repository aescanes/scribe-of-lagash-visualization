// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import { EXCERPT_MAX_CHARS, firstParagraph } from "../../src/data/excerpt";

test("returns the first paragraph, skipping frontmatter, headings and rules", () => {
	const note = "---\nscribe-note-date: 2026\n---\n\n# Chapter 1\n\n---\n\nIt was a dark night.\nThe rain fell.\n\nSecond paragraph.";
	assert.equal(firstParagraph(note), "It was a dark night. The rain fell.");
});

test("a heading glued to the first line of prose is dropped, the prose kept", () => {
	assert.equal(firstParagraph("# Title\nOnce upon a time."), "Once upon a time.");
});

test("flattens links and emphasis, and skips comments", () => {
	const note = "%% todo %%\n\n<!-- note -->\n\n**Harry** met [[Ron Weasley|Ron]] at [King's Cross](http://x) and [[Hermione]].";
	assert.equal(firstParagraph(note), "Harry met Ron at King's Cross and Hermione.");
});

test("shortens a long paragraph at a word boundary with an ellipsis", () => {
	const text = "word ".repeat(100).trim();
	const out = firstParagraph(text) ?? "";
	assert.ok(out.endsWith("…"));
	assert.ok(out.length <= EXCERPT_MAX_CHARS + 1);
	assert.ok(!out.slice(0, -1).endsWith(" "));
});

test("returns null for an empty note or one with only headings", () => {
	assert.equal(firstParagraph(""), null);
	assert.equal(firstParagraph("---\na: b\n---\n"), null);
	assert.equal(firstParagraph("# Only a heading\n\n## Another"), null);
});
