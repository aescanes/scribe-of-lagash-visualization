// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { stripFrontmatter } from "./wordCount";

/**
 * The first paragraph of a note's body, for a card whose outline row has no
 * Synopsis. Pure — no Obsidian APIs. Headings, rules and comments before the
 * prose are skipped; simple Markdown (links, emphasis) is flattened to text.
 */

export const EXCERPT_MAX_CHARS = 160;

const HEADING = /^\s{0,3}#{1,6}(\s|$)/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;

function flatten(text: string): string {
	return text
		.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2")
		.replace(/\[\[([^\]]*)\]\]/g, "$1")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/(\*\*|__|~~|==)/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

export function firstParagraph(content: string, maxChars: number = EXCERPT_MAX_CHARS): string | null {
	const body = stripFrontmatter(content).replace(/%%[\s\S]*?%%/g, "").replace(/<!--[\s\S]*?-->/g, "");
	for (const block of body.split(/\r?\n\s*\r?\n/)) {
		const lines = block.split(/\r?\n/).filter((line) => !HEADING.test(line) && !RULE.test(line));
		const text = flatten(lines.join(" "));
		if (!text) continue;
		if (text.length <= maxChars) return text;
		const cut = text.slice(0, maxChars);
		const lastSpace = cut.lastIndexOf(" ");
		return `${(lastSpace > maxChars / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
	}
	return null;
}
