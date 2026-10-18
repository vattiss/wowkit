# cues/

What lights up. Each cue has its own glow and color.

| Service | Cues |
|---|---|
| `rotation-queue.service.ts` | The rotation: up to three spells in list order, the first of which glows (a step first at the pull like Hunter's Mark, the racials, the cast-time opener, fillers yielding to ready actions, a needed heal first). |
| `hidden-cues.service.ts` | Steps waiting for a value the client hides (the player's or the pet's health, the target's for an execute, the mana): their glow is faded by the client. |
| `defense-cue.service.ts` | A defensive cooldown when the player's health is low. |
| `enemy-cues.service.ts` | Against the enemy target: the interrupt, the purge, the hunter's shots. |
| `support-cues.service.ts` | For the player and the group: the cleanse, the shaman's totems. |

The tick asks them all (`CueFinders` in [tick/](../tick/README.md)).
