// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 aescanes

import { ItemView, WorkspaceLeaf } from "obsidian";
import type ScribeVisualizationPlugin from "../main";
import { NovelEntry } from "../types";

export const VIEW_TYPE_TIMELINE = "scribe-timeline-view";

export class TimelineView extends ItemView {
	private plugin: ScribeVisualizationPlugin;
	private unsubscribe: (() => void) | null = null;
	private selectedTimeline: string;

	constructor(leaf: WorkspaceLeaf, plugin: ScribeVisualizationPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.selectedTimeline = plugin.settings.defaultTimeline;
	}

	getViewType(): string {
		return VIEW_TYPE_TIMELINE;
	}

	getDisplayText(): string {
		return "Scribe timeline";
	}

	getIcon(): string {
		return "chart-no-axes-gantt";
	}

	async onOpen(): Promise<void> {
		this.unsubscribe = this.plugin.vaultIndex.onChange(() => this.render());
		this.render();
	}

	async onClose(): Promise<void> {
		this.unsubscribe?.();
		this.unsubscribe = null;
	}

	private render(): void {
		const container = this.contentEl;
		container.empty();
		container.addClass("scribe-timeline-view");

		const toolbar = container.createDiv({ cls: "scribe-timeline-toolbar" });
		const timelineNames = this.plugin.vaultIndex.getTimelineNames();

		const select = toolbar.createEl("select", { cls: "dropdown" });
		select.createEl("option", { text: "All entries", value: "" });
		for (const name of timelineNames) {
			select.createEl("option", { text: name, value: name });
		}
		select.value = this.selectedTimeline;
		select.addEventListener("change", () => {
			this.selectedTimeline = select.value;
			this.render();
		});

		const allEntries = this.plugin.vaultIndex.getEntries();
		const entries = this.selectedTimeline
			? allEntries.filter((e) => e.timelines.includes(this.selectedTimeline))
			: allEntries;

		if (entries.length === 0) {
			container.createDiv({
				cls: "scribe-timeline-empty",
				text: this.selectedTimeline
					? `No chapters or scenes are assigned to the "${this.selectedTimeline}" timeline yet.`
					: "No chapters or scenes yet. Add a scribe-visualization-type frontmatter field (\"chapter\" or \"scene\") to a note to see it here.",
			});
			return;
		}

		const track = container.createDiv({ cls: "scribe-timeline-track" });
		for (const entry of entries) {
			this.renderEntry(track, entry);
		}
	}

	private renderEntry(track: HTMLElement, entry: NovelEntry): void {
		const item = track.createDiv({ cls: `scribe-timeline-item scribe-timeline-item--${entry.type}` });

		item.createDiv({ cls: "scribe-timeline-dot" });

		const card = item.createDiv({ cls: "scribe-timeline-card" });
		card.createDiv({ cls: "scribe-timeline-title", text: entry.title });
		if (entry.context.length) {
			card.createDiv({
				cls: "scribe-timeline-context",
				text: entry.context.join(" - "),
			});
		}
		if (entry.date) {
			card.createDiv({ cls: "scribe-timeline-date", text: entry.date });
		}

		const meta: string[] = [];
		if (entry.characters.length) meta.push(entry.characters.join(", "));
		if (entry.places.length) meta.push(entry.places.join(", "));
		if (meta.length) {
			card.createDiv({ cls: "scribe-timeline-meta", text: meta.join(" · ") });
		}

		card.addEventListener("click", () => {
			this.app.workspace.getLeaf(false).openFile(entry.file);
		});
	}
}
