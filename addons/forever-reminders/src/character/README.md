# character/

Services that react to what happens to the player. They ask `tick/` to look again when
something changed (`RefreshService`).

| Service | What it does |
|---|---|
| `equipment.service.ts` | A different weapon or enchant: what the weapon reminder remembered is old. |
| `aura-watch.service.ts` | Auras and casts: forgets old aura reads, remembers casts. |
| `roster.service.ts` | The party roster changed: read the party again. |
| `town-visit.service.ts` | The reagent warning when arriving in a town or an inn. |
| `blocked-action.service.ts` | The game blocked something this addon did. |
