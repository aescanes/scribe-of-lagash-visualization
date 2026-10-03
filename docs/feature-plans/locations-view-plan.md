# Implementation plan — the Locations view of StoryLines

Status: **Built.** A direct follow-up of the Characters view
([`characters-view-plan.md`](characters-view-plan.md)); every decision there
(union of note + outline with a ⚠ on conflict, alphabetical lines, ghost cards
non-clickable, "none" strip, per-tab view, StoryLines as default) applies
unchanged.

## What changed

1. **`places` → `locations`.** Frontmatter key `scribe-note-locations`
   (`FRONTMATTER_KEYS.locations`), outline column `Locations`,
   `NovelEntry.locations` / `OutlineRow.locations`. "Place" clashed with the
   verb used throughout the code (`placements`, `autoPlace`). The old
   `scribe-note-places` key (`LEGACY_PLACES_KEY`) and `Places` column are read
   as a fallback and never written.
2. **Shared model.** `views/derivedLines.ts` holds the logic that used to live in
   `charactersModel.ts`; `charactersModel` and `locationsModel` are thin
   wrappers that say where the names come from. The Characters tests pass
   unchanged.
3. **`OutlineReconciliation.fulfilledLocations`**, next to `fulfilledCharacters`.
4. **`locations` entry in `STORY_VIEWS`** (`storyViews.ts`); `lineView.ts` is untouched.

## Tests

`tests/views/locationsModel.test.ts`, the `storyViews` registry test, and an
outline-parser test for the `Locations` column and the `Places` fallback.
