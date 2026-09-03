// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// Compiles every tests/**/*.test.ts to CommonJS in .test-build/ so plain
// `node --test` can run them. Reuses esbuild (already a build dependency)
// rather than adding a TypeScript-aware test runner. The tests/ tree mirrors
// src/, and each spec imports its subject from ../../src/....

import esbuild from "esbuild";
import { builtinModules as builtins } from "node:module";

await esbuild.build({
	entryPoints: ["tests/**/*.test.ts"],
	outdir: ".test-build",
	outbase: "tests",
	bundle: true,
	platform: "node",
	format: "cjs",
	target: "es2020",
	sourcemap: "inline",
	// Keep test runtime and the Obsidian API external; unit tests must not pull
	// in the real Obsidian module.
	external: ["node:*", "obsidian", ...builtins],
	logLevel: "warning",
});
