# knowledge/

What the addon knows that the game does not say: the lists, and facts about spells. The spell IDs themselves are in
[@wowkit/wow-data](../../../../packages/@wowkit/wow-data/README.md).

| File | What it holds |
|---|---|
| `lists/` | The default lists per class: the rotation by role (and the druid's forms), its AoE variant, the defense (cooldowns for low health). One file per class; `class-lists.constants.ts` is the registry. |
| `step.interface.ts` | A step (a spell of a list) and its conditions (`StepOptions`); `steps/` checks them. |
| `class-data.constants.ts` | The roles of each class, the interrupt, the purge, the cures, the racials, the totems (slot, duration, when one is worth dropping). |
| `spell-data.constants.ts` | The heals, the debuffs a target has once (another player's counts), the holds after a cast, the Classic cooldowns, the combo builders and finishers. |
| `name-keys.service.ts` | Spells are matched by name too (Forever remaps IDs, the client hides aura IDs): name keys in the client's language, built from the IDs. |
| `spell-traits.service.ts` | What kind of spell it is: helpful, harmful, a heal, a totem, a cue of its own. |

The long buffs of the Lua addon's defense lists are not here: they are Buff Reminder's.
