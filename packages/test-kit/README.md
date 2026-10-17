# test-kit/

`@forever/test-kit`: the tests of an addon are written in TypeScript with `describe` / `it` / `expect`, like Jest, and
run against a **fake game**. No Lua to read or write.

- **`src/runner.ts`**: `describe`, `it`, `beforeEach`, `expect` (`toBe`, `toEqual`, `toContain`, `not`...), and `runAll`.
- **`src/world/`**: the fake game. Its functions are checked against the real API types in
  [../wow-types/](../wow-types), so a fake that no longer matches the game does not compile. One `install-*.ts` file per
  area (units, spells, bars and auras, items, ui, clock). `createWorld(setup)` gives a fresh game with the addon
  loaded and logged in; the test then changes `world.state`, fires events and moves time.
- **`src/config.ts`**: where the built addon is (set by the addon's `test/run.ts` from the command line).

How a test run works, and how to write a spec: [the addon's test README](../../addons/forever-reminders/test/README.md).
