// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { debounce, ItemView, normalizePath, Scope, TFile, WorkspaceLeaf } from "obsidian";
import type ScribeVisualizationPlugin from "../main";
import {
	emptyLineLayout,
	lineFilePath,
	migrateLegacyLineFile,
	readLineLayout,
	writeLineLayout,
} from "../data/lineFile";
import { LineLayout, NovelEntry } from "../types";
import {
	addLine,
	canvasModel,
	CanvasCard,
	cloneLayout,
	defaultLineId,
	isLayoutEmpty,
	lineOrderFromModel,
	moveCard,
	moveLine,
	recolorLine,
	reconcilePlacements,
	removeLine,
	renameLine,
	starterLayout,
} from "./canvasModel";

export const VIEW_TYPE_LINE_VIEW = "scribe-line-view";

const COLUMN_WIDTH = 220;
const DRAG_THRESHOLD = 5;
const UNDO_LIMIT = 50;
const SAVE_DEBOUNCE_MS = 700;

/** Follows the theme accent until the user recolors the line. */
const STARTER_LINE_COLOR = "var(--interactive-accent)";

interface DropTarget {
	lineId: string;
	index: number;
	rail: HTMLElement;
}

interface DragState {
	path: string;
	el: HTMLElement;
	/** Resting vertical transform of the card ("-50%" for line cards, "0px" for flow). */
	restY: string;
	startX: number;
	startY: number;
	started: boolean;
	bar: HTMLElement | null;
	onMove: (e: PointerEvent) => void;
	onUp: (e: PointerEvent) => void;
}

/**
 * The book's default view: horizontal lines with chapter/scene cards that can be
 * dragged between lines and reordered. Lines can be added, renamed, recoloured,
 * reordered, and removed. Every change is saved to the per-book Line file
 * (debounced) and can be undone with Mod+Z.
 *
 * While the view is open its in-memory `layout` is authoritative; the file is
 * only re-read on open and on book switch.
 */
export class LineView extends ItemView {
	private plugin: ScribeVisualizationPlugin;
	private unsubscribe: (() => void) | null = null;
	private book: string;
	private layout: LineLayout = emptyLineLayout();
	private fileExists = false;
	private undoStack: LineLayout[] = [];
	private cardEls = new Map<string, HTMLElement[]>();
	private drag: DragState | null = null;

	private scheduleSave = debounce(() => void this.save(), SAVE_DEBOUNCE_MS, true);

	constructor(leaf: WorkspaceLeaf, plugin: ScribeVisualizationPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.book = plugin.vaultIndex.getBookFolders()[0] ?? "";
	}

	getViewType(): string {
		return VIEW_TYPE_LINE_VIEW;
	}

	getDisplayText(): string {
		return "Lines";
	}

	getIcon(): string {
		return "chart-no-axes-gantt";
	}

	async onOpen(): Promise<void> {
		this.scope = new Scope(this.app.scope);
		this.scope.register(["Mod"], "z", () => {
			this.undo();
			return false;
		});
		this.unsubscribe = this.plugin.vaultIndex.onChange(() => this.onIndexChange());
		await this.openBook(this.plugin.vaultIndex.getBookFolders()[0] ?? "");
	}

	async onClose(): Promise<void> {
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.scheduleSave.cancel();
		await this.save();
	}

	// ---- data ----

	private linePath(): string {
		return lineFilePath(this.book, this.plugin.settings.lineFileName);
	}

	private currentEntries(): NovelEntry[] {
		return this.plugin.vaultIndex.getEntriesForBook(this.book);
	}

	private async openBook(book: string): Promise<void> {
		this.book = book;
		this.undoStack = [];

		if (this.book) {
			const path = normalizePath(this.linePath());
			await migrateLegacyLineFile(this.app, path);
			this.fileExists = this.app.vault.getAbstractFileByPath(path) instanceof TFile;
			this.layout = await readLineLayout(this.app, path);
			this.autoPlace();
		} else {
			this.fileExists = false;
			this.layout = emptyLineLayout();
		}
		this.render();
	}

	/** Adds any newly discovered chapter/scene to the default line, and saves if so. */
	private autoPlace(): void {
		if (!this.fileExists || isLayoutEmpty(this.layout)) return;
		const { layout, changed } = reconcilePlacements(
			this.layout,
			this.currentEntries().map((e) => e.file.path),
			defaultLineId(this.layout),
		);
		if (changed) {
			this.layout = layout;
			this.scheduleSave();
		}
	}

