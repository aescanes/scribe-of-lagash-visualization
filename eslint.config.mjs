// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 aescanes

import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
	{ ignores: ["main.js", ".test-build/**"] },
	js.configs.recommended,
	{
		files: ["**/*.ts", "**/*.mjs"],
		languageOptions: {
			parser: tsParser,
			sourceType: "module",
			globals: { console: "readonly", process: "readonly" },
		},
		plugins: { "@typescript-eslint": tsPlugin },
		rules: {
			...tsPlugin.configs["eslint-recommended"].overrides[0].rules,
			...tsPlugin.configs.recommended.rules,
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/ban-ts-comment": "off",
			"no-prototype-builtins": "off",
			"@typescript-eslint/no-empty-function": "off",
		},
	},
];
