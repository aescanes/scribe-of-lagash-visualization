// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 aescanes

import { BasesEntry, BasesEntryGroup, BasesView, QueryController } from "obsidian";
import { folderContext } from "../data/pathContext";
import { FRONTMATTER_KEYS } from "../types";

export const BASES_VIEW_TYPE_TIMELINE = "scribe-timeline";

const PROP = {
	type: `note.${FRONTMATTER_KEYS.type}`,
	date: `note.${FRONTMATTER_KEYS.date}`,
	characters: `note.${FRONTMATTER_KEYS.characters}`,
	places: `note.${FRONTMATTER_KEYS.places}`,
} as const;

/**
 * Renders a Base's query result (already filtered, sorted, and grouped by the
 * user via Bases' own toolbar) as a chapter/scene timeline. This intentionally
 * defers all filtering/sorting/grouping to Bases rather than reimplementing it.
 */
export class ScribeTimelineBasesView extends BasesView {
	type = BASES_VIEW_TYPE_TIMELINE;

	constructor(controller: QueryController, private containerEl: HTMLElement) {
		super(controller);
		this.containerEl.addClass("scribe-timeline-view");
	}

	onDataUpdated(): void {
		this.render();
	}

	private render(): void {
		const container = this.containerEl;
		container.empty();

		const groups = this.data.groupedData;
		const isEmpty = groups.every((group) => group.entries.length === 0);
		if (isEmpty) {
			container.createDiv({
				cls: "scribe-timeline-empty",
				text: "No entries match this Base's filters yet.",
			});
			return;
		}

		for (const group of groups) {
			this.renderGroup(container, group);
		}
	}

	private renderGroup(container: HTMLElement, group: BasesEntryGroup): void {
		if (group.hasKey()) {
			container.createEl("h4", {
				cls: "scribe-timeline-group-title",
				text: group.key?.toString() ?? "",
			});
		}

		const track = container.createDiv({ cls: "scribe-timeline-track" });
		for (const entry of group.entries) {
			this.renderEntry(track, entry);
		}
	}

	private renderEntry(track: HTMLElement, entry: BasesEntry): void {
		const rawType = entry.getValue(PROP.type)?.toString();
		const item = track.createDiv({
			cls: `scribe-timeline-item scribe-timeline-item--${rawType === "scene" ? "scene" : "chapter"}`,
		});
		item.createDiv({ cls: "scribe-timeline-dot" });

		const card = item.createDiv({ cls: "scribe-timeline-card" });

		card.createDiv({ cls: "scribe-timeline-title", text: entry.file.basename });
		// No book-folder concept here, so show the full parent-folder path.
		const context = folderContext(entry.file.path);
		if (context.length) {
			card.createDiv({ cls: "scribe-timeline-context", text: context.join(" - ") });
		}

		const date = entry.getValue(PROP.date)?.toString();
		if (date) card.createDiv({ cls: "scribe-timeline-date", text: date });

		const meta: string[] = [];
		const characters = entry.getValue(PROP.characters)?.toString();
		if (characters) meta.push(characters);
		const places = entry.getValue(PROP.places)?.toString();
		if (places) meta.push(places);
		if (meta.length) card.createDiv({ cls: "scribe-timeline-meta", text: meta.join(" · ") });

		card.addEventListener("click", () => {
			this.app.workspace.getLeaf(false).openFile(entry.file);
		});
	}
}
