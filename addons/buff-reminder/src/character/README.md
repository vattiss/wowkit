# character/

Services that react to what happens to the player. They ask `tick/` to look again when
something changed (`RefreshService`).

| Service | What it does |
|---|---|
| `equipment.service.ts` | A different weapon or enchant: what the weapon reminder remembered is old. |
| `buff-state.service.ts` | Is a buff up on the player or a party member: what the game shows (`AurasService` of `@wowkit/wow`), the buff categories, and the memory. |
| `buff-memory.service.ts` | Remembers the buffs seen or cast while the client hides the auras in combat, for as long as they last. |
| `aura-watch.service.ts` | Auras and casts: forgets old aura reads, remembers casts. |
| `roster.service.ts` | The party roster changed: read the party again. |
| `blocked-action.service.ts` | The game blocked something this addon did. |
