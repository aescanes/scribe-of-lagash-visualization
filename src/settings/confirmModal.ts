// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { App, Modal, Setting } from "obsidian";

interface ConfirmOptions {
	title: string;
	body: string;
	/** Label for the confirming button. */
	cta: string;
}

/**
 * A minimal yes/no modal — Obsidian ships no confirm primitive. Resolves `true`
 * only if the user clicks the CTA; closing any other way resolves `false`.
 */
export function confirm(app: App, options: ConfirmOptions): Promise<boolean> {
	return new Promise((resolve) => {
		const modal = new (class extends Modal {
			private decided = false;

			onOpen(): void {
				this.titleEl.setText(options.title);
				this.contentEl.createEl("p", { text: options.body });
				new Setting(this.contentEl)
					.addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
					.addButton((b) =>
						b
							.setButtonText(options.cta)
							.setCta()
							.onClick(() => {
								this.decided = true;
								this.close();
							}),
					);
			}

			onClose(): void {
				resolve(this.decided);
			}
		})(app);
		modal.open();
	});
}
