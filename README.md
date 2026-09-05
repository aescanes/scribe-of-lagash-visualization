# Scribe of Lagash - Visualization

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Minimum Obsidian version](https://img.shields.io/badge/obsidian-%E2%89%A51.10.0-8b6cef)

An [Obsidian](https://obsidian.md) plugin that helps novelists visualize their
chapters and scenes. It is the first plugin in the **Scribe of Lagash**
series, a set of independent, focused tools for planning and writing novels
in Obsidian.

This plugin doesn't own your prose: chapters and scenes are just regular notes
in your vault. Point the plugin at the folder that holds a book and it
recognises chapters and scenes from their titles ("Chapter 1", "Scene II",
"Prologue", …); a little `scribe-note-*` frontmatter is optional and
only needed to override the title or add detail. The only file the plugin ever
writes is a per-book **StoryLines file** that stores the book's default view.

## Current features

- **StoryLines view** — the book's default view (ribbon icon / "Open StoryLines" command).
  Horizontal, colored **lines** for a book, with each chapter/scene as a card
  sitting on a line. Pick "Create lines" the first time to seed a "Main line",
  then drag cards between lines or along the shared column grid — columns line
  up across every line by reading order, and you can leave deliberate gaps
  between cards. Dropping a card onto an occupied column nudges the others
  right. When a Story Outline is set up, an **Align cards to Story Outline **
  toolbar button snaps every card back to the outline's reading order. Add /
  rename / recolour / reorder / delete lines from the line headers. Changes save
  to the StoryLines file (`StoryLines.md`) automatically; `Mod+Z` undoes.
- **Story Outline file** *(optional)* — name a file under **Story Outline file
  name** in settings and click **Create**; it's written as an empty
  Markdown table (Act / Chapter / Scene / Line / Synopsis). The `.md` extension
  is optional — `Outline` and `Outline.md` both create `(SL) Outline.md`. Fill
  it in to plan the book before the
  notes exist: rows with no matching note appear as dashed placeholder cards
  on the StoryLines view, and clicking one creates the note (title, Synopsis,
  frontmatter) on that line. Once a note exists its Synopsis shows on the
  card; a row that disagrees with the real note/folder gets a ⚠ marker — the
  files always win. See
  [docs/feature-plans/outline-file-plan.md](docs/feature-plans/outline-file-plan.md).

Planned next: a **chronological view** ordering chapters/scenes by their
`scribe-note-date`, and a matrix view grouping them by character,
place, or situation. See
[docs/feature-plans/line-view-plan.md](docs/feature-plans/line-view-plan.md).

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

Leave **Book folder** empty to scan the whole vault instead.

### Recognised title words

The **Title language** setting picks which language's words the plugin looks for
at the **start** of a note's title. The number may be digits or a roman numeral
(`IV`), an optional `.` can follow the keyword, and matching is
case-insensitive. English (`en`) and Spanish (`es`) ship today:

| Meaning | English | Español |
|---|---|---|
| Chapter *N* | `Chapter N`, `Chap N`, `Ch N` | `Capítulo N`, `Capitulo N`, `Cap N` |
| Scene *N* | `Scene N`, `Sc N` | `Escena N`, `Esc N` |
| Chapter, no number | `Prologue`, `Epilogue`, `Interlude`, `Foreword`, `Afterword`, `Preface` | `Prólogo`, `Epílogo`, `Interludio`, `Prefacio`, `Epígrafe` |
| Act folder — the word the Story Outline file prepends to an `Act` cell when it builds a path | `Act` | `Acto` |

So with **Title language** set to Español, `Cap. 3 — La caída` is chapter 3 and
`Escena II` is scene 2. Adding a language is one more pattern table in
[`src/data/titleParser.ts`](src/data/titleParser.ts) — nothing else changes.

### Book structure

A note's place in the manuscript comes from **where it sits in folders**, not
from frontmatter. Any of these layouts works — but pick **one per book**:

| Layout | On disk (under the book folder) |
|---|---|
| Chapters as files | `Chapter 1.md`, `Chapter 2.md`, … |
| …grouped in acts | `Act I/Chapter 1.md`, `Act II/Chapter 5.md`, … |
| Chapters as folders of scenes | `Chapter 1/Scene 1.md`, `Chapter 1/Scene 2.md`, … |
| …grouped in acts | `Act I/Chapter 1/Scene 1.md`, … |
| Scenes with no chapter | `Scene 1.md`, or `Act I/Scene 1.md` |
| Deeper nesting | `Act I/Part 2/Chapter 3.md` — every folder just adds to the breadcrumb |

A scene's chapter is simply its containing folder — there is no `parent` key.
`Prologue.md` / `Epilogue.md` / `Interlude.md` can go anywhere; having no number,
they sort after the numbered notes in the same folder.

> **Don't mix "chapter as a file" and "chapter as a folder" in the same book.**
> If you do, every file-chapter sorts before any folder-chapter's scenes. Pick
> one style and convert the whole book to it.

Manuscript order is then: folder path first (all of `Act I/…` before `Act II/…`;
a numbered folder sorts by its number, so `Chapter 2/` comes before
`Chapter 10/`), then the number in the title, then the title text. Sub-folders
also show as a breadcrumb under each card — a note at
`My Novel/Act I/Chapter I/Scene 1.md` (book folder `My Novel`) shows "Scene 1"
with "Act I - Chapter I" underneath.

### Planning ahead with the Story Outline file

Set **Story Outline file name** in settings (the `.md` is optional — `Outline`
and `Outline.md` both mean `(SL) Outline.md`) and click **Create**. The
plugin writes one `(SL) <name>.md` per book folder with an empty table and a
column guide, and never touches it again.

When you plan a book in the **Story Outline file** table before writing the
notes, fill the columns that match your layout:

| Layout | Columns to fill | The row's note |
|---|---|---|
| Chapters as files | `Chapter` | `Chapter 1.md` |
| …grouped in acts | `Act` + `Chapter` | `Act I/Chapter 1.md` |
| Scenes in chapter folders | `Chapter` + `Scene` | `Chapter 1/Scene 2.md` |
| …grouped in acts | `Act` + `Chapter` + `Scene` | `Act I/Chapter 1/Scene 2.md` |
| Scenes with no chapter | `Scene` (+ optional `Act`) | `Scene 2.md` |
| Custom folder | `Folder` (overrides `Act`) | `<Folder>/Chapter 1.md` |

Numbers may be digits or roman numerals, optionally followed by free text —
e.g. a `Chapter` cell of `1 - The beginning` plans `Chapter 1 - The beginning.md`,
the same as if you'd typed that title directly. The `Act` / `Chapter` / `Scene`
words and folder names follow the **Title language** setting. `Line` is a line
name or id from the StoryLines file; `Synopsis` shows on the card and becomes
the note body when you create it. A row with neither a `Chapter` nor a `Scene`
value is ignored, and un-numbered units (`Prologue`, …) can't be planned here —
create those notes directly. The Story Outline file created for you repeats
this guide below the table.

### Optional frontmatter

None of this is required — it only adds detail the cards can show:

```yaml
---
scribe-note-date: 1901-03-04       # in-story date, any free-form string
scribe-note-characters: [Alice, Bob]
scribe-note-places: [Riverside Tavern]
scribe-note-status: draft
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

Found a bug, or have a feature request? Open one on the
[GitHub Issues page](https://github.com/aescanes/scribe-of-lagash-visualization/issues) —
there's a template for each. 

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, code conventions, and the PR
process. This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). 

Found a security issue? See [SECURITY.md](SECURITY.md) instead of opening a public
issue.

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

[MIT](LICENSE).
