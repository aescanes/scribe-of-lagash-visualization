// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";
import { checkStatus, NO_STATUS, OUTLINE_STATUSES, statusHint } from "../../src/data/outlineStatus";

test("checkStatus: empty and 'No Status' mean no status", () => {
	assert.deepEqual(checkStatus(""), { kind: "none" });
	assert.deepEqual(checkStatus(null), { kind: "none" });
	assert.deepEqual(checkStatus("  no status "), { kind: "none" });
});

test("checkStatus matches the offered statuses case-insensitively, returning the canonical spelling", () => {
	assert.deepEqual(checkStatus("to do"), { kind: "known", status: "TO DO" });
	assert.deepEqual(checkStatus("FIRST DRAFT"), { kind: "known", status: "First Draft" });
	for (const status of OUTLINE_STATUSES) assert.deepEqual(checkStatus(status), { kind: "known", status });
});

test("checkStatus leaves anything else as unknown, text intact", () => {
	assert.deepEqual(checkStatus(" draft? "), { kind: "unknown", text: "draft?" });
	assert.ok(statusHint().startsWith(NO_STATUS));
});
