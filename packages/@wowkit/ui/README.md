# ui/

`@wowkit/ui`: what an addon needs besides the game's door. It knows the settings window and the chat, not what an addon
reminds about. The shape of the settings and the texts are the addon's, given as a type parameter
(`SettingsService<MySettings>`, `LocaleService<MyTextKey>`).

| Service | What it does |
|---|---|
| `settings.service.ts` | The per-character settings, saved by the game: `get`, `change` (announces `setting.changed` on the EventBus), `getDefault`. Loads the saved values in `onAddonLoaded`, then lets the addon repair them (an optional `repair` function: a saved choice that has gone from a list, such as a sound, becomes the default again). |
| `locale.service.ts` | The addon's texts, `getText(key)`; a misspelled key does not compile. |
| `messages.service.ts`, `sounds.constants.ts` | A chat line in the addon's name; the alert sounds the player can pick (`isSoundKey` tells whether a saved choice is still in the list). |
| `greeting.service.ts` | One line in the chat at login (`onLogin`: not after a reload). |
| `options.service.ts` | Builds the addon's settings window at the first login, from an `OptionsPage` that adds its tabs, and puts only a small page with a button to it in the game's Settings panel: that panel's rows are shared by all its pages and would carry the addon's taint to the game's own (`docs/forever-quirks.md`). Opens the window a frame after it is asked for, not in a fight, and closes it when one starts. |
| `options-window.ts`, `options-tab.ts` | The window (tabs, Defaults for the tab shown, a footer row) and a tab: rows of controls, headers, texts, a highlighted box, rows that show or grey out by the state of the addon. |
| `about.section.ts` | A Help section: a button each that puts the GitHub link and the issues link in the chat box, ready to copy. |
| `controls.service.ts`, `widgets.service.ts` | The game's own checkboxes, radio choices, dropdowns and sliders, each made for this window alone and bound to the settings; a row with a button, and one with a Copy button. |
| `window-frame.ts`, `choice-menu.ts` | What every window of an addon shares (its border, Escape and the gamepad's B or Back closing it, the scroll bar shown only when needed); a button that opens a list of choices in the game's menu. |

An addon makes these in its `addon.ts` and gives them its own words and types, for example
`new SettingsService<AddonSettings>(savedVariables, addon.events, createDefaultSettings)`.

- It may call the game (windows, the Settings panel and the chat are the game's) and imports only `@wowkit/core` and
  `@wowkit/wow` (`pnpm check` enforces it).
