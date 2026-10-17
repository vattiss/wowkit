# 0015: One page per addon, and no debug report

Status: accepted (2026-10-17)

## Context

Each addon had a landing page in the Settings panel with the reminders page (and, for buff-reminder, a debug report page)
under it, so a player clicked through two or three screens to reach a checkbox. The three addons are small. The debug
report (debug mode, samples once a second, a recorder, a report page, and the swallowed-error counter) was built to find
out what the client answers while the first addon was being written; it was never needed since.

## Decision

- **One main page per addon**: a vertical layout in the Settings panel with every control. `OptionsService` of
  `@wowkit/ui` registers it (`Settings.RegisterVerticalLayoutCategory`); the addon's page is an `OptionsPage` with
  `buildPage(category, layout)`.
- **A Help section at the bottom** (`AboutSection`): two rows with a Copy button, for the GitHub link and the issues link.
  The button puts the link in the chat box, highlighted, for Ctrl+C. The landing page text (what the addon does) is the
  `## Notes` of the TOC, which the addon list shows.
- **The debug report is gone**: the `diagnostics/` folder of buff-reminder, its page, the `isDebugMode`, `debug` and
  `blockedAction` settings, the swallowed-error listener of `@wowkit/wow` (`listenToSwallowedErrors`), `runEvery` of the
  clock and `getButtonNamesOf` of the action bars, and its spec. A blocked action is still printed in the chat once, with
  the combat state, to be reported. The boundary check no longer lists `diagnostics/`.

## Consequences

- Fewer screens and less code (the Lua of buff-reminder shrank).
- A bug report has no sampled data any more: it needs the player's description and, if needed, a new debug build.
- `SettingsService.write` (data nobody reacts to) is gone, since only the debug report used it.
- Not seen in the game yet: the vertical layout with button rows is the game's own Settings API (the Forever client has
  `CreateSettingsButtonInitializer`), but the page has been run only against the fake game.
