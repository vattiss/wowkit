# state/

What the addon remembers between ticks, because the client hides much of it in combat (secret values).

| Service | What it remembers |
|---|---|
| `cooldown-tracker.service.ts` | Cooldowns: read while readable, started by a cast, the Classic value as a fallback; the look-ahead's assumed ones. |
| `hold-tracker.service.ts` | Holds: a DoT, a HoT or a snare is not offered again for its duration on that target. |
| `combo.service.ts` | Combo points: the client's answer or a count of builders and finishers, whichever is higher. |
| `aura-memory.service.ts` | Buffs seen or cast and debuffs put on the target, trusted until they run out; the seals count as one family. |
| `aura-reader.service.ts` | Is an aura on a unit: the game's answer, the look-ahead, the memory. Is a form active. |
| `look-ahead.service.ts` | While the queue fills, every spell it takes is assumed cast, so the next slots show what comes after. |
| `cast-state.service.ts` | The cast in progress and the last cast (the client marks spells unusable during the global cooldown). |
| `combat-errors.service.ts` | "You must be behind your target", "Your pet is dead". |
| `shot-timing.service.ts` | The Auto Shot timer and the energy tick (Classic timing without the combat log). |
| `totem-tracker.service.ts` | The totems standing, where they were dropped, their effect on the player. |
