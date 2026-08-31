// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// `npm version` hook. Turns the top "## [Unreleased]" heading into a dated
// "## [<version>] - <date>" section (leaving a fresh empty "## [Unreleased]"
// above it), so every release gets its own CHANGELOG.md section — which
// version-tag.mjs then copies into the git tag message.
//
// No-op if CHANGELOG.md already has a "## [<version>]" section, or if there is
// no "## [Unreleased]" heading to promote.

import { readFileSync, writeFileSync } from "node:fs";

const version = process.env.npm_package_version;
const FILE = "CHANGELOG.md";
const MARKER = "## [Unreleased]";

let text = readFileSync(FILE, "utf8");

if (text.includes(`## [${version}]`)) {
	console.log(`version-changelog: CHANGELOG.md already has a [${version}] section.`);
	process.exit(0);
}

if (!text.includes(MARKER)) {
	console.warn(`version-changelog: no "${MARKER}" heading in CHANGELOG.md; leaving it alone.`);
	process.exit(0);
}

const date = new Date().toISOString().slice(0, 10);
text = text.replace(MARKER, `${MARKER}\n\n## [${version}] - ${date}`);
writeFileSync(FILE, text);
console.log(`version-changelog: opened CHANGELOG.md section [${version}] - ${date}`);
