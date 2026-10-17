# options/

The addon's pages in the game's Settings panel. A landing page with the Reminders page and the
Debug report page under it. Like `packages/wow/src/`, this folder may call the game, because the Settings panel API is the game's.

| File | What it builds |
|---|---|
| `reminders.page.ts`, `weapon.section.ts` | The Reminders page; its weapon buff part. |
| `reminder-controls.service.ts` | The controls every reminder has, in this addon's words: a switch, and the sound and the glow color. Built on the controls of `@wowkit/ui`. |
| `debug.page.ts` | The debug report page: a text box and the Report / Clear buttons. |

The landing page, the registration of the pages and the checkboxes, dropdowns and swatches are in `@wowkit/ui`; `addon.ts` makes them with this addon's texts.

The pages only read and change settings (`change`); whoever cares reacts to `setting.changed`.
