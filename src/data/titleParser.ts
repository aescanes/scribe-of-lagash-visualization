// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import type { EntryType, ParsedTitle } from "../types";

/**
 * Classifies a note by its title (file basename) alone. Pure — no Obsidian
 * APIs — so it stays trivially testable and so more languages can be added as
 * extra pattern tables without touching the scanning code.
 *
 * Only English ships today. The screenshot-driven design uses Spanish
 * ("Capítulo", "Escena"); adding it means one more entry in LANGUAGE_PATTERNS.
 */

interface NumberedPattern {
	type: EntryType;
	/** Capture group 1 must be the number token (digits or roman numerals). */
	regex: RegExp;
	/** Word shown on the card for this unit, e.g. "Chapter". */
	unit: string;
}

interface StandalonePattern {
	type: EntryType;
	regex: RegExp;
}

interface PatternTable {
	numbered: NumberedPattern[];
	standalone: StandalonePattern[];
}

const NUMBER_TOKEN = "(\\d+|[ivxlcdm]+)";

const LANGUAGE_PATTERNS: Record<string, PatternTable> = {
	en: {
		numbered: [
			{
				type: "chapter",
				unit: "Chapter",
				regex: new RegExp(`^\\s*(?:chapter|chap|ch)\\.?\\s+${NUMBER_TOKEN}\\b`, "i"),
			},
			{
				type: "scene",
				unit: "Scene",
				regex: new RegExp(`^\\s*(?:scene|sc)\\.?\\s+${NUMBER_TOKEN}\\b`, "i"),
			},
		],
		standalone: [
			{ type: "chapter", regex: /^\s*(prologue|epilogue|interlude|foreword|afterword|preface)\b/i },
		],
	},
};

export const DEFAULT_LANGUAGE = "en";

export function availableLanguages(): string[] {
	return Object.keys(LANGUAGE_PATTERNS);
}

const CANONICAL_ROMAN = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i;
const ROMAN_VALUES: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };

/** Decodes a roman numeral, or returns null if it is not a well-formed one. */
export function romanToInt(input: string): number | null {
	const s = input.trim().toLowerCase();
	if (s === "" || !CANONICAL_ROMAN.test(s)) return null;

	let total = 0;
	for (let i = 0; i < s.length; i++) {
		const current = ROMAN_VALUES[s[i]];
		const next = ROMAN_VALUES[s[i + 1]] ?? 0;
		total += current < next ? -current : current;
	}
	return total;
}

function parseNumberToken(token: string): number | null {
	if (/^\d+$/.test(token)) {
		const n = Number.parseInt(token, 10);
		return Number.isFinite(n) ? n : null;
	}
	return romanToInt(token);
}

function titleCase(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Returns the parsed chapter/scene role of a title, or null if the title does
 * not look like either.
 */
export function parseTitle(basename: string, language: string = DEFAULT_LANGUAGE): ParsedTitle | null {
	const table = LANGUAGE_PATTERNS[language] ?? LANGUAGE_PATTERNS[DEFAULT_LANGUAGE];

	for (const pattern of table.numbered) {
		const match = pattern.regex.exec(basename);
		if (!match) continue;
		const number = parseNumberToken(match[1]);
		if (number === null) continue;
		return { type: pattern.type, number, label: `${pattern.unit} ${number}` };
	}

	for (const pattern of table.standalone) {
		const match = pattern.regex.exec(basename);
		if (!match) continue;
		return { type: pattern.type, number: null, label: titleCase(match[1]) };
	}

	return null;
}
