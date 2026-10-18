# wow/

`@wowkit/wow`: the door to the game. Every service here calls the Blizzard API and turns the game's
quirks (secret values, hidden auras, protected calls, remapped IDs) into plain answers in the addon's own words:
`player.isInCombat()`, `spells.isLearned(spell)`, `bags.getItemCount(item)`.

| Service | What it answers |
|---|---|
| `player.service.ts` | Combat, resting, mounted, class, equipped weapons, the spell being cast. |
| `party.service.ts` | The party members, who can receive a buff, range, name and class. |
| `bags.service.ts` | How many of an item, an item's name. |
| `spells.service.ts` (+ `spell-book.service.ts`) | Is a spell learned, its name, rank, tooltip; spells are resolved by ID, then by name through the spellbook index. Reads the spells at the first login. |
| `spell-cast.service.ts` | The player's casts, as the `player.spell-cast` event (in combat the ID is found by name). |
| `auras.service.ts` | What auras the game shows: the player's aura of a spell (by ID, then by name), or the list of a unit's auras, with what the client hid. What it means is the addon's (Buff Reminder's `BuffStateService`). |
| `action-bars.service.ts` | Which spell is on which button, and the IDs of the spells on the bars. Maps the bars at the first login. |
| `spell-refresh.service.ts`, `bar-refresh.service.ts` | Keep the spell lookups and the map of the bars fresh: after a learn, a level-up or a bar change they wait for things to settle, then refresh once (`spells.refreshed`, `bars.mapped`). |
| `weapon-enchants.service.ts` | Weapon enchants and imbues, and the weapon tooltips. |
| `glow.service.ts`, `notice.service.ts` | The glow on action buttons; sounds, chat lines, the notice. The notice is one frame shared by every addon that uses the service (`NoticeService(addonName)`): each addon owns a block of lines in it, and two messages stack instead of drawing over each other. |
| `clock.service.ts` | The game's clock and timers. |
| `saved-variables.service.ts` | The saved data of the character. |

`utils/` holds the helper functions the services share: `protected-call.utils.ts` (`attempt`, `tryCall`...) and
`secret-value.utils.ts` (`isReadable`, `getReadable`...); a helper only one service uses is a private method of that service.
`wow.constants.ts` has the game's constants. What the package asks the addon for (the name of the saved variable, the
addon's name in the shared notice) is a constructor parameter; the game's data (the spell name hints, the food and drink
IDs) comes from `@wowkit/wow-data`.

- Reminder logic never calls the game; it asks these services. `pnpm check` enforces it.
- Nothing here imports reminder logic, settings or texts: the folder is part of the toolkit and imports only
  itself and `@wowkit/core` (`pnpm check` enforces it). What the addon knows arrives as constructor parameters.
  News for the code above goes out as an event on the `EventBus`.
- Why the code is defensive: [../../docs/forever-quirks.md](../../../docs/forever-quirks.md).
