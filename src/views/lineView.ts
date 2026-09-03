// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { debounce, ItemView, Notice, normalizePath, Scope, setIcon, TFile, WorkspaceLeaf } from "obsidian";
import type ScribeVisualizationPlugin from "../main";
import { emptyLineLayout, lineFilePath, readLineLayout, writeLineLayout } from "../data/lineFile";
import { outlineLineNames, OutlineReconciliation, reconcileOutline } from "../data/outline";
import { outlineFilePath, readOutline } from "../data/outlineFile";
import { scaffoldNoteBody } from "../data/noteScaffold";
import { folderContext } from "../data/pathContext";
import { LineLayout, NovelEntry, OutlineRow, PlannedEntry } from "../types";
import {
	addLine,
	alignToOutlineOrder,
	applyPlannedPlacements,
	canvasModel,
	CanvasCard,
	cloneLayout,
	defaultLineId,
	isLayoutEmpty,
	moveCard,
	moveLine,
	randomLineColor,
	recolorLine,
	reconcilePlacements,
	removeLine,
	renameLine,
	starterLayout,
	starterLayoutFromOutline,
} from "./canvasModel";
import { confirm } from "./confirmModal";

export const VIEW_TYPE_LINE_VIEW = "scribe-line-view";

/** Custom icon for the view tab and ribbon; registered in `main.ts` via `addIcon`. */
export const LINE_ICON_ID = "scribe-lines";

/**
 * Lucide "chart-no-axes-gantt" paths, scaled from a 24-unit to a 100-unit box —
 * the content only, NOT a full `<svg>` (Obsidian wraps it in its own
 * `<svg viewBox="0 0 100 100">`). `currentColor` so the tab icon follows the
 * theme; the ribbon is tinted via the `scribe-ribbon-icon` class.
 */
export const LINE_ICON_SVG =
	`<g fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">` +
	`<path d="M25 21h50"/><path d="M17 50h42"/><path d="M50 79h33"/></g>`;

const COLUMN_WIDTH = 220;
const DRAG_THRESHOLD = 5;
const UNDO_LIMIT = 50;
const SAVE_DEBOUNCE_MS = 700;

