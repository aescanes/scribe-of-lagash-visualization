// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

/** Word count of a note's body, excluding its YAML frontmatter block. */
export function countWords(content: string): number {
	const body = content.replace(FRONTMATTER_RE, "");
	const words = body.match(/\S+/g);
	return words ? words.length : 0;
}
