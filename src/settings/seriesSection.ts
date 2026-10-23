// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import type { Setting } from "obsidian";

const WEBSITE_URL = "https://aescanes.github.io/scribe-of-lagash-website/";

const SERIES_PLUGINS = [
	{ id: "scribe-of-lagash-focus", name: "Focus" },
	{ id: "scribe-of-lagash-goals-stats", name: "Goals and Stats" },
	{ id: "scribe-of-lagash-visualization", name: "Visualization" },
] as const;

export const SERIES_HEADING = "Scribe of Lagash series";

export interface SeriesRow {
	name: string;
	desc: string;
	buttonText: string;
	url: string;
}

/** Website link plus a community-page link for each of the series' other plugins, shared by both render paths. */
export function seriesRows(selfId: string): SeriesRow[] {
	return [
		{
			name: "Website",
			desc: "Learn more about the Scribe of Lagash series of writing plugins.",
			buttonText: "Open website",
			url: WEBSITE_URL,
		},
		...SERIES_PLUGINS.filter((plugin) => plugin.id !== selfId).map((plugin) => ({
			name: `Scribe of Lagash - ${plugin.name}`,
			desc: "Open its page in the Obsidian community plugins.",
			buttonText: "View plugin",
			url: `https://obsidian.md/plugins?id=${plugin.id}`,
		})),
	];
}

export function renderSeriesButton(setting: Setting, row: SeriesRow): void {
	setting.addButton((button) => button.setButtonText(row.buttonText).onClick(() => window.open(row.url)));
}
