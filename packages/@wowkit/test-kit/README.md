# test-kit/

`@wowkit/test-kit`: the tests of an addon are written in TypeScript with `describe` / `it` / `expect`, like Jest, and
run against a **fake game**. No Lua to read or write.

- **`src/runner.ts`**: `describe`, `it`, `beforeEach`, `expect` (`toBe`, `toEqual`, `toContain`, `not`...), and `runAll`.
- **`src/world/`**: the fake game. Its functions are checked against the real API types in
  [../wow-types/](../wow-types), so a fake that no longer matches the game does not compile. One `install-*.ts` file per
  area (units, spells, bars and auras, items, ui, clock, curves). `createWorld(setup)` gives a fresh game with the addon
  loaded and logged in; the test then changes `world.state`, fires events and moves time. For a fight there is a
  target (`targetEnemy(state, changes)`: how far, how hurt, its buffs and debuffs, what it casts, whether it attacks the
  player), the player's health, mana, combo points and cooldowns, a pet, and spells with a cast time and a range.
- **`src/world/basic-game.ts`**: `createBasicGame()`, a game with only a clock, frames and the chat, for the tests of a package (see `packages/@wowkit/core/test` and `packages/@wowkit/wow/test`); no addon needs to be loaded.
- **`src/config.ts`**: where the built addon is (set by the addon's `test/run.ts` from the command line).

How a test run works, and how to write a spec: [the addon's test README](../../../addons/glowing-bars/test/README.md).
