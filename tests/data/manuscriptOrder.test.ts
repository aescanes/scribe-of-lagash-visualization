// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import { byManuscriptOrder, OrderedEntry } from "../../src/data/manuscriptOrder";

function e(path: string, order: number | null): OrderedEntry {
	return { path, order, title: path.split("/").pop()?.replace(/\.md$/, "") ?? path };
}

function sorted(items: OrderedEntry[]): string[] {
	return [...items].sort(byManuscriptOrder).map((i) => i.title);
}

test("groups by containing folder before number", () => {
	assert.deepEqual(
		sorted([
			e("Book/Act II/Chapter 2.md", 2),
			e("Book/Act I/Chapter 15.md", 15),
			e("Book/Act I/Chapter 3.md", 3),
			e("Book/Act II/Chapter 1.md", 1),
		]),
		["Chapter 3", "Chapter 15", "Chapter 1", "Chapter 2"],
	);
});

test("top-level notes sort before nested ones", () => {
	assert.deepEqual(
		sorted([e("Book/Act I/Chapter 1.md", 1), e("Book/Chapter 2.md", 2)]),
		["Chapter 2", "Chapter 1"],
	);
});

test("un-numbered units sort after numbered ones in the same folder", () => {
	assert.deepEqual(
		sorted([e("Book/Chapter 1.md", 1), e("Book/Prologue.md", null), e("Book/Chapter 2.md", 2)]),
		["Chapter 1", "Chapter 2", "Prologue"],
	);
});

test("same number, same folder falls back to title", () => {
	assert.deepEqual(
		sorted([e("Book/Scene B.md", 1), e("Book/Scene A.md", 1)]),
		["Scene A", "Scene B"],
	);
});
