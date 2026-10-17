# 0014: Three addons, the ui package, and the new names

Status: accepted (2026-10-17)

## Context

`forever-reminders` was one addon with five kinds of reminder, one Settings page and one saved-variables table, built on
the packages of [0012](0012-packages.md). The owner found it too big to work on and to use as the example project, and
asked for smaller addons without the word "Forever" in their names.

## Decision

- **Three addons**, by what the player sees, each with its own TOC, its own logo, its own saved settings and its own
  specs: `buff-reminder` (missing buffs, weapon buffs, party buffs, buffs not on the bars), `rank-reminder` (spells on
  the bars at an old rank) and `reagent-reminder` (low reagents on arriving in a town or an inn). The game loads them
  as `BuffReminder`, `RankReminder` and `ReagentReminder`. The settings of the old addon (`ForeverRemindersCharDB`) are
  not carried over: each addon starts with its defaults.
- **A new package, `@wowkit/ui`**, takes what every addon needs besides the game's door, made generic so each addon
  gives its own types and words: `SettingsService<T>`, `LocaleService<K>`, `MessagesService` (the title is a
  parameter), the sounds, `GreetingService`, and for the Settings panel `OptionsService`, `HomePage`,
  `ControlsService<T>` and `WidgetsService`. It imports `@wowkit/core` and `@wowkit/wow`.
- **`@wowkit/wow` takes the game data and the upkeep that more than one addon needs:** `ReagentsService`, the spell IDs
  and the spell name hints, `SpellRefreshService` and `BarRefreshService` (the spells and the map of the bars refresh
  themselves after a burst of events and announce `spells.refreshed` and `bars.mapped`), and the first read of the
  spells and the bars at the first login (`onFirstLogin` of `SpellsService` and `ActionBarsService`).
- **The test kit gets the fixtures** (the classes and spells of the specs) and no longer knows the addon's name: the
  addon's `test/run.ts` sets it from the file name.
- **New names:** the packages are `@wowkit/*` (was `@forever/*`), the repository is `wowkit` (was `forever-reminders`).
  The word "Forever" stays where it is a fact: it is the game the addons are for.
- **`check-wiring` only looks at an addon's own services**; each addon picks the package services it needs.

## Consequences

- Each addon is small enough to read in one sitting; `rank-reminder` is the template for a new addon.
- The players install three addons instead of one; each has its own Settings page and its own copy of the bundle (the
  packages are compiled into each, [0004](0004-compiled-into-each-addon.md)). An addon that reads the action bars
  (buff-reminder, rank-reminder) does that work for itself; not measured with all three in the game.
- The party buffs of buff-reminder and the reagent warning of reagent-reminder both use `ReagentsService`, which is why it
  lives in the package.
- The GitHub repository has to be renamed by its owner; the remote address in a checkout points to the old name until
  `git remote set-url` is run (GitHub redirects the old address meanwhile).
