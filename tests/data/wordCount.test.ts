// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import { countWords } from "../../src/data/wordCount";

test("countWords counts whitespace-separated words", () => {
	assert.equal(countWords("Hello world"), 2);
	assert.equal(countWords("  Hello   world  \n\nagain  "), 3);
});

test("countWords ignores the frontmatter block", () => {
	const content = ["---", "scribe-visualization-status: draft", "---", "", "Hello world"].join("\n");
	assert.equal(countWords(content), 2);
});

test("countWords is 0 for empty or frontmatter-only content", () => {
	assert.equal(countWords(""), 0);
	assert.equal(countWords("---\nscribe-visualization-status: draft\n---\n"), 0);
});
