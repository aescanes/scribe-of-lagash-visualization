// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 aescanes

import { ItemView, normalizePath, TFile, WorkspaceLeaf } from "obsidian";
import type ScribeVisualizationPlugin from "../main";
import { emptyBookLayout, timelineFilePath } from "../data/bookLayout";
import { readBookLayout, writeBookLayout } from "../data/timelineFile";
import { BookLayout, NovelEntry } from "../types";
import { canvasModel, CanvasCard, isLayoutEmpty, starterLayout } from "./canvasModel";

export const VIEW_TYPE_TIMELINE_CANVAS = "scribe-timeline-canvas";

const COLUMN_WIDTH = 220;

/** Follows the theme accent until the user recolors the lane (Phase 2). */
const STARTER_LANE_COLOR = "var(--interactive-accent)";

/**
 * Read-only timeline canvas: horizontal lanes from the book's companion file,
 * with chapter/scene cards laid out along each lane by their saved column.
 * Editing (drag, recolor, add lane) comes in Phase 2.
 */
export class TimelineCanvasView extends ItemView {
	private plugin: ScribeVisualizationPlugin;
	private unsubscribe: (() => void) | null = null;
	private book: string;
	private layout: BookLayout = emptyBookLayout();
	private fileExists = false;
	private cardsByPath = new Map<string, HTMLElement[]>();

	constructor(leaf: WorkspaceLeaf, plugin: ScribeVisualizationPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.book = plugin.vaultIndex.getBookFolders()[0] ?? "";
	}

	getViewType(): string {
		return VIEW_TYPE_TIMELINE_CANVAS;
	}

	getDisplayText(): string {
		return "Timeline canvas";
	}

	getIcon(): string {
		return "chart-no-axes-gantt";
	}

	async onOpen(): Promise<void> {
		this.unsubscribe = this.plugin.vaultIndex.onChange(() => void this.reload());
		await this.reload();
	}

	async onClose(): Promise<void> {
		this.unsubscribe?.();
		this.unsubscribe = null;
	}

	private timelinePath(): string {
		return timelineFilePath(this.book, this.plugin.settings.timelineFileName);
	}

	private async reload(): Promise<void> {
		const books = this.plugin.vaultIndex.getBookFolders();
		if (books.length > 0 && !books.includes(this.book)) this.book = books[0];

		if (this.book) {
			const path = normalizePath(this.timelinePath());
			this.fileExists = this.app.vault.getAbstractFileByPath(path) instanceof TFile;
			this.layout = await readBookLayout(this.app, path);
		} else {
			this.fileExists = false;
			this.layout = emptyBookLayout();
		}
		this.render();
	}

	private render(): void {
		const root = this.contentEl;
		root.empty();
		root.addClass("scribe-canvas-view");
		this.cardsByPath.clear();

		const books = this.plugin.vaultIndex.getBookFolders();
		this.renderToolbar(root, books);

		if (books.length === 0) {
			this.renderNotice(
				root,
				"Add a book folder in the plugin settings (Settings → Scribe of Lagash: Visualization) to build a timeline.",
			);
			return;
		}

		const entries = this.plugin.vaultIndex.getEntriesForBook(this.book);

		if (entries.length === 0) {
			this.renderNotice(
				root,
				`No chapters or scenes found in "${this.book}". Name notes like "Chapter 1" or "Scene 2", ` +
					"or add a scribe-visualization-type frontmatter field.",
			);
			return;
		}

		if (!this.fileExists || isLayoutEmpty(this.layout)) {
			this.renderCreatePrompt(root, entries);
			return;
		}

		this.renderCanvas(root, entries);
		this.renderUnrecognized(root, entries);
	}

	private renderToolbar(root: HTMLElement, books: string[]): void {
		const toolbar = root.createDiv({ cls: "scribe-canvas-toolbar" });
		if (books.length > 1) {
			const select = toolbar.createEl("select", { cls: "dropdown" });
			for (const b of books) select.createEl("option", { text: b, value: b });
			select.value = this.book;
			select.addEventListener("change", () => {
				this.book = select.value;
				void this.reload();
			});
		} else if (books.length === 1) {
			toolbar.createSpan({ cls: "scribe-canvas-book-name", text: books[0] });
		}
	}

	private renderNotice(root: HTMLElement, text: string): void {
		root.createDiv({ cls: "scribe-canvas-notice" }).createEl("p", { text });
	}

	private renderCreatePrompt(root: HTMLElement, entries: NovelEntry[]): void {
		const box = root.createDiv({ cls: "scribe-canvas-notice" });
		box.createEl("p", {
			text:
				`"${this.book}" has ${entries.length} chapter/scene ` +
				`note${entries.length === 1 ? "" : "s"} but no timeline yet.`,
		});
		const button = box.createEl("button", { cls: "mod-cta", text: "Create timeline" });
		button.addEventListener("click", async () => {
			button.disabled = true;
			const layout = starterLayout(entries, { name: "Main plot", color: STARTER_LANE_COLOR });
			await writeBookLayout(this.app, this.timelinePath(), layout);
			await this.reload();
		});
	}

