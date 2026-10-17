# ui/

`@wowkit/ui`: what an addon needs besides the game's door. It knows the Settings panel and the chat, not what an addon
reminds about. The shape of the settings and the texts are the addon's, given as a type parameter
(`SettingsService<MySettings>`, `LocaleService<MyTextKey>`).

| Service | What it does |
|---|---|
| `settings.service.ts` | The per-character settings, saved by the game: `get`, `change` (announces `setting.changed` on the EventBus), `getDefault`. Loads the saved values in `onAddonLoaded`. |
| `locale.service.ts` | The addon's texts, `getText(key)`; a misspelled key does not compile. |
| `messages.service.ts`, `sounds.constants.ts` | A chat line in the addon's name; the alert sounds the player can pick. |
| `greeting.service.ts` | One line in the chat at login (`onLogin`: not after a reload). |
| `options.service.ts` | Adds the addon's one page (an `OptionsPage` that fills a vertical layout) to the Settings panel at the first login. |
| `about.section.ts` | The Help section at the bottom of the page: a button each that puts the GitHub link and the issues link in the chat box, ready to copy. |
| `controls.service.ts`, `widgets.service.ts` | The game's own checkboxes, dropdowns and color swatches bound to the settings; a row with a Copy button. |

An addon makes these in its `addon.ts` and gives them its own words and types, for example
`new SettingsService<AddonSettings>(savedVariables, addon.events, createDefaultSettings)`.

- It may call the game (the Settings panel and the chat are the game's) and imports only `@wowkit/framework` and
  `@wowkit/wow` (`pnpm check` enforces it).
- Decisions: [0014](../../docs/decisions/0014-three-addons-and-the-ui-package.md).
