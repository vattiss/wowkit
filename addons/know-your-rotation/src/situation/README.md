# situation/

What the fight looks like now.

| Service | What it answers |
|---|---|
| `target.service.ts` | Is the target an enemy, how far, does it attack the player, its creature type, an elite, how many enemies fight the player. |
| `health.service.ts` | How hurt a unit is (100 while the client hides it), which unit a heal lands on, the smart heal threshold. |
| `range.service.ts` | Is a spell's target in range ("in", "out", "unknown"), is the target in melee range. |
| `role.service.ts` | The role (automatic or picked), the druid's form list, the AoE mode. |
| `lists.service.ts` | The rotation and defense lists in use, with the racials of the player's race. |