	private renderCanvas(root: HTMLElement, entries: NovelEntry[]): void {
		const model = canvasModel(entries, this.layout);

		const scroll = root.createDiv({ cls: "scribe-canvas-scroll" });
		const board = scroll.createDiv({ cls: "scribe-canvas-board" });
		board.style.setProperty("--scribe-col-width", `${COLUMN_WIDTH}px`);
		board.style.setProperty("--scribe-col-count", String(model.columnCount));

		for (const lane of model.lanes) {
			const laneEl = board.createDiv({ cls: "scribe-canvas-lane" });
			laneEl.style.setProperty("--scribe-lane-color", lane.def.color);

			const header = laneEl.createDiv({ cls: "scribe-canvas-lane-header" });
			header.createSpan({ cls: "scribe-canvas-lane-name", text: lane.def.name });
			header.createSpan({ cls: "scribe-canvas-lane-count", text: String(lane.cards.length) });

			const rail = laneEl.createDiv({ cls: "scribe-canvas-lane-rail" });
			for (const card of lane.cards) this.renderCard(rail, card, false);
		}

		if (model.unplaced.length > 0) {
			const strip = root.createDiv({ cls: "scribe-canvas-unplaced" });
			strip.createDiv({
				cls: "scribe-canvas-unplaced-label",
				text: `Not on any timeline (${model.unplaced.length})`,
			});
			const rail = strip.createDiv({ cls: "scribe-canvas-unplaced-rail" });
			for (const entry of model.unplaced) this.renderCard(rail, { entry, x: 0 }, true);
		}
	}

	private renderCard(parent: HTMLElement, card: CanvasCard, flow: boolean): void {
		const { entry, x } = card;
		const el = parent.createDiv({
			cls: `scribe-canvas-card scribe-canvas-card--${entry.type}${flow ? " is-flow" : ""}`,
		});
		if (!flow) el.style.setProperty("--scribe-card-x", String(x));

		el.createDiv({ cls: "scribe-canvas-card-dot" });
		const body = el.createDiv({ cls: "scribe-canvas-card-body" });

		body.createDiv({ cls: "scribe-canvas-card-title", text: entry.title });
		if (entry.context.length > 0) {
			body.createDiv({
				cls: "scribe-canvas-card-context",
				text: entry.context.join(" - "),
			});
		}

		if (entry.date) body.createDiv({ cls: "scribe-canvas-card-date", text: entry.date });

		const meta: string[] = [];
		if (entry.characters.length > 0) meta.push(entry.characters.join(", "));
		if (entry.places.length > 0) meta.push(entry.places.join(", "));
		if (meta.length > 0) body.createDiv({ cls: "scribe-canvas-card-meta", text: meta.join(" · ") });

		if (entry.source === "frontmatter") {
			body.createSpan({ cls: "scribe-canvas-card-badge", text: "frontmatter" });
		}

		el.addEventListener("click", () => {
			void this.app.workspace.getLeaf(false).openFile(entry.file);
		});

		const siblings = this.cardsByPath.get(entry.file.path) ?? [];
		siblings.push(el);
		this.cardsByPath.set(entry.file.path, siblings);
		el.addEventListener("mouseenter", () => this.setLinked(entry.file.path, true));
		el.addEventListener("mouseleave", () => this.setLinked(entry.file.path, false));
	}

	private setLinked(path: string, on: boolean): void {
		const siblings = this.cardsByPath.get(path);
		if (!siblings || siblings.length < 2) return;
		for (const el of siblings) el.toggleClass("is-linked", on);
	}

	private renderUnrecognized(root: HTMLElement, entries: NovelEntry[]): void {
		const known = new Set(entries.map((e) => e.file.path));
		const companion = normalizePath(this.timelinePath());
		const prefix = `${this.book}/`;

		const missing = this.app.vault
			.getMarkdownFiles()
			.filter(
				(f) =>
					f.path.startsWith(prefix) && f.path !== companion && !known.has(f.path),
			)
			.sort((a, b) => a.path.localeCompare(b.path));

		if (missing.length === 0) return;

		const details = root.createEl("details", { cls: "scribe-canvas-unrecognized" });
		details.createEl("summary", {
			text: `${missing.length} note${missing.length === 1 ? "" : "s"} not recognized as a chapter or scene`,
		});
		const list = details.createEl("ul");
		for (const file of missing) {
			const link = list.createEl("li").createEl("a", { text: file.path, href: "#" });
			link.addEventListener("click", (event) => {
				event.preventDefault();
				void this.app.workspace.getLeaf(false).openFile(file);
			});
		}
	}
}
