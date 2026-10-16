# forever-reminders

A World of Warcraft: Forever (1.60.x, TOC `16001`) addon written in TypeScript and compiled to Lua with
[TypeScriptToLua](https://github.com/TypeScriptToLua/TypeScriptToLua). The WoW API typings are generated
from Blizzard's own API documentation in [Gethe/wow-ui-source](https://github.com/Gethe/wow-ui-source/tree/forever)
(`forever` branch), so they match the client version exactly.

## In game

Reminds you of what is easy to forget while you level. It never casts anything.

- **Missing buffs**: every missing buff of your class list (Fortitude, Mark of the Wild, aspects,
  paladin auras, armors...) glows on its action button, all at once (one per group). Of a group (one aspect, one aura, one armor)
  any member counts. In combat, when the client hides auras, buffs you saw or cast are remembered.
- **Weapon buffs**: shaman imbues, rogue poisons (per hand) and warlock stones glow when missing or
  about to run out (30 s), with an alarm sound by default.
- **Not on your bars**: a message names missing buffs you have learned but put on no action bar.
- **Old ranks**: a message names every spell on your bars that is a lower rank than the one you know.
- **Party buffs** (party, not raid; out of combat): a message names the members in range who miss
  one of your buffs (Fortitude, Mark of the Wild, Arcane Intellect for mana users, your blessing),
  and its button glows. With two or more missing and the reagent in your bags, it suggests the group
  version (Prayer of Fortitude, Gift of the Wild, Arcane Brilliance; a Greater Blessing per class).
  A group version on you counts as the buff.
- **Reagents**: arriving in a town or an inn, a message names the group-buff reagents you have 5 or
  fewer of (only those your client's spells really use, read from the spell tooltip).
- Quiet while dead, mounted, on a taxi, eating, or (optionally) resting in town.

Settings (per character): *Options > AddOns > Forever Reminders*: switches per feature and per
buff, weapon buff pick, sounds, glow colors, and a debug report for bug reports.

Only Blizzard's own action bars are supported. With Bartender4, Dominos or ElvUI bars the glows are
not visible, and spells only on those bars count as "not on your action bars".

## Development

Requires Node.js 24+ (the build scripts are TypeScript run by Node directly) and, for tests, LuaJIT or another Lua 5.1.

```sh
npm install
npm run build        # -> dist/ForeverReminders/{ForeverReminders.toc,ForeverReminders.lua}
npm test             # build + run test/smoke_test.lua against a mocked WoW API
npm run typecheck
npm run watch        # rebuild on change

# copy the build into the game (then /reload)
# (the Forever beta installs into _classic_beta_)
WOW_ADDONS_DIR="C:/Program Files (x86)/World of Warcraft/_classic_beta_/Interface/AddOns" npm run deploy
```

### Layout

Diagrams of the build pipeline, the layers and the signals: [docs/architecture.md](docs/architecture.md).

```
src/            addon sources, bundled into one Lua file
  main.ts            entry point; wires the modules together
  core/              the reminder loop: game-events.ts (which event does what), refresh.ts (when to
                     look again), tick.ts, then two stages: find-reminders.ts and show-reminders.ts
  reminders/         what to remind about: missing buffs, weapon buffs, party buffs, reagents
  wow/               the only code that calls the game: spells, auras, action bars, player, party,
                     bags, clock, events, glows and notices, saved data, protected calls
  ui/                the Settings panel pages and the debug report (may call the game too)
  settings.ts        saved settings; changes go through changeSetting() and settingChanged
  data/              buff lists, weapon buffs, aura families, reagents, spell IDs
  util/              text helpers, signals
addon/          static addon files (TOC, logo); the TOC's @version@ is filled from package.json
types/
  wow-manual.d.ts   hand-written typings: script handlers, CreateFrame, string unions
  wow-framexml.d.ts hand-written typings: Settings panel API, action buttons, FrameXML globals
  generated/        generated from Blizzard's API docs - do not edit
scripts/        build, deploy, test, type-generation and check scripts
test/           Lua smoke test against a mocked client (mock_wow.lua)
```

### Rules

- **Only `src/wow/` and `src/ui/` call the game.** Reminder logic talks to `wow/` in plain terms
  (`isInCombat()`, `isLearned(spell)`) and never sees secret values, protected calls or remapped IDs.
- **Names read like English:** functions start with a verb, booleans read as questions (`isFound`).

`npm run check` enforces both and is part of `npm test`.

### WoW API typings

`types/generated/` is committed, so a normal build needs no network access. To move to a newer client build:

```sh
npm run fetch:wow-ui:latest   # sparse-clones the API docs into .cache/ and pins the new commit in package.json
npm run gen:types             # regenerates types/generated/*.d.ts
npm run typecheck
```

(`npm run fetch:wow-ui` re-fetches the commit that is already pinned.)

What gets generated from `Blizzard_APIDocumentationGenerated`:

- `C_*` namespaces and global functions (`wow-api.d.ts`), including `Constants.*`
- `Enum.*` (`wow-enums.d.ts`), structures and callback types (`wow-structures.d.ts`)
- `WowEventPayloads` / `WowEvent`: every event with its payload types (`wow-events.d.ts`)
- widget interfaces (`Frame`, `Button`, `Texture`, ...) with methods called as `obj:Method()` (`wow-widgets.d.ts`)
- `wow-unresolved.d.ts`: names the docs use but never define, typed `any` - declare them in
  `wow-manual.d.ts` or map them in `PRIMITIVES` in `scripts/generate-wow-types.ts` to tighten them up

Where the docs are wrong or incomplete (overloads such as `SetPoint("CENTER")`, `C_Timer.NewTicker`'s return
type), fix it with `SIGNATURE_OVERRIDES` in the generator or extra overloads in `wow-manual.d.ts`.

### TypeScriptToLua notes

- `noImplicitSelf` is on: plain functions and namespace functions are called with `.`, interface methods with `:`.
  Script handlers get the widget as an explicit first parameter: `frame.SetScript("OnEvent", (self, event, ...args) => ...)`.
- Use `onEvent("EVENT_NAME", handler)` from `src/wow/events.ts` for typed event payloads.
- No `RegExp`: use Lua patterns via `string.match` / `string.gsub` / `string.gmatch`.
- Arrays are Lua sequences (1-based in Lua, 0-based in TS - TSTL translates the indices).
- Globals such as SavedVariables are declared with `declare global { var Name: Type }`.
- Classes work (methods are called with `:`); pass methods as callbacks wrapped in an arrow function.
- No import cycles: the bundle's `require` does not support them. Lower layers notify upper ones
  through signals (`util/signal.ts`); `wow/`, `data/` and `util/` import nothing from the layers above.
