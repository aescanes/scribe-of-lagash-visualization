// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

/** A note's text without its YAML frontmatter block. */
export function stripFrontmatter(content: string): string {
	return content.replace(FRONTMATTER_RE, "");
}

/** Word count of a note's body, excluding its YAML frontmatter block. */
export function countWords(content: string): number {
	const body = stripFrontmatter(content);
	const words = body.match(/\S+/g);
	return words ? words.length : 0;
}
