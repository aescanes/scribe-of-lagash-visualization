// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	globalIgnores(["main.js", ".test-build/**"]),
	// The Obsidian team's own recommended config — the same guideline checks
	// their plugin review runs, kept current by them instead of guessed at here.
	...obsidianmd.configs.recommended,
	{
		// This repo's build/version scripts and eslint.config.mjs itself aren't
		// part of tsconfig.json's project (it only includes **/*.ts), so
		// typescript-eslint's project service needs an explicit allowance for
		// them — the same mechanism eslint-plugin-obsidianmd's own setup docs
		// use for eslint.config.*. tsconfigRootDir is pinned explicitly too, so
		// the right tsconfig.json is found even when ESLint runs from a
		// different cwd (e.g. an editor extension), matching the Obsidian
		// team's own sample-plugin config.
		languageOptions: {
			parserOptions: {
				projectService: { allowDefaultProject: ["*.mjs"] },
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		// This repo's build/version scripts run directly under Node, outside the
		// shipped plugin bundle — the recommended config only adds Node globals
		// when manifest.json's isDesktopOnly is true, since the bundle itself
		// (this plugin also targets mobile) must not depend on them.
		files: ["*.mjs"],
		languageOptions: { globals: { process: "readonly", console: "readonly" } },
	},
	{
		// Tests and these same build/version scripts never ship in the plugin
		// bundle, so two rules aimed at the shipped code don't apply: Node
		// built-ins are fine here even though the guideline they encode
		// (no-nodejs-modules) is about what the bundle imports, and node:test's
		// `test()` calls trip no-floating-promises because the test runner
		// — not this code — is what awaits them.
		files: ["tests/**/*.ts", "*.mjs"],
		rules: {
			"obsidianmd/no-nodejs-modules": "off",
			"@typescript-eslint/no-floating-promises": "off",
		},
	},
	{
		// The build/version scripts' whole job is printing to the terminal
		// (release notes, version bumps) — "avoid unnecessary console logging"
		// is guidance about the plugin that runs inside Obsidian, not about a
		// local CLI tool that never ships in the bundle.
		files: ["*.mjs"],
		rules: { "obsidianmd/rule-custom-message": "off" },
	},
	{
		// "(SL)" is this plugin's Scribe of Lagash family prefix, and
		// "StoryLines" / "Story Outline" are its own feature names — "The
		// Silent City" is the example book title used in placeholder text.
		// All are deliberately capitalized throughout the UI, so they go in
		// `brands`/`acronyms` rather than let the rule sentence-case them away.
		// Everything else in a string still gets sentence-cased normally.
		files: ["src/**/*.ts"],
		rules: {
			"obsidianmd/ui/sentence-case": [
				"warn",
				{
					enforceCamelCaseLower: true,
					acronyms: ["SL"],
					brands: ["StoryLines", "Story Outline", "The Silent City"],
				},
			],
		},
	},
]);
