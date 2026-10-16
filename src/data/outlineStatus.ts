// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

/**
 * The statuses the Plot matrix offers for a row's `Status` cell. A cell holding
 * anything else is left as written and flagged, never rewritten. No Obsidian
 * APIs — unit-tested.
 */

/** Shown in the picker for an empty cell; the cell itself is written empty. */
export const NO_STATUS = "No Status";

export const OUTLINE_STATUSES = [
	"TO DO",
	"In Progress",
	"First Draft",
	"Revised Draft",
	"Final Draft",
	"Done",
] as const;

export type StatusCheck =
	| { kind: "none" }
	| { kind: "known"; status: (typeof OUTLINE_STATUSES)[number] }
	| { kind: "unknown"; text: string };

/** Classifies a raw `Status` cell; known statuses match case-insensitively. */
export function checkStatus(raw: string | null | undefined): StatusCheck {
	const text = raw?.trim() ?? "";
	if (text === "" || text.toLowerCase() === NO_STATUS.toLowerCase()) return { kind: "none" };
	const known = OUTLINE_STATUSES.find((s) => s.toLowerCase() === text.toLowerCase());
	return known ? { kind: "known", status: known } : { kind: "unknown", text };
}

/** One-line list of the accepted values, for hints and ⚠ messages. */
export function statusHint(): string {
	return [NO_STATUS, ...OUTLINE_STATUSES].join(", ");
}
