// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";
import { OUTLINE_GUIDE, refreshOutlineGuide } from "../../src/data/outlineGuide";

const table = "| Chapter |\n| --- |\n| 1 |\n\n---\n\n";

test("refreshOutlineGuide replaces an outdated guide, keeping the table", () => {
	const body = `${table}## Filling in the outline\n\nold text\n`;
	assert.equal(refreshOutlineGuide(body), table + OUTLINE_GUIDE);
});

test("refreshOutlineGuide does nothing when the guide is current, even with trailing whitespace", () => {
	assert.equal(refreshOutlineGuide(table + OUTLINE_GUIDE), null);
	assert.equal(refreshOutlineGuide(table + OUTLINE_GUIDE + "\n\n"), null);
});

test("refreshOutlineGuide leaves a file without the guide alone", () => {
	assert.equal(refreshOutlineGuide(table), null);
});
