// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 aescanes

// `npm version` postversion hook. It creates the tag with just the bare version
// number as its message; this rewrites that annotation to be the matching
// CHANGELOG.md section, so `git show <tag>` and GitHub's tag view carry the
// real release notes.
//
// Safe to no-op: if HEAD has no tag or CHANGELOG.md has no "## [<version>]"
// section, the tag keeps whatever message `npm version` (or a `-m` flag) gave
// it.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const version = process.env.npm_package_version;

const git = (args) => execFileSync("git", args, { encoding: "utf8" });

let tag;
try {
	tag = git(["describe", "--tags", "--exact-match", "HEAD"]).trim();
} catch {
	console.warn("version-tag: HEAD has no tag; nothing to annotate.");
	process.exit(0);
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

if (!body) {
	console.warn(
		`version-tag: no "## [${version}]" section in CHANGELOG.md; keeping the default tag message.`,
	);
	process.exit(0);
}

// --cleanup=verbatim: keep the notes exactly, including lines that start with
// "#" (git would otherwise strip the "### Added" / "### Fixed" sub-headings).
git(["tag", "-a", tag, "-f", "--cleanup=verbatim", "-m", `${version}\n\n${body}\n`]);
console.log(`version-tag: annotated tag ${tag} from CHANGELOG.md`);
