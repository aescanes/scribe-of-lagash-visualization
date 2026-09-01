# Scribe of Lagash: Visualization

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Minimum Obsidian version](https://img.shields.io/badge/obsidian-%E2%89%A51.10.0-8b6cef)

An [Obsidian](https://obsidian.md) plugin that helps novelists visualize their
chapters and scenes. It is the first plugin in the **Scribe of Lagash**
series, a set of independent, focused tools for planning and writing novels
in Obsidian.

This plugin doesn't own your prose: chapters and scenes are just regular notes
in your vault. Point the plugin at the folder that holds a book and it
recognises chapters and scenes from their titles ("Chapter 1", "Scene II",
"Prologue", …); a little `scribe-visualization-*` frontmatter is optional and
only needed to override the title or add detail. The only file the plugin ever
writes is a per-book **Lines file** that stores the book's default view.

## Current features

- **Line view** — the book's default view (ribbon icon / "Open lines" command).
  Horizontal, colored **lines** for a book, with each chapter/scene as a card
  sitting on a line. Pick "Create lines" the first time to seed a "Main line",
  then drag cards to reorder them or move them to another line, and add /
  rename / recolour / reorder / delete lines from the line headers. Changes
  save to the Lines file (`Lines.md`) automatically; `Mod+Z` undoes.

Planned next: a **chronological view** ordering chapters/scenes by their
`scribe-visualization-date`, a matrix view grouping them by character, place,
or situation, and an optional **Outline file** for planning chapters/scenes
before the notes exist. See
[docs/feature-plans/line-view-plan.md](docs/feature-plans/line-view-plan.md)
and [docs/feature-plans/outline-file-plan.md](docs/feature-plans/outline-file-plan.md).

## Setting up a book

In the plugin settings, add the vault-relative folder that holds your book's
notes under **Book folder**. The
plugin scans that folder and classifies each note by its **title**:

| Title looks like | Recognised as |
|---|---|
| `Chapter 1`, `Chapter IV`, `Ch. 12 — The Fall` | chapter (number 1, 4, 12) |
| `Scene 2`, `Scene IX` | scene |
| `Prologue`, `Epilogue`, `Interlude` | chapter (no number) |
| anything else | ignored |

English and Spanish are supported (`Capítulo 3`, `Escena II`, `Prólogo`, …) —
pick the language under **Title language** in settings. Leave **Book folder**
empty to scan the whole vault instead.

Manuscript order comes from the **folder structure** (all of `Act I/…` before
`Act II/…`) and then the number in the title. Sub-folders also become a
breadcrumb under the title on each card: a note at
`My Novel/Act I/Chapter I/Scene 1.md` (book folder `My Novel`) shows "Scene 1"
with "Act I - Chapter I" underneath.

### Optional frontmatter

None of this is required — it only adds detail the cards can show:

```yaml
---
scribe-visualization-date: 1901-03-04       # in-story date, any free-form string
scribe-visualization-characters: [Alice, Bob]
scribe-visualization-places: [Riverside Tavern]
scribe-visualization-status: draft
---
```

## Development

```bash
npm install
npm run dev    # watch build, outputs main.js
npm run build  # type-check + production build
npm test       # unit tests (Node's built-in runner; no test framework dependency)
```

### Supply-chain safety

- Every dependency in `package.json` is pinned to an exact version — no `^`/`~`
  ranges and no `latest`. `.npmrc` sets `save-exact=true` so future
  `npm install <pkg>` additions stay pinned by default.
- `.npmrc` also sets `ignore-scripts=true`, so `npm install`/`npm ci` never
  runs a dependency's `preinstall`/`install`/`postinstall` script
  automatically. The only dependency that ships one is `esbuild`, and its
  script just optimizes linking its already-installed platform binary — the
  build works fine without it. On the rare platform where it doesn't (e.g. an
  environment without a matching prebuilt `@esbuild/*` package), run
  `npm run rebuild:esbuild` to explicitly and visibly opt that one script back
  in for that single command.

To try the plugin in a vault, copy (or symlink) `manifest.json`, `main.js`,
and `styles.css` into `<vault>/.obsidian/plugins/scribe-of-lagash-visualization/`,
then enable it from Obsidian's Community Plugins settings.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for dev
setup, code conventions, and the PR process. This project follows a
[Code of Conduct](CODE_OF_CONDUCT.md). Found a security issue? See
[SECURITY.md](SECURITY.md) instead of opening a public issue.

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

[MIT](LICENSE).