	private onIndexChange(): void {
		// Don't yank the DOM out from under an in-progress drag or a line rename.
		if (this.drag?.started || this.isEditingText()) {
			this.autoPlace();
			return;
		}

		const books = this.plugin.vaultIndex.getBookFolders();
		if (this.book && !books.includes(this.book)) {
			void this.openBook(books[0] ?? "");
			return;
		}
		this.autoPlace();
		this.render();
	}

	private isEditingText(): boolean {
		const active = this.contentEl.doc.activeElement;
		return active instanceof HTMLInputElement && this.contentEl.contains(active);
	}

	private async save(): Promise<void> {
		if (!this.book || isLayoutEmpty(this.layout)) return;
		await writeLineLayout(this.app, this.linePath(), this.layout);
	}

	private mutate(fn: (layout: LineLayout) => LineLayout): void {
		this.undoStack.push(cloneLayout(this.layout));
		if (this.undoStack.length > UNDO_LIMIT) this.undoStack.shift();
		this.layout = fn(this.layout);
		this.scheduleSave();
		this.render();
	}

	private undo(): void {
		const previous = this.undoStack.pop();
		if (!previous) return;
		this.layout = previous;
		this.scheduleSave();
		this.render();
	}

	// ---- render ----

	private render(): void {
		const root = this.contentEl;
		root.empty();
		root.addClass("scribe-canvas-view");
		this.cardEls.clear();

		const books = this.plugin.vaultIndex.getBookFolders();
		const entries = this.book ? this.currentEntries() : [];
		const viewReady =
			books.length > 0 && entries.length > 0 && this.fileExists && !isLayoutEmpty(this.layout);

		this.renderToolbar(root, books, viewReady);

		if (books.length === 0) {
			this.renderNotice(
				root,
				"Add a book folder in the plugin settings (Settings → Scribe of Lagash: Visualization) to build its lines.",
			);
			return;
		}

		if (entries.length === 0) {
			this.renderNotice(
				root,
				`No chapters or scenes found in "${this.book}". Name notes like "Chapter 1" or "Scene 2".`,
			);
			return;
		}

		if (!viewReady) {
			this.renderCreatePrompt(root, entries);
			return;
		}

		this.renderLines(root, entries);
		this.renderUnrecognized(root, entries);
	}

	private renderToolbar(root: HTMLElement, books: string[], viewReady: boolean): void {
		const toolbar = root.createDiv({ cls: "scribe-canvas-toolbar" });

		if (books.length > 1) {
			const select = toolbar.createEl("select", { cls: "dropdown" });
			for (const b of books) select.createEl("option", { text: b, value: b });
			select.value = this.book;
			select.addEventListener("change", () => void this.openBook(select.value));
		} else if (books.length === 1) {
			toolbar.createSpan({ cls: "scribe-canvas-book-name", text: books[0] });
		}

		if (!viewReady) return;

		const spacer = toolbar.createDiv({ cls: "scribe-canvas-toolbar-spacer" });
		spacer.style.flex = "1";

		const undo = toolbar.createEl("button", { text: "Undo" });
		undo.disabled = this.undoStack.length === 0;
		undo.addEventListener("click", () => this.undo());

		const add = toolbar.createEl("button", { cls: "mod-cta", text: "Add line" });
		add.addEventListener("click", () => {
			this.mutate((l) => addLine(l, `Line ${l.lines.length + 1}`, STARTER_LINE_COLOR).layout);
		});
	}

	private renderNotice(root: HTMLElement, text: string): void {
		root.createDiv({ cls: "scribe-canvas-notice" }).createEl("p", { text });
	}

	private renderCreatePrompt(root: HTMLElement, entries: NovelEntry[]): void {
		const box = root.createDiv({ cls: "scribe-canvas-notice" });
		box.createEl("p", {
			text:
				`"${this.book}" has ${entries.length} chapter/scene ` +
				`note${entries.length === 1 ? "" : "s"} but no lines yet.`,
		});
		const button = box.createEl("button", { cls: "mod-cta", text: "Create lines" });
		button.addEventListener("click", async () => {
			button.disabled = true;
			const layout = starterLayout(entries, { name: "Main line", color: STARTER_LINE_COLOR });
			await writeLineLayout(this.app, this.linePath(), layout);
			await this.openBook(this.book);
		});
	}

