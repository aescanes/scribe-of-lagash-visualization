// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// Compiles every tests/**/*.test.ts to CommonJS in .test-build/ so
// `node --test ".test-build/**/*.test.js"` can run them. Reuses esbuild (already a build dependency)
// rather than adding a TypeScript-aware test runner. The tests/ tree mirrors
// src/, and each spec imports its subject from ../../src/....

import esbuild from "esbuild";
import { rmSync } from "node:fs";
import { builtinModules as builtins } from "node:module";

// esbuild only ever adds to an outdir, so a renamed/deleted spec (e.g.
// tests/data/foo.test.ts -> bar.test.ts) leaves its old compiled .js behind,
// and node --test would keep running it. Start clean every time.
rmSync(".test-build", { recursive: true, force: true });

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