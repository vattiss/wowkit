# test/

The tests are written in TypeScript with `describe` / `it` / `expect`, like Jest. No Lua to read or write.

```
npm test            # checks, builds the addon, builds the tests, runs them
npm run build:tests # only compiles the tests (TypeScript -> dist-test/tests.lua)
```

## How they run

The addon is Lua, so the tests run in Lua too: TypeScriptToLua compiles them into one file and
LuaJIT (Lua 5.1, like the game) runs it against the **built** addon (`dist/ForeverReminders`). There is no
game in the loop, so `world/` is a *fake game* that answers the addon's questions.

- **`framework.ts`**: `describe`, `it`, `beforeEach`, `expect` (`toBe`, `toEqual`, `toContain`, `not`...).
- **`world/`**: the fake game. Its functions are checked against the real API types in `types/`, so a
  fake that no longer matches the game does not compile. One `install-*.ts` file per area (units,
  spells, bars and auras, items, ui, clock). `createWorld(setup)` gives a fresh game with the addon
  loaded and logged in; the test then changes `world.state`, fires events and moves time.
- **`specs/`**: one `*.spec.ts` per class or feature. Every `it` starts from a new world (built in a
  `beforeEach`), so tests do not depend on each other. `fixtures.ts` has the classes and spells.

## Writing a test

```ts
describe("a druid with two missing buffs", () => {
    let world!: World;
    beforeEach(() => {
        world = createWorld((state) => {
            playAs(state, DRUID);
            learnSpell(state, MARK_OF_THE_WILD);
            state.bars[1] = MARK_OF_THE_WILD.id;
        });
    });

    it("sees the button glow", () => {
        expect(world.glowsOn(1)).toBe(1);
    });
});
```

A new spec file must be added to `specs/index.ts` (`npm test` fails if one is forgotten).
In a spec, the world gives: `state` (the character, bars, auras, party, bags), `fire(event)`, `advance(seconds)`,
`setOption(name, value)` (a click in the options), `glowsOn(button)`, `notice()`, `chat`, `sounds`.
