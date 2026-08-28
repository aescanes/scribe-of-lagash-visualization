# Scribe of Lagash: Visualization

![License: GPL v3](https://img.shields.io/badge/license-GPLv3-blue.svg)
![Minimum Obsidian version](https://img.shields.io/badge/obsidian-%E2%89%A51.10.0-8b6cef)

An [Obsidian](https://obsidian.md) plugin that helps novelists visualize their
chapters and scenes. It is the first plugin in the **Scribe of Lagash**
series, a set of independent, focused tools for planning and writing novels
in Obsidian.

This plugin doesn't own your data: chapters and scenes are just regular notes
in your vault, tagged with a bit of frontmatter. The plugin reads that
frontmatter to build visualizations on top of your existing notes.

## Current features

- **Timeline view** — a standalone view (ribbon icon / command) that lists
  every chapter/scene as a chronological timeline, optionally filtered to a
  single named timeline (a novel can have more than one, e.g. "main plot" vs.
  a character's backstory). No setup required beyond tagging your notes.
- **Chapter timeline (Bases view)** — the same timeline rendering, registered
  as a view type inside Obsidian's core **Bases** plugin. Create a `.base`
  file, filter to `scribe-visualization-type = chapter` (or `scene`), optionally group by a
  property such as `scribe-visualization-timelines`, and pick "Chapter timeline" from the
  Bases view picker. Filtering, sorting, and grouping are all handled by
  Bases' own toolbar — this plugin just renders the result. Requires the core
  Bases plugin to be enabled (Settings → Core plugins).

Planned next: a matrix view for grouping chapters/scenes by character, place,
or situation (both as a standalone view and as a Bases view).

## Tagging a note as a chapter or scene

Add frontmatter like this to any note you want to appear in the
visualizations:

```yaml
---
scribe-visualization-type: chapter          # "chapter" or "scene" (required)
scribe-visualization-order: 1               # manuscript order; used to sort when no date is set
scribe-visualization-timelines: [main]      # which timeline(s) this belongs to
scribe-visualization-date: 1901-03-04       # in-story date, any free-form string
scribe-visualization-characters: [Alice, Bob]
scribe-visualization-places: [Riverside Tavern]
scribe-visualization-status: draft
---
```

Only `scribe-visualization-type` is required. Everything else is optional and simply
enables richer visualizations as you fill it in.

## Development

```bash
npm install
npm run dev    # watch build, outputs main.js
npm run build  # type-check + production build
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
