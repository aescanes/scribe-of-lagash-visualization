// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

const baseTsRules = {
	...tsPlugin.configs["eslint-recommended"].overrides[0].rules,
	...tsPlugin.configs.recommended.rules,
	"no-unused-vars": "off",
	"@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
	"@typescript-eslint/no-explicit-any": "off",
	"@typescript-eslint/ban-ts-comment": "off",
	"no-prototype-builtins": "off",
	"@typescript-eslint/no-empty-function": "off",
};

export default [
	{ ignores: ["main.js", ".test-build/**"] },
	js.configs.recommended,
	{
		// Plugin source: type-aware linting, matching what Obsidian's plugin
		// review runs (no-unsafe-*, no-floating-promises, …). Needs type info,
		// so parserOptions.projectService is set.
		files: ["src/**/*.ts"],
		languageOptions: {
			parser: tsParser,
			sourceType: "module",
			parserOptions: { projectService: true },
			globals: { console: "readonly", process: "readonly" },
		},
		plugins: { "@typescript-eslint": tsPlugin },
		rules: {
			...baseTsRules,
			...tsPlugin.configs["recommended-type-checked-only"].rules,
		},
	},
	{
		// Tests and build scripts: syntax-level linting only. The type-aware
		// rules add noise here (node:test's `test()` trips no-floating-promises)
		// and this code never ships.
		files: ["tests/**/*.ts", "**/*.mjs"],
		languageOptions: {
			parser: tsParser,
			sourceType: "module",
			globals: { console: "readonly", process: "readonly" },
		},
		plugins: { "@typescript-eslint": tsPlugin },
		rules: baseTsRules,
	},
];
