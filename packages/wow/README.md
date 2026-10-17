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
| `auras.service.ts` (+ `aura-memory.service.ts`) | Is a buff on the player or a party member; the memory fills in while the client hides auras. |
| `action-bars.service.ts` (+ `action-button.ts`) | Which spell is on which button; spells at an older rank than learned. Maps the bars at the first login. |
| `spell-refresh.service.ts`, `bar-refresh.service.ts` | Keep the spell lookups and the map of the bars fresh: after a learn, a level-up or a bar change they wait for things to settle, then refresh once (`spells.refreshed`, `bars.mapped`). |
| `reagents.service.ts` (+ `reagents.constants.ts`) | Does a spell need a reagent (read from its tooltip), is there one in the bags, which run low. |
| `spell-ids.constants.ts`, `spell-name-hints.constants.ts` | The spell IDs of the buffs and group buffs of the 1.60.x client, and English names for IDs the client does not name. |
| `weapon-enchants.service.ts` | Weapon enchants and imbues, and the weapon tooltips. |
| `glow.service.ts`, `notice.service.ts` | The glow on action buttons; sounds, chat lines, the notice. |
| `clock.service.ts` | The game's clock and timers. |
| `saved-variables.service.ts` | The saved data of the character. |

`safe.ts` holds plain helper functions (`attempt`, `tryCall`, `isReadable`...): a pure function of its arguments
stays a function, it is not a service. `wow.constants.ts` has the game's constants. What the package asks the addon for (the aura
knowledge, the spell name hints, the name of the saved variable) is a constructor parameter.

- Reminder logic never calls the game; it asks these services. `pnpm check` enforces it.
- Nothing here imports reminder logic, settings or texts: the folder is part of the toolkit and imports only
  itself and `@wowkit/framework` (`pnpm check` enforces it). What the addon knows arrives as constructor parameters.
  News for the code above goes out as an event on the `EventBus`.
- Why the code is defensive: [../../docs/forever-quirks.md](../../docs/forever-quirks.md).