	private renderLines(root: HTMLElement, entries: NovelEntry[]): void {
		const model = canvasModel(entries, this.layout);

		const scroll = root.createDiv({ cls: "scribe-canvas-scroll" });
		const board = scroll.createDiv({ cls: "scribe-canvas-board" });
		board.style.setProperty("--scribe-col-width", `${COLUMN_WIDTH}px`);
		board.style.setProperty("--scribe-col-count", String(model.columnCount));

		model.lines.forEach((line, i) => {
			const lineEl = board.createDiv({ cls: "scribe-canvas-line" });
			lineEl.dataset.lineId = line.def.id;
			lineEl.style.setProperty("--scribe-line-color", line.def.color);
			this.renderLineHeader(lineEl, line.def.id, line.def.name, line.def.color, line.cards.length, {
				first: i === 0,
				last: i === model.lines.length - 1,
				only: model.lines.length === 1,
			});
			const rail = lineEl.createDiv({ cls: "scribe-canvas-line-rail" });
			for (const card of line.cards) this.renderCard(rail, card, false);
		});

		if (model.unplaced.length > 0) {
			const strip = root.createDiv({ cls: "scribe-canvas-unplaced" });
			strip.createDiv({
				cls: "scribe-canvas-unplaced-label",
				text: `Not on any line (${model.unplaced.length}) — drag onto a line`,
			});
			const rail = strip.createDiv({ cls: "scribe-canvas-unplaced-rail" });
			for (const entry of model.unplaced) this.renderCard(rail, { entry, x: 0 }, true);
		}
	}

	private renderLineHeader(
		lineEl: HTMLElement,
		id: string,
		name: string,
		color: string,
		count: number,
		pos: { first: boolean; last: boolean; only: boolean },
	): void {
		const header = lineEl.createDiv({ cls: "scribe-canvas-line-header" });

		const nameInput = header.createEl("input", {
			cls: "scribe-canvas-line-name-input",
			type: "text",
			value: name,
		});
		nameInput.addEventListener("change", () => {
			const next = nameInput.value.trim();
			if (next && next !== name) this.mutate((l) => renameLine(l, id, next));
			else nameInput.value = name;
		});

		const controls = header.createDiv({ cls: "scribe-canvas-line-controls" });

		const colorInput = controls.createEl("input", { cls: "scribe-canvas-line-color", type: "color" });
		colorInput.value = this.toHex(color);
		colorInput.addEventListener("change", () =>
			this.mutate((l) => recolorLine(l, id, colorInput.value)),
		);

		const up = controls.createEl("button", { text: "▲", attr: { "aria-label": "Move line up" } });
		up.disabled = pos.first;
		up.addEventListener("click", () => this.mutate((l) => moveLine(l, id, -1)));

		const down = controls.createEl("button", { text: "▼", attr: { "aria-label": "Move line down" } });
		down.disabled = pos.last;
		down.addEventListener("click", () => this.mutate((l) => moveLine(l, id, 1)));

		const del = controls.createEl("button", { text: "✕", attr: { "aria-label": "Delete line" } });
		del.disabled = pos.only;
		del.addEventListener("click", () => this.mutate((l) => removeLine(l, id)));

		header.createSpan({ cls: "scribe-canvas-line-count", text: `${count}` });
	}

	private renderCard(parent: HTMLElement, card: CanvasCard, flow: boolean): void {
		const { entry, x } = card;
		const el = parent.createDiv({
			cls: `scribe-canvas-card scribe-canvas-card--${entry.type}${flow ? " is-flow" : ""}`,
		});
		el.dataset.path = entry.file.path;
		if (!flow) el.style.setProperty("--scribe-card-x", String(x));

		el.createDiv({ cls: "scribe-canvas-card-dot" });
		const body = el.createDiv({ cls: "scribe-canvas-card-body" });

		body.createDiv({ cls: "scribe-canvas-card-title", text: entry.title });
		if (entry.context.length > 0) {
			body.createDiv({ cls: "scribe-canvas-card-context", text: entry.context.join(" - ") });
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
			if (this.drag) return;
			void this.app.workspace.getLeaf(false).openFile(entry.file);
		});
		el.addEventListener("pointerdown", (e) => this.onCardPointerDown(e, entry.file.path, el, flow));

