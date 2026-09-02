// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// Prints the CHANGELOG.md section body for a given version to stdout, so the
// release workflow can hand it to `gh release create --notes-file`. This is the
// same text version-tag.mjs writes into the annotated git tag; the GitHub
// release then shows it above the auto-generated "What's Changed" notes.
//
// Usage: node release-notes.mjs <version>
// Exits 0 with empty output if there is no matching "## [<version>]" section.

import { readFileSync } from "node:fs";

const version = process.argv[2] || process.env.npm_package_version;

if (!version) {
	console.error("release-notes: no version given.");
	process.exit(1);
}

let changelog = "";
try {
	changelog = readFileSync("CHANGELOG.md", "utf8");
} catch {
	process.exit(0);
}

// Sections are delimited by level-2 headings ("## [x.y.z] - date").
const section = changelog.split(/\n## /).find((part) => part.startsWith(`[${version}]`));
const body = section ? section.slice(section.indexOf("\n") + 1).trim() : "";

if (body) {
	process.stdout.write(`${body}\n`);
}
