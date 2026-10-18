# test/

The specs of this addon, written in TypeScript with `describe` / `it` / `expect` from
[@wowkit/test-kit](../../../packages/@wowkit/test-kit/README.md), run by LuaJIT against the built addon (`pnpm test`; see
[Buff Reminder's test/](../../buff-reminder/test/README.md) for how they run).

The fake game has a target (`targetEnemy(state, { yards, health, isAttackingPlayer, castingSpell, debuffs, buffs })`),
the player's health, mana, combo points and cooldowns, and spells with a cast time, a range and harmful or helpful flags.
`specs/` has one file per topic; a new one is added to `specs/index.ts`.
