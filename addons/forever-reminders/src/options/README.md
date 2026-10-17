# options/

The addon's pages in the game's Settings panel. A landing page with the Reminders page and the
Debug report page under it. Like `packages/wow/src/`, this folder may call the game, because the Settings panel API is the game's.

| File | What it builds |
|---|---|
| `options.service.ts` | Registers the pages at the first login (`onFirstLogin`); a failure is printed, never thrown. |
| `home.page.ts` | The landing page: what the addon does, links to report problems. |
| `reminders.page.ts`, `weapon.section.ts` | The Reminders page; its weapon buff part. |
| `debug.page.ts` | The debug report page: a text box and the Report / Clear buttons. |
| `controls.service.ts`, `widgets.service.ts` | The checkboxes, dropdowns and color swatches bound to the settings; a button and a link row. |

The pages only read and change settings (`SettingsService.change`); whoever cares reacts to `setting.changed`.
