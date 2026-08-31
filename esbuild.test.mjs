// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// Compiles every src/**/*.test.ts to CommonJS in .test-build/ so plain
// `node --test` can run them. Reuses esbuild (already a build dependency)
// rather than adding a TypeScript-aware test runner.

import esbuild from "esbuild";
import builtins from "builtin-modules";

await esbuild.build({
	entryPoints: ["src/**/*.test.ts"],
	outdir: ".test-build",
	outbase: "src",
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
