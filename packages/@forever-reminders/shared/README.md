# shared/

`@forever-reminders/shared`: what the reminder addons share, and the game's door (`@wowkit/wow`) does not need to know.
It depends on `@wowkit/core` and `@wowkit/wow`; the addons depend on it.

| File | What it holds |
|---|---|
| `reagents.service.ts` (+ `reagents.constants.ts`, `reagent.interface.ts`) | Does a spell need a reagent (read from its tooltip), is there one in the bags, which run low. Buff Reminder uses it for the group versions, Reagent Reminder for its message. |
| `idle.service.ts` | When the reminders keep quiet: dead, on a taxi, mounted, eating, or resting in town. The policy of Buff Reminder and Rank Reminder; the facts come from `PlayerService`. |

Put something here when two addons need it and it is about what they remind of, not about the game. If only one addon
needs it, it belongs in that addon; if it only wraps the game's API, it belongs in `@wowkit/wow`.
