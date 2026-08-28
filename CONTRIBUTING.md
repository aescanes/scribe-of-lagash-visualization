# Contributing

Thanks for your interest in contributing to Scribe of Lagash: Visualization.
This project is part of the **Scribe of Lagash** series — independent
Obsidian plugins that help novelists plan and write, each focused on one
concern. This particular plugin covers chapter/scene visualization
(timelines and, soon, matrices).

## Ways to contribute

- **Bug reports** — open an issue using the bug report template.
- **Feature requests** — open an issue using the feature request template.
  Please check the README's "planned next" section and existing issues first.
- **Pull requests** — for anything beyond a small fix, open an issue first to
  discuss the approach before writing code. This avoids wasted work if the
  direction doesn't fit the project.

## Development setup

```bash
npm install
npm run dev    # watch build, outputs main.js
npm run build  # type-check + production build
```

To try your changes in a real vault, copy (or symlink) `manifest.json`,
`main.js`, and `styles.css` into
`<vault>/.obsidian/plugins/scribe-of-lagash-visualization/`, then enable the
plugin from Obsidian's Community Plugins settings. Reload the plugin (or
Obsidian) after each rebuild to pick up changes.

Before opening a PR, make sure both of these pass:

```bash
npm run build
npx eslint src --ext .ts
```

## Code conventions

- TypeScript with `strictNullChecks` on; avoid introducing `any` where a real
  type is available.
- No unrelated formatting or refactoring in the same PR as a feature/fix —
  keep diffs focused and reviewable.
- Comments should explain *why*, not *what* — only add one where the code's
  intent genuinely isn't obvious from names and structure.
- Frontmatter keys the plugin reads/writes live in
  [`src/types.ts`](src/types.ts)'s `FRONTMATTER_KEYS`, namespaced as
  `scribe-visualization-*`. Don't hardcode a frontmatter key as a string
  literal elsewhere — reference the constant, since other plugins in the
  series will use the same `scribe-` prefix with different meanings.

## Dependencies

Every dependency is pinned to an exact version (no `^`/`~`/`latest`), and
`.npmrc` disables lifecycle scripts by default (`ignore-scripts=true`). If you
add a dependency, keep both of those properties intact — see the
"Supply-chain safety" section in the README for the reasoning. Avoid adding a
dependency at all where a small amount of first-party code will do.

## Reporting a security issue

Please don't open a public issue for a security vulnerability — see
[SECURITY.md](SECURITY.md) instead.

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By
participating, you're expected to uphold it.
