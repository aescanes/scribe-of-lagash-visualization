# Scribe of Lagash: Visualization

![License: GPL v3](https://img.shields.io/badge/license-GPLv3-blue.svg)
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
writes is a per-book companion file that stores your timeline layout.

## Current features

- **Timeline view** — a standalone view (ribbon icon / command) that lists
  every chapter/scene as a chronological timeline, optionally filtered to a
  single named timeline (a novel can have more than one, e.g. "main plot" vs.
  a character's backstory). No setup required beyond tagging your notes.
- **Scribe timeline (Bases view)** — the same timeline rendering, registered
  as a view type inside Obsidian's core **Bases** plugin. Create a `.base`
  file, filter to `scribe-visualization-type = chapter` (or `scene`), optionally group by a
  property such as `scribe-visualization-timelines`, and pick "Scribe timeline" from the
  Bases view picker. Filtering, sorting, and grouping are all handled by
  Bases' own toolbar — this plugin just renders the result. Requires the core
  Bases plugin to be enabled (Settings → Core plugins).

Planned next: a **draggable multi-timeline canvas** — colored timeline lanes you
lay chapters and scenes across (and a chapter can sit on more than one). See
[docs/timeline-canvas-plan.md](docs/timeline-canvas-plan.md). After that, a
matrix view grouping chapters/scenes by character, place, or situation.

## Setting up a book

In the plugin settings, add the vault-relative folder that holds your book's
notes under **Book folders** (one per line — you can track several books). The
plugin scans that folder and classifies each note by its **title**:

| Title looks like | Recognised as |
|---|---|
| `Chapter 1`, `Chapter IV`, `Ch. 12 — The Fall` | chapter (number 1, 4, 12) |
| `Scene 2`, `Scene IX` | scene |
| `Prologue`, `Epilogue`, `Interlude` | chapter (no number) |
| anything else | ignored |

English titles only for now. Leave **Book folders** empty to fall back to
scanning the whole vault for frontmatter-tagged notes instead.

Sub-folders inside the book become a breadcrumb on each card: a note at
`My Novel/Act I/Chapter I/Scene 1.md` (book folder `My Novel`) shows as
**Scene 1 (Act I - Chapter I)**.

### Overriding the title with frontmatter

Everything below is optional. Use it to fix a mis-detected note or to add
detail the visualizations can show:

```yaml
---
scribe-visualization-type: scene            # force "chapter" or "scene", overrides the title
scribe-visualization-order: 12              # override the number parsed from the title
scribe-visualization-timelines: [main]      # seed timeline membership
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

[GPL-3.0-or-later](LICENSE). If you distribute a modified version of this
plugin, your version must also be licensed under the GPL and its source made
available — you can't fold this code into a closed-source plugin.
