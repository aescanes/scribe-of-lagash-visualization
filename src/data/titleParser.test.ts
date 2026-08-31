// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import test from "node:test";
import assert from "node:assert/strict";

import { parseTitle, romanToInt } from "./titleParser";

test("romanToInt decodes well-formed numerals", () => {
	assert.equal(romanToInt("I"), 1);
	assert.equal(romanToInt("iv"), 4);
	assert.equal(romanToInt("XIV"), 14);
	assert.equal(romanToInt("MCMLXXXIV"), 1984);
});

test("romanToInt rejects malformed numerals", () => {
	assert.equal(romanToInt(""), null);
	assert.equal(romanToInt("IIII"), null);
	assert.equal(romanToInt("banana"), null);
});

test("parseTitle recognises numbered chapters", () => {
	assert.deepEqual(parseTitle("Chapter 1"), { type: "chapter", number: 1, label: "Chapter 1" });
	assert.deepEqual(parseTitle("Chapter I"), { type: "chapter", number: 1, label: "Chapter 1" });
	assert.deepEqual(parseTitle("Ch. 12 - The Fall"), { type: "chapter", number: 12, label: "Chapter 12" });
	assert.deepEqual(parseTitle("chapter iv: return"), { type: "chapter", number: 4, label: "Chapter 4" });
});

test("parseTitle recognises numbered scenes", () => {
	assert.deepEqual(parseTitle("Scene 2"), { type: "scene", number: 2, label: "Scene 2" });
	assert.deepEqual(parseTitle("Scene IX"), { type: "scene", number: 9, label: "Scene 9" });
});

test("parseTitle recognises standalone chapter-like units", () => {
	assert.deepEqual(parseTitle("Prologue"), { type: "chapter", number: null, label: "Prologue" });
	assert.deepEqual(parseTitle("EPILOGUE"), { type: "chapter", number: null, label: "Epilogue" });
});

test("parseTitle returns null for unrelated titles", () => {
	assert.equal(parseTitle("Character sheet — Alice"), null);
	assert.equal(parseTitle("Chapter"), null);
	assert.equal(parseTitle("Chapter Nine"), null);
	assert.equal(parseTitle(""), null);
});

test("parseTitle falls back to the default language for unknown languages", () => {
	assert.deepEqual(parseTitle("Chapter 3", "xx"), { type: "chapter", number: 3, label: "Chapter 3" });
});
