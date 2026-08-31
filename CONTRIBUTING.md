# Contributing

Thanks for your interest in contributing to Scribe of Lagash: Visualization.
This project is part of the **Scribe of Lagash** series — independent
Obsidian plugins that help novelists plan and write, each focused on one
concern. This particular plugin covers chapter/scene visualization
(lines and, soon, matrices).

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

Before opening a PR, make sure all of these pass:

```bash
npm run build
npm test
npx eslint src
```

Unit tests live next to the code as `*.test.ts` and cover the pure modules
(title parsing, book-layout coercion). `npm test` compiles them with esbuild —
already a build dependency — and runs them through Node's built-in test runner;
no separate test framework is pulled in.

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
- Note titles are classified by [`src/data/titleParser.ts`](src/data/titleParser.ts),
  a pure module with no Obsidian imports. Keep it that way — add new languages
  as extra entries in its pattern table, not as calls into the vault.
- The plugin writes exactly one file: the per-book Line file handled by
  [`src/data/lineFile.ts`](src/data/lineFile.ts). Never add code that writes to
  a chapter/scene note.

## Dependencies

Every dependency is pinned to an exact version (no `^`/`~`/`latest`), and
`.npmrc` disables lifecycle scripts by default (`ignore-scripts=true`). If you
add a dependency, keep both of those properties intact — see the
"Supply-chain safety" section in the README for the reasoning. Avoid adding a
dependency at all where a small amount of first-party code will do.

## Releasing

Releases are cut from `main` by a maintainer. Feature PRs must **not** bump the
version — that happens once, at release time.

1. Make sure `main` is up to date, the working tree is clean, and
   `npm run build && npm test && npx eslint src` all pass.
2. Check that `CHANGELOG.md`'s `## [Unreleased]` section lists everything in this
   release, written for a reader of `git show <tag>` — it becomes the tag
   message. You do **not** rename the heading yourself; the bump does that.
3. Bump the version — use the wrapper script for your bump size:

   ```bash
   npm run version-minor      # or version-patch / version-major
   ```

   Each wrapper runs `npm version <type> --ignore-scripts=false`. That:

   - bumps `package.json` / `package-lock.json`;
   - runs the `version` hook →
     [`version-changelog.mjs`](version-changelog.mjs) promotes
     `## [Unreleased]` to `## [<version>] - <date>` (leaving a fresh empty
     `## [Unreleased]`), then [`version-bump.mjs`](version-bump.mjs) syncs
     `manifest.json` and adds the `version → minAppVersion` line to
     `versions.json`;
   - makes one commit and an annotated tag `<version>` (no `v` prefix);
   - runs the `postversion` hook → [`version-tag.mjs`](version-tag.mjs) writes
     that new `CHANGELOG.md` section into the tag's message.

   > **Why `--ignore-scripts=false`:** `.npmrc` has `ignore-scripts=true`, which
   > otherwise suppresses the `version` / `postversion` hooks — the bump would
   > tag but skip `version-bump.mjs`, leaving `manifest.json` behind and failing
   > the release. It's safe: `npm version` installs nothing, so the flag only
   > re-enables this project's own hooks. The wrappers bake it in so you can't
   > forget.

   To set the tag message yourself instead of pulling it from the changelog,
   append `-- -m "<message>"` (`%s` expands to the version), e.g.
   `npm run version-patch -- -m "%s — hotfix for the canvas crash"`.

4. Push the commit and the tag:

   ```bash
   git push --follow-tags
   ```

The tag push triggers [`.github/workflows/release.yml`](.github/workflows/release.yml),
which builds and publishes a GitHub Release containing `main.js`,
`manifest.json`, and `styles.css`. That workflow fails the release if the tag
name doesn't match `manifest.json`'s version, so bump *before* tagging (which
`npm version` does in the right order).

If a minimum Obsidian version bump is needed, edit `minAppVersion` in
`manifest.json` before step 3 so the new `versions.json` entry records it.

## Reporting a security issue

Please don't open a public issue for a security vulnerability — see
[SECURITY.md](SECURITY.md) instead.

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By
participating, you're expected to uphold it.
