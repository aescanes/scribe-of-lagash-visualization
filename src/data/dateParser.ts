// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

/**
 * Parses the in-story dates of `scribe-note-date` / the outline's `Date` column.
 * Pure — no Obsidian APIs. Free text can't be ordered reliably, so only a small
 * closed set of forms is accepted (ISO, and full month names in English and
 * Spanish); anything else is "not recognized" rather than guessed.
 *
 * A month followed by a single number is always a *year* (`November 1` is
 * November of year 1), which lets a story with no real calendar use small
 * "false" years. A day needs a year too (`November 3, 1`).
 */

export interface ParsedDate {
	year: number;
	/** 1–12, or null for year precision. */
	month: number | null;
	/** 1–31, or null for year / month precision. */
	day: number | null;
	/** Sort key: the start of the period (a missing month/day counts as 0). */
	key: number;
}

// Both languages are always accepted: month names don't collide, so no setting.
const MONTH_NAMES: Record<string, number> = {
	january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
	july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
	enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
	julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const DISPLAY_MONTHS: Record<string, string[]> = {
	en: [
		"January", "February", "March", "April", "May", "June",
		"July", "August", "September", "October", "November", "December",
	],
	es: [
		"enero", "febrero", "marzo", "abril", "mayo", "junio",
		"julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
	],
};

// Past 6 digits a "year" is almost certainly a typo, and the sort key stays a safe integer.
const MAX_YEAR = 999999;

function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
	if (month === 2) return isLeapYear(year) ? 29 : 28;
	return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function build(year: number, month: number | null, day: number | null): ParsedDate | null {
	if (!Number.isInteger(year) || year < 1 || year > MAX_YEAR) return null;
	if (month !== null && (month < 1 || month > 12)) return null;
	if (day !== null) {
		if (month === null || day < 1 || day > daysInMonth(year, month)) return null;
	}
	return { year, month, day, key: year * 10000 + (month ?? 0) * 100 + (day ?? 0) };
}

const ISO_DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;
const DIGITS = /^\d+$/;

/** Lowercase, accent-free tokens, with commas and the Spanish "de" connector dropped. */
function tokens(text: string): string[] {
	return text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/,/g, " ")
		.split(/\s+/)
		.filter((t) => t !== "" && t !== "de");
}

export function parseStoryDate(text: string | null | undefined): ParsedDate | null {
	if (!text) return null;
	const trimmed = text.trim();

	const iso = ISO_DATE.exec(trimmed);
	if (iso) {
		return build(
			Number(iso[1]),
			iso[2] === undefined ? null : Number(iso[2]),
			iso[3] === undefined ? null : Number(iso[3]),
		);
	}

	const t = tokens(trimmed);
	const isNumber = (s: string | undefined): s is string => s !== undefined && DIGITS.test(s);
	const monthOf = (s: string | undefined): number | null =>
		s !== undefined && Object.prototype.hasOwnProperty.call(MONTH_NAMES, s) ? MONTH_NAMES[s] : null;

	if (t.length === 2) {
		// Month Year — the number is a year, never a day.
		const month = monthOf(t[0]);
		if (month !== null && isNumber(t[1])) return build(Number(t[1]), month, null);
	} else if (t.length === 3) {
		// Month Day Year
		const monthFirst = monthOf(t[0]);
		if (monthFirst !== null && isNumber(t[1]) && isNumber(t[2])) {
			return build(Number(t[2]), monthFirst, Number(t[1]));
		}
		// Day Month Year
		const monthMiddle = monthOf(t[1]);
		if (isNumber(t[0]) && monthMiddle !== null && isNumber(t[2])) {
			return build(Number(t[2]), monthMiddle, Number(t[0]));
		}
	}
	return null;
}

export function compareDates(a: ParsedDate, b: ParsedDate): number {
	return a.key - b.key;
}

/**
 * Days since a fixed epoch (proleptic Gregorian) at the start of the date's
 * period — a missing month/day counts as the 1st — so two dates can be
 * subtracted whatever their precision.
 */
export function toDayNumber(date: ParsedDate): number {
	const month = date.month ?? 1;
	const day = date.day ?? 1;
	const y = month <= 2 ? date.year - 1 : date.year;
	const era = Math.floor(y / 400);
	const yearOfEra = y - era * 400;
	const monthIndex = (month + 9) % 12;
	const dayOfYear = Math.floor((153 * monthIndex + 2) / 5) + day - 1;
	const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
	return era * 146097 + dayOfEra;
}

/** "about 10 years later" / "12 days later" for a span of days, in the title language. */
export function describeElapsed(days: number, language: string): string {
	const es = language === "es";
	let count: number;
	let approx = true;
	let unit: [string, string];
	if (days >= 730) {
		count = Math.round(days / 365.2425);
		unit = es ? ["año", "años"] : ["year", "years"];
	} else if (days >= 60) {
		count = Math.round(days / 30.4369);
		unit = es ? ["mes", "meses"] : ["month", "months"];
	} else {
		count = Math.max(1, Math.round(days));
		approx = false;
		unit = es ? ["día", "días"] : ["day", "days"];
	}
	const amount = `${count} ${count === 1 ? unit[0] : unit[1]}`;
	if (es) return `${approx ? "unos " : ""}${amount} después`;
	return `${approx ? "about " : ""}${amount} later`;
}

/**
 * Readable label for a card, at the date's own precision. A year under 1000 is
 * spelled out so a false year can't be read as a day ("November, year 1").
 */
export function formatStoryDate(date: ParsedDate, language: string): string {
	const es = language === "es";
	const months = DISPLAY_MONTHS[es ? "es" : "en"];
	const small = date.year < 1000;
	const yearWord = es ? "año" : "year";

	if (date.month === null) return small ? `${yearWord} ${date.year}` : String(date.year);

	const month = months[date.month - 1];
	if (es) {
		const head = date.day === null ? month : `${date.day} de ${month}`;
		return small ? `${head}, ${yearWord} ${date.year}` : `${head} de ${date.year}`;
	}
	const head = date.day === null ? month : `${month} ${date.day}`;
	if (small) return `${head}, ${yearWord} ${date.year}`;
	return date.day === null ? `${head} ${date.year}` : `${head}, ${date.year}`;
}

/**
 * What a card shows for a date cell: the readable label when the text parses,
 * else the writer's own text (so a typo stays visible), else null.
 */
export function displayDate(text: string | null | undefined, language: string): string | null {
	const trimmed = text?.trim();
	if (!trimmed) return null;
	const parsed = parseStoryDate(trimmed);
	return parsed ? formatStoryDate(parsed, language) : trimmed;
}

/** One-line description of the accepted forms, for ⚠ messages and empty notices. */
export function dateFormatHint(): string {
	return "2026-11-03, November 2026, November 3, 2026 or 3 de noviembre de 2026 (a month followed by one number is a year)";
}
