# options/

The addon's page in the game's Settings panel: one main page with every control, and a Help section at the bottom. Like
`packages/@wowkit/wow/src/`, this folder may call the game, because the Settings panel API is the game's.

| File | What it builds |
|---|---|
| `reminders.page.ts`, `weapon.section.ts` | The page (an `OptionsPage` of `@wowkit/ui`): the switches per feature and per buff; its weapon buff part. |
| `reminder-controls.service.ts` | The controls every reminder has, in this addon's words: a switch, and the sound and the glow color. Built on the controls of `@wowkit/ui`. |

The registration of the page, the Help section and the checkboxes, dropdowns and swatches are in `@wowkit/ui`; `addon.ts`
makes them with this addon's texts.

The page only reads and changes settings (`change`); whoever cares reacts to `setting.changed`.
