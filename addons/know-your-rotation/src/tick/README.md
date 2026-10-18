# tick/

The loop. `tick.service.ts` runs every 0.2 seconds (`@Interval(200)`) and at once when something happens: it gathers
every cue (`Cues`, `cues.interface.ts`) and hands them to `glows.service.ts`, which lights the buttons in their colors and
fades the glows of hidden values. A sound plays when an interrupt or a cleanse starts to glow.

| Service | What happens |
|---|---|
| `cast-watch.service.ts` | The player cast a spell: cooldown, hold, combo points, memory, totem, the pass of the rotation, a tick. |
| `events.service.ts` | A new target, the end of a fight, death, a shapeshift, a totem slot, combo points: forget what no longer holds, tick. |
