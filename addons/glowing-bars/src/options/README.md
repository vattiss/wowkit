# options/

The addon's settings window, in tabs, and the table of looks. Like `packages/@wowkit/wow/src/`, this folder may call the
game, because windows are the game's. The game's own Settings panel only has a small page with a button to the window:
its rows are shared by all its pages, and drawing the settings there carried the addon's taint to the game's action bar
settings (`docs/forever-quirks.md`).

| File | What it builds |
|---|---|
| `reminders.page.ts` | The page (an `OptionsPage` of `@wowkit/ui`): its tabs, in order Welcome, What's New, General, Reminders, Cooldown Manager, Bars, Messages and Help, and their words. |
| `welcome-tab.ts`, `welcome.service.ts`, `scan-report.ts` | The Welcome tab: the greeting, the scan of the action bars (on a click, its result kept, with a report to copy), the choice about Blizzard's Cooldown Manager and the settings new players trip over. It opens by itself once on each character, and once more on one that has not seen the choice; What's New waits for it. |
| `whats-new.service.ts`, `whats-new-notes.ts` | The What's New tab: the versions on the left, the notes of the one picked on the right, and whether the tab opens by itself after a minor or major release with something new. |
| `weapon.section.ts`, `glows.section.ts`, `animation.section.ts` | Parts of the tabs: the weapon buff to keep up, whether the ready cooldowns glow as a fight starts, the round buttons' animation. |
| `cooldown-manager.section.ts` | How far the addon may use Blizzard's Cooldown Manager (on the Cooldown Manager tab, and as radio choices on the Welcome tab: it counts at once, a Reload button makes it work at once), which of its windows show, and Repair Hidden Windows. |
| `bars.section.ts`, `cooldown-windows.constants.ts` | Which bars glow and which are faded until they glow: the eight bars, the Stance Bar and, under their own subtitle, each window of the Cooldown Manager. |
| `custom-sounds-section.ts` | The Custom sounds section of the table: the folders in AddOns with sounds of the player's own, and how many each has. |
| `style-table.service.ts`, `style-rows.service.ts`, `style-row-layout.ts`, `style-window.service.ts`, `table-command.ts` | The table of looks: a window with a row for each type of reminder and each spell of the class: color, glow %, message, sound. The rows are plain lists; the window draws them. `/gb` and `/gb table` open it, `/gb settings` the settings; neither opens in a fight, and both close when one starts. |
| `id-tooltip.service.ts` | The spell IDs in the spell and item tooltips (off by default; a switch on the General tab), to add a spell by its ID in the table. |
| `reminder-controls.service.ts` | The controls every reminder has, in this addon's words: a switch. Built on the controls of `@wowkit/ui`. |

The window, its tabs and controls, and the registration of its small page are in `@wowkit/ui`; `addon.ts` makes them with
this addon's texts.

The page only reads and changes settings (`change`); whoever cares reacts to `setting.changed`.