		const siblings = this.cardEls.get(entry.file.path) ?? [];
		siblings.push(el);
		this.cardEls.set(entry.file.path, siblings);
		el.addEventListener("mouseenter", () => this.setLinked(entry.file.path, true));
		el.addEventListener("mouseleave", () => this.setLinked(entry.file.path, false));
	}

	private setLinked(path: string, on: boolean): void {
		const siblings = this.cardEls.get(path);
		if (!siblings || siblings.length < 2) return;
		for (const el of siblings) el.toggleClass("is-linked", on);
	}

	private renderUnrecognized(root: HTMLElement, entries: NovelEntry[]): void {
		const known = new Set(entries.map((e) => e.file.path));
		const lineFile = normalizePath(this.linePath());
		const prefix = `${this.book}/`;

		const missing = this.app.vault
			.getMarkdownFiles()
			.filter((f) => f.path.startsWith(prefix) && f.path !== lineFile && !known.has(f.path))
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

	// ---- drag ----

	private onCardPointerDown(evt: PointerEvent, path: string, el: HTMLElement, flow: boolean): void {
		if (evt.button !== 0 || this.drag) return;
		const onMove = (e: PointerEvent) => this.onDragMove(e);
		const onUp = (e: PointerEvent) => this.onDragUp(e);
		this.drag = {
			path,
			el,
			restY: flow ? "0px" : "-50%",
			startX: evt.clientX,
			startY: evt.clientY,
			started: false,
			bar: null,
			onMove,
			onUp,
		};
		const win = this.contentEl.win;
		win.addEventListener("pointermove", onMove);
		win.addEventListener("pointerup", onUp);
	}

	private onDragMove(e: PointerEvent): void {
		const drag = this.drag;
		if (!drag) return;

		const dx = e.clientX - drag.startX;
		const dy = e.clientY - drag.startY;

		if (!drag.started) {
			if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
			drag.started = true;
			drag.el.addClass("is-dragging");
		}

		// Translate from the card's resting spot — immune to any transformed /
		// `contain`ed ancestor that would offset a `position: fixed` element.
		drag.el.style.transform = `translate(${dx}px, calc(${drag.restY} + ${dy}px))`;
		this.showDrop(this.dropTarget(e.clientX, e.clientY));
	}

	private onDragUp(e: PointerEvent): void {
		const drag = this.drag;
		if (!drag) return;

		const win = this.contentEl.win;
		win.removeEventListener("pointermove", drag.onMove);
		win.removeEventListener("pointerup", drag.onUp);
		drag.bar?.remove();
		this.clearDropHighlight();

		const started = drag.started;
		const target = started ? this.dropTarget(e.clientX, e.clientY) : null;
		this.drag = null;

		if (!started) return;

		if (target) {
			const lineOrder = lineOrderFromModel(canvasModel(this.currentEntries(), this.layout));
			this.mutate((l) => moveCard(l, drag.path, target.lineId, target.index, lineOrder));
		} else {
			this.render();
		}
	}

	private dropTarget(clientX: number, clientY: number): DropTarget | null {
		const lineEls = this.contentEl.querySelectorAll<HTMLElement>(".scribe-canvas-line");
		for (const lineEl of Array.from(lineEls)) {
			const rect = lineEl.getBoundingClientRect();
			if (clientY < rect.top || clientY >= rect.bottom) continue;
			const lineId = lineEl.dataset.lineId;
			const rail = lineEl.querySelector<HTMLElement>(".scribe-canvas-line-rail");
			if (!lineId || !rail) continue;
			const relX = clientX - rail.getBoundingClientRect().left;
			const index = Math.max(0, Math.round(relX / COLUMN_WIDTH));
			return { lineId, index, rail };
		}
		return null;
	}

	private showDrop(target: DropTarget | null): void {
		if (this.drag?.bar) {
			this.drag.bar.remove();
			this.drag.bar = null;
		}
		this.clearDropHighlight();
		if (!target || !this.drag) return;

		target.rail.parentElement?.addClass("is-drop-target");
		const bar = target.rail.createDiv({ cls: "scribe-canvas-drop-bar" });
		bar.style.left = `${target.index * COLUMN_WIDTH}px`;
		this.drag.bar = bar;
	}

	private clearDropHighlight(): void {
		for (const el of Array.from(
			this.contentEl.querySelectorAll<HTMLElement>(".scribe-canvas-line.is-drop-target"),
		)) {
			el.removeClass("is-drop-target");
		}
	}

	private toHex(color: string): string {
		if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.toLowerCase();
		const probe = this.contentEl.createDiv();
		probe.style.color = color;
		const computed = this.contentEl.win.getComputedStyle(probe).color;
		probe.remove();
		const parts = computed.match(/\d+/g);
		if (!parts || parts.length < 3) return "#888888";
		return `#${parts
			.slice(0, 3)
			.map((n) => Number(n).toString(16).padStart(2, "0"))
			.join("")}`;
	}
}