function formatWordCount(count: number): string {
	return `${count.toLocaleString()} word${count === 1 ? "" : "s"}`;
}

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
 * reordered, and removed. Every change is saved to the per-book Lines file
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
	private outlineRows: OutlineRow[] = [];
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
		return "StoryLines";
	}

	getIcon(): string {
		return LINE_ICON_ID;
	}

	onResize(): void {
		// Card text re-wraps at the new width — re-measure so they stay uniform.
		this.equalizeCardHeights();
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

	private outlinePath(): string {
		return outlineFilePath(this.book, this.plugin.settings.outlineFileName);
	}

	private currentEntries(): NovelEntry[] {
		return this.plugin.vaultIndex.getEntriesForBook(this.book);
	}

	private reconcile(entries: NovelEntry[]): OutlineReconciliation {
		return reconcileOutline(
			this.outlineRows,
			entries,
			this.layout,
			this.book,
			this.plugin.settings.titleLanguage,
		);
	}

	private async readOutlineRows(): Promise<OutlineRow[]> {
		const path = this.outlinePath();
		return path ? readOutline(this.app, normalizePath(path)) : [];
	}

	private async openBook(book: string): Promise<void> {
		this.book = book;
		this.undoStack = [];

		if (this.book) {
			const path = normalizePath(this.linePath());
			this.fileExists = this.app.vault.getAbstractFileByPath(path) instanceof TFile;
			this.layout = await readLineLayout(this.app, path);
			this.outlineRows = await this.readOutlineRows();
			this.autoPlace();
		} else {
			this.fileExists = false;
			this.layout = emptyLineLayout();
			this.outlineRows = [];
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
		// Re-read the outline too — editing its table fires a metadata change.
		void this.refreshOutlineAndRender();
	}

	private async refreshOutlineAndRender(): Promise<void> {
		this.outlineRows = await this.readOutlineRows();
		this.autoPlace();
		this.render();
	}

	/**
	 * Outline `Line` values that Lines.md doesn't have yet, matched by id or name
	 * case-insensitively. Empty until the book has a Lines file with lines — the
	 * empty-state "Create lines from outline" prompt covers that case. The line
	 * view never adds these on its own (a typo the user then corrects would leave
	 * a stray line behind); the toolbar's refresh button applies them on demand.
	 */
	private missingOutlineLines(): string[] {
		if (!this.fileExists || isLayoutEmpty(this.layout)) return [];
		const have = new Set<string>();
		for (const line of this.layout.lines) {
			have.add(line.id.toLowerCase());
			have.add(line.name.toLowerCase());
		}
		return outlineLineNames(this.outlineRows).filter((n) => !have.has(n.toLowerCase()));
	}

	/** Adds a line for each `missingOutlineLines` name — an explicit, undoable action. */
	private createOutlineLines(): void {
		const missing = this.missingOutlineLines();
		if (missing.length === 0) return;
		this.mutate((l) => missing.reduce((acc, name) => addLine(acc, name, randomLineColor()).layout, l));
		new Notice(`Added ${missing.length} line${missing.length === 1 ? "" : "s"} from the story outline`);
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
		const hasContent = entries.length > 0 || this.outlineRows.length > 0;
		const viewReady = books.length > 0 && hasContent && this.fileExists && !isLayoutEmpty(this.layout);

		const recon = viewReady ? this.reconcile(entries) : null;

		this.renderToolbar(root, books, recon);

		if (books.length === 0) {
			this.renderNotice(
				root,
				"Add a book folder in the plugin settings (Settings → Scribe of Lagash - Visualization) to build its lines.",
			);
			return;
		}

		if (!hasContent) {
			this.renderNotice(
				root,
				`No chapters or scenes found in "${this.book}". Name notes like "Chapter 1" or "Scene 2"` +
					`${this.plugin.settings.outlineFileName ? `, or add rows to "${this.outlinePath()}"` : ""}.`,
			);
			return;
		}

		if (!viewReady || !recon) {
			this.renderCreatePrompt(root, entries);
			return;
		}

		this.renderLines(root, entries, recon);
		this.renderDiagnostics(root, entries, recon);
		this.equalizeCardHeights();
	}

	/**
	 * Grows every card to the height of the tallest, so a row of cards stays
	 * uniform. Deferred to the next frame so the measurement sees the settled
	 * layout (line-clamped summaries, a scrollbar that just appeared, web fonts)
	 * rather than the half-laid-out DOM `render()` just built.
	 */
	private equalizeCardHeights(): void {
		this.contentEl.win.requestAnimationFrame(() => {
			const cards = Array.from(this.contentEl.querySelectorAll<HTMLElement>(".scribe-canvas-card"));
			if (cards.length === 0) return;
			for (const el of cards) el.style.removeProperty("min-height");
			let tallest = 0;
			for (const el of cards) tallest = Math.max(tallest, el.offsetHeight);
			if (tallest === 0) return;
			for (const el of cards) el.style.setProperty("min-height", `${tallest}px`);
		});
	}

	private renderToolbar(root: HTMLElement, books: string[], recon: OutlineReconciliation | null): void {
		const toolbar = root.createDiv({ cls: "scribe-canvas-toolbar" });

		if (books.length > 1) {
			const select = toolbar.createEl("select", { cls: "dropdown" });
			for (const b of books) select.createEl("option", { text: b, value: b });
			select.value = this.book;
			select.addEventListener("change", () => void this.openBook(select.value));
		} else if (books.length === 1) {
			toolbar.createSpan({ cls: "scribe-canvas-book-name", text: books[0] });
		}

		if (!recon) return;

		toolbar.createDiv({ cls: "scribe-canvas-toolbar-spacer" });

		const missingLines = this.missingOutlineLines();
		if (missingLines.length > 0) {
			const label = `Add ${missingLines.length} line${missingLines.length === 1 ? "" : "s"} named in the story outline`;
			const refresh = toolbar.createEl("button", {
				cls: "scribe-canvas-refresh",
				attr: { "aria-label": label },
			});
			setIcon(refresh, "refresh-cw");
			refresh.addEventListener("click", () => this.createOutlineLines());
		}

		if (recon.planned.length > 0) {
			const n = recon.planned.length;
			const createAll = toolbar.createEl("button", {
				text: `Create ${n} planned note${n === 1 ? "" : "s"}`,
			});
			createAll.addEventListener("click", () => void this.onCreateAll());
		}

		if (this.outlineRows.length > 0) {
			const align = toolbar.createEl("button", {
				text: "Align cards to Story Outline ",
				attr: { "aria-label": "Reset every card to its column and line in the Story Outline" },
			});
			align.addEventListener("click", () => {
				this.mutate((l) => alignToOutlineOrder(l, this.currentEntries(), recon));
			});
		}

		const undo = toolbar.createEl("button", { text: "Undo" });
		undo.disabled = this.undoStack.length === 0;
		undo.addEventListener("click", () => this.undo());

		const add = toolbar.createEl("button", { cls: "mod-cta", text: "Add line" });
		add.addEventListener("click", () => {
			this.mutate((l) => addLine(l, `Line ${l.lines.length + 1}`, randomLineColor()).layout);
		});
	}

	private renderNotice(root: HTMLElement, text: string): void {
		root.createDiv({ cls: "scribe-canvas-notice" }).createEl("p", { text });
	}

	private renderCreatePrompt(root: HTMLElement, entries: NovelEntry[]): void {
		const outlineLines = outlineLineNames(this.outlineRows);
		const fromOutline = outlineLines.length > 0;

		const box = root.createDiv({ cls: "scribe-canvas-notice" });
		box.createEl("p", {
			text:
				(entries.length === 0
					? `"${this.book}" has a story outline but no lines yet.`
					: `"${this.book}" has ${entries.length} chapter/scene ` +
						`note${entries.length === 1 ? "" : "s"} but no lines yet.`) +
				(fromOutline
					? ` The story outline names ${outlineLines.length} line${outlineLines.length === 1 ? "" : "s"} to start from.`
					: ""),
		});
		const button = box.createEl("button", {
			cls: "mod-cta",
			text: fromOutline ? "Create lines from story outline" : "Create lines",
		});
		button.addEventListener("click", () => {
			button.disabled = true;
			const layout = fromOutline
				? starterLayoutFromOutline(entries, this.outlineRows, this.book, this.plugin.settings.titleLanguage)
				: starterLayout(entries, { name: "Main line", color: randomLineColor() });
			void (async () => {
				await writeLineLayout(this.app, this.linePath(), layout);
				await this.openBook(this.book);
			})();
		});
	}

	private renderLines(root: HTMLElement, entries: NovelEntry[], recon: OutlineReconciliation): void {
		const model = canvasModel(entries, this.layout, recon);

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

		if (model.unplaced.length > 0 || model.plannedUnplaced.length > 0) {
			const strip = root.createDiv({ cls: "scribe-canvas-unplaced" });
			strip.createDiv({
				cls: "scribe-canvas-unplaced-label",
				text: `Not on any line — drag a card onto a line${
					model.plannedUnplaced.length > 0 ? " (story outline rows without a valid line included)" : ""
				}`,
			});
			const rail = strip.createDiv({ cls: "scribe-canvas-unplaced-rail" });
			for (const entry of model.unplaced) {
				this.renderCard(rail, { kind: "real", entry, planned: null, x: 0, summary: null, mark: null }, true);
			}
			for (const p of model.plannedUnplaced) {
				this.renderCard(
					rail,
					{
						kind: "planned",
						entry: null,
						planned: p,
						x: 0,
						summary: p.row.summary || null,
						mark: recon.marks[p.expectedPath] ?? null,
					},
					true,
				);
			}
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

		const nameRow = header.createDiv({ cls: "scribe-canvas-line-name-row" });
		const nameEl = nameRow.createDiv({ cls: "scribe-canvas-line-name", text: name });
		nameEl.tabIndex = 0;
		nameEl.setAttr("role", "button");
		nameEl.setAttr("aria-label", "Rename line");
		nameEl.addEventListener("click", () => this.editLineName(nameRow, id, name));
		nameEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				this.editLineName(nameRow, id, name);
			}
		});
		const countEl = nameRow.createSpan({
			cls: "scribe-canvas-line-count",
			attr: { "aria-label": `${count} card${count === 1 ? "" : "s"}` },
		});
		setIcon(countEl.createSpan({ cls: "scribe-canvas-line-count-icon" }), "layers");
		countEl.createSpan({ text: String(count) });

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
	}

	/**
	 * Swaps the line-name text (and its count) for a full-width input; commits
	 * on blur / Enter, reverts on Escape. Both paths re-render, restoring the
	 * text + count.
	 */
	private editLineName(nameRow: HTMLElement, id: string, name: string): void {
		nameRow.empty();
		const input = nameRow.createEl("input", {
			cls: "scribe-canvas-line-name-input",
			type: "text",
			value: name,
		});
		input.focus();
		input.select();

		let done = false;
		const finish = (commit: boolean): void => {
			if (done) return;
			done = true;
			const next = input.value.trim();
			if (commit && next && next !== name) this.mutate((l) => renameLine(l, id, next));
			else this.render();
		};
		input.addEventListener("blur", () => finish(true));
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") input.blur();
			else if (e.key === "Escape") finish(false);
		});
	}

	private renderCard(parent: HTMLElement, card: CanvasCard, flow: boolean): void {
		if (card.kind === "planned" && card.planned) {
			this.renderPlannedCard(parent, card.planned, card.x, card.summary, card.mark, flow);
			return;
		}
		if (card.entry) this.renderRealCard(parent, card, flow);
	}

	private renderRealCard(parent: HTMLElement, card: CanvasCard, flow: boolean): void {
		const entry = card.entry as NovelEntry;
		const el = parent.createDiv({
			cls: `scribe-canvas-card scribe-canvas-card--${entry.type}${flow ? " is-flow" : ""}`,
		});
		el.dataset.path = entry.file.path;
		if (!flow) el.style.setProperty("--scribe-card-x", String(card.x));

		el.createDiv({ cls: "scribe-canvas-card-dot" });
		const body = el.createDiv({ cls: "scribe-canvas-card-body" });

		const title = body.createDiv({ cls: "scribe-canvas-card-title", text: entry.title });
		if (card.mark) {
			title.createSpan({ cls: "scribe-canvas-card-mark", text: " ⚠", attr: { "aria-label": card.mark } });
		}
		if (entry.context.length > 0) {
			body.createDiv({ cls: "scribe-canvas-card-context", text: entry.context.join(" - ") });
		}
		if (entry.date) body.createDiv({ cls: "scribe-canvas-card-date", text: entry.date });
		if (card.summary) body.createDiv({ cls: "scribe-canvas-card-summary", text: card.summary });

		const meta: string[] = [];
		if (entry.characters.length > 0) meta.push(entry.characters.join(", "));
		if (entry.places.length > 0) meta.push(entry.places.join(", "));
		if (meta.length > 0) body.createDiv({ cls: "scribe-canvas-card-meta", text: meta.join(" · ") });

		body.createDiv({ cls: "scribe-canvas-card-wordcount", text: formatWordCount(entry.wordCount) });

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

	/** A ghost card for a planned outline row whose note doesn't exist yet. */
	private renderPlannedCard(
		parent: HTMLElement,
		planned: PlannedEntry,
		x: number,
		summary: string | null,
		mark: string | null,
		flow: boolean,
	): void {
		const el = parent.createDiv({
			cls: `scribe-canvas-card scribe-canvas-card--planned${flow ? " is-flow" : ""}`,
		});
		el.dataset.path = planned.expectedPath;
		if (!flow) el.style.setProperty("--scribe-card-x", String(x));

		el.createDiv({ cls: "scribe-canvas-card-dot" });
		const body = el.createDiv({ cls: "scribe-canvas-card-body" });

		const title = body.createDiv({ cls: "scribe-canvas-card-title", text: planned.label });
		if (mark) {
			title.createSpan({ cls: "scribe-canvas-card-mark", text: " ⚠", attr: { "aria-label": mark } });
		}
		const context = folderContext(planned.expectedPath, this.book);
		if (context.length > 0) {
			body.createDiv({ cls: "scribe-canvas-card-context", text: context.join(" - ") });
		}
		if (summary) body.createDiv({ cls: "scribe-canvas-card-summary", text: summary });
		body.createDiv({ cls: "scribe-canvas-card-create", text: "＋ Create note" });

		el.setAttr("aria-label", `Create note "${planned.expectedPath}"`);
		el.addEventListener("click", () => {
			if (this.drag) return;
			void this.onCreateOne(planned);
		});
		// Draggable like a real card: dropping it writes a placement keyed by the
		// note's future path, so the arrangement sticks before the note exists.
		el.addEventListener("pointerdown", (e) => this.onCardPointerDown(e, planned.expectedPath, el, flow));
	}

	private setLinked(path: string, on: boolean): void {
		const siblings = this.cardEls.get(path);
		if (!siblings || siblings.length < 2) return;
		for (const el of siblings) el.toggleClass("is-linked", on);
	}

	// ---- creating notes from planned rows ----

	private async onCreateOne(planned: PlannedEntry): Promise<void> {
		const ok = await confirm(this.app, {
			title: "Create note",
			body: `Create "${planned.expectedPath}"${planned.lineId ? " and place it on this line" : ""}?`,
			cta: "Create",
		});
		if (ok) await this.createPlanned(new Set([planned.expectedPath]));
	}

	private async onCreateAll(): Promise<void> {
		const paths = this.reconcile(this.currentEntries()).planned.map((p) => p.expectedPath);
		if (paths.length === 0) return;
		const ok = await confirm(this.app, {
			title: "Create all planned notes",
			body: `Create ${paths.length} note${paths.length === 1 ? "" : "s"} from the outline? Notes that already exist are left alone.`,
			cta: "Create all",
		});
		if (ok) await this.createPlanned(new Set(paths));
	}

	/**
	 * Creates the notes for `wanted` planned rows (parent folders and a starter
	 * scaffold), seeds each a placement at the slot its ghost card held, then
	 * rebuilds the index so they show as real cards.
	 */
	private async createPlanned(wanted: Set<string>): Promise<void> {
		const entries = this.currentEntries();
		const recon = this.reconcile(entries);
		// Model with the ghosts still present, so we know where each one sat.
		const ghostModel = canvasModel(entries, this.layout, recon);
		const targets = recon.planned.filter((p) => wanted.has(p.expectedPath));

		const created = new Set<string>();
		let opened: TFile | null = null;
		for (const p of targets) {
			const path = normalizePath(p.expectedPath);
			if (this.app.vault.getAbstractFileByPath(path)) continue;

			const slash = path.lastIndexOf("/");
			const dir = slash === -1 ? "" : path.slice(0, slash);
			if (dir && !this.app.vault.getAbstractFileByPath(dir)) {
				try {
					await this.app.vault.createFolder(dir);
				} catch {
					// A parent may have appeared from a sibling in the same batch.
				}
			}
			try {
				opened = await this.app.vault.create(path, scaffoldNoteBody(p));
				created.add(p.expectedPath);
			} catch (e) {
				new Notice(`Couldn't create "${path}": ${e instanceof Error ? e.message : e}`);
			}
		}
		if (created.size === 0) return;

		if (!isLayoutEmpty(this.layout)) {
			this.mutate((l) => applyPlannedPlacements(l, ghostModel, created));
		}
		// Pick the new notes up now rather than waiting for the debounced scan.
		void this.plugin.vaultIndex.rebuild();

		if (targets.length === 1 && opened) {
			await this.app.workspace.getLeaf(false).openFile(opened);
		}
	}

	private renderDiagnostics(root: HTMLElement, entries: NovelEntry[], recon: OutlineReconciliation): void {
		const known = new Set(entries.map((e) => e.file.path));
		const lineFile = normalizePath(this.linePath());
		const outlineFile = this.outlinePath() ? normalizePath(this.outlinePath()) : null;
		const prefix = `${this.book}/`;

		const unrecognized = this.app.vault
			.getMarkdownFiles()
			.filter(
				(f) =>
					f.path.startsWith(prefix) &&
					f.path !== lineFile &&
					f.path !== outlineFile &&
					!known.has(f.path),
			)
			.sort((a, b) => a.path.localeCompare(b.path));

		this.renderFileList(
			root,
			unrecognized.map((f) => f.path),
			(n) => `${n} note${n === 1 ? "" : "s"} not recognized as a chapter or scene`,
		);

		if (this.outlineRows.length > 0) {
			const orphans = entries
				.filter((e) => !recon.fulfilledPaths.includes(e.file.path))
				.map((e) => e.file.path)
				.sort((a, b) => a.localeCompare(b));
			this.renderFileList(
				root,
				orphans,
				(n) => `${n} note${n === 1 ? "" : "s"} not in the outline`,
			);
		}

		if (recon.unknownLines.length > 0) {
			this.renderNotice(
				root,
				`These story outline lines aren't in "${this.linePath()}" yet: ${recon.unknownLines.join(", ")}. ` +
					`Use the refresh button in the toolbar to add them, or fix the Line cell.`,
			);
		}
	}

	private renderFileList(root: HTMLElement, paths: string[], summary: (n: number) => string): void {
		if (paths.length === 0) return;
		const details = root.createEl("details", { cls: "scribe-canvas-unrecognized" });
		details.createEl("summary", { text: summary(paths.length) });
		const list = details.createEl("ul");
		for (const path of paths) {
			const link = list.createEl("li").createEl("a", { text: path, href: "#" });
			link.addEventListener("click", (event) => {
				event.preventDefault();
				const file = this.app.vault.getAbstractFileByPath(path);
				if (file instanceof TFile) void this.app.workspace.getLeaf(false).openFile(file);
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
			this.mutate((l) => moveCard(l, drag.path, target.lineId, target.index));
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
			// The column slot the pointer sits in — drop lands the card there.
			const index = Math.max(0, Math.floor(relX / COLUMN_WIDTH));
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
		// Width comes from the CSS var; only the slot offset is dynamic.
		bar.style.setProperty("left", `${target.index * COLUMN_WIDTH}px`);
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
