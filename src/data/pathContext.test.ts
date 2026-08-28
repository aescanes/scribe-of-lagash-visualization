// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import { folderContext, formatFolderContext } from "./pathContext";

test("folderContext returns the segments between the book folder and the file", () => {
	assert.deepEqual(folderContext("Book/Act I/Chapter I/Scene 1.md", "Book"), ["Act I", "Chapter I"]);
	assert.deepEqual(folderContext("Book/Chapter 1.md", "Book"), []);
	assert.deepEqual(folderContext("Book/Act I/Chapter 2.md", "/Book/"), ["Act I"]);
});

test("folderContext with no base folder returns every parent folder", () => {
	assert.deepEqual(folderContext("Novels/Book/Act I/Scene 1.md"), ["Novels", "Book", "Act I"]);
	assert.deepEqual(folderContext("Scene 1.md"), []);
});

test("folderContext tolerates a file that is not under the base folder", () => {
	assert.deepEqual(folderContext("Elsewhere/Scene 1.md", "Book"), ["Elsewhere"]);
});

test("formatFolderContext joins with a dash", () => {
	assert.equal(formatFolderContext(["Act I", "Chapter I"]), "Act I - Chapter I");
	assert.equal(formatFolderContext([]), "");
});
