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

Requires Node.js 24+ (the build scripts are TypeScript run by Node directly), [pnpm](https://pnpm.io) (`npm install -g pnpm`) and, for tests, LuaJIT or another Lua 5.1.

```sh
pnpm install
pnpm build        # -> addons/forever-reminders/dist/ForeverReminders/{ForeverReminders.toc,ForeverReminders.lua}
pnpm test             # checks, build, then the tests (TypeScript, see addons/forever-reminders/test/README.md); CI runs the same
pnpm typecheck
pnpm format       # Prettier writes the code layout; pnpm test only checks it
pnpm --filter forever-reminders watch   # rebuild on change

# copy the build into the game (then /reload)
# (the Forever beta installs into _classic_beta_)
WOW_ADDONS_DIR="C:/Program Files (x86)/World of Warcraft/_classic_beta_/Interface/AddOns" pnpm --filter forever-reminders deploy:game
```

### Layout

Diagrams of the build pipeline, the features and the events: [docs/architecture.md](docs/architecture.md).
The words used in the code (buff, aura, buff category, group version...): [docs/glossary.md](docs/glossary.md).
Why the code is so defensive (the game's quirks): [docs/forever-quirks.md](docs/forever-quirks.md).
Why the project is built the way it is (decision records): [docs/decisions/](docs/decisions/README.md).
How the code is split into packages, and what a second addon would take: [docs/packages.md](docs/packages.md).
Each folder has a short README.

```
packages/       what could serve any Forever addon (packages/README.md); each imports only what it depends on
  framework/        @forever/framework: Addon (starts the services), lifecycle hooks, EventBus, @OnGameEvent,
                    @OnUnitEvent, @OnEvent, @Interval, text helpers
  wow/              @forever/wow: the door to the game: spells, auras, action bars, player, party, bags,
                    clock, glows and notices, saved variables, protected calls
  wow-types/        @forever/wow-types: the typings of Blizzard's API
    generated/        generated from Blizzard's API docs - do not edit
    wow-manual.d.ts   hand-written typings: script handlers, CreateFrame, string unions
    wow-framexml.d.ts hand-written typings: Settings panel API, action buttons, FrameXML globals
  test-kit/         @forever/test-kit: describe / it / expect and a fake game
addons/
  forever-reminders/  this addon
    src/              the addon's sources; a folder per feature
      main.ts           entry point: startAddon()
      addon.ts          makes every service with `new`, dependencies first; that order is the order of the lifecycle hooks
      settings/         the saved settings; change() announces
      locale/           the texts
      messages/         chat lines in the addon's name, alert sounds, the greeting
      knowledge/        what only this addon knows - buff categories, spell names
      reminders/        missing buffs, weapon buffs, party buffs, reagents; the buff lists
      tick/             a tick every 0.2 s - find what is due, show it; when to look sooner
      character/        what happens to the player (weapons, auras and casts, the party roster, towns, blocked actions)
      options/          the Settings panel pages
      diagnostics/      debug mode and the debug report
    addon/            static addon files (the TOC); its @version@ is filled from package.json
    assets/           logo.png: the one source of the logo; the build makes the game's icon (images/logo.tga) from it
    test/             the specs: describe / it in TypeScript against the fake game (test/README.md)
scripts/        build, deploy, type-generation and check scripts
docs/           architecture, glossary, the game's quirks, decision records
```

### Rules

- **Only a few folders call the game:** `packages/wow/src/` (what the reminders ask the game),
  `packages/framework/src/` (events and timers), `addons/forever-reminders/src/options/` (the Settings panel) and `addons/forever-reminders/src/diagnostics/`. Reminder
  logic talks to `packages/wow/src/` in plain terms (`isInCombat()`, `isLearned(spell)`) and never sees secret values,
  protected calls or remapped IDs.
- **Everything is a service, made once, by hand:** plain classes that take what they need in the constructor,
  made in `addons/forever-reminders/src/addon.ts`; no inheritance, no container; services are built from other services.
- **The packages do not know the addon:** each package imports only itself and the packages it depends on
  (`pnpm check` enforces it); `addon.ts` passes in what a package asks for (buff categories, spell names).
- **Names read like English:** functions start with a verb, booleans read as questions (`isFound`).

`pnpm check` enforces the folder and naming rules, the compiler checks the wiring in `addon.ts`;
`pnpm test` runs both.

### WoW API typings

`packages/wow-types/generated/` is committed, so a normal build needs no network access. To move to a newer client build:

```sh
pnpm fetch:wow-ui:latest   # sparse-clones the API docs into .cache/ and pins the new commit in package.json
pnpm gen:types             # regenerates packages/wow-types/generated/*.d.ts
pnpm typecheck
```

(`pnpm fetch:wow-ui` re-fetches the commit that is already pinned.)

What gets generated from `Blizzard_APIDocumentationGenerated`:

- `C_*` namespaces and global functions (`wow-api.d.ts`), including `Constants.*`
- `Enum.*` (`wow-enums.d.ts`), structures and callback types (`wow-structures.d.ts`)
- `WowEventPayloads` / `WowEvent`: every event with its payload types (`wow-events.d.ts`)
- widget interfaces (`Frame`, `Button`, `Texture`, ...) with methods called as `obj:Method()` (`wow-widgets.d.ts`)
- `wow-unresolved.d.ts`: names the docs use but never define, typed `any` - declare them in
  `wow-manual.d.ts` or map them in `PRIMITIVES` in `scripts/generate-types/knowledge.ts` to tighten them up

Where the docs are wrong or incomplete (overloads such as `SetPoint("CENTER")`, `C_Timer.NewTicker`'s return
type), fix it with `SIGNATURE_OVERRIDES` in the generator or extra overloads in `wow-manual.d.ts`.

### TypeScriptToLua notes

- `noImplicitSelf` is on: plain functions and namespace functions are called with `.`, interface methods with `:`.
  Script handlers get the widget as an explicit first parameter: `frame.SetScript("OnEvent", (self, event, ...args) => ...)`.
- Use `@OnGameEvent("EVENT_NAME")` on a method for typed event payloads (a handler with the wrong parameters does not compile).
- No `RegExp`: use Lua patterns via `string.match` / `string.gsub` / `string.gmatch`.
- A function-valued property called through `?.` (`setting?.set(x)`) is compiled as a method call and gets
  an extra `self`. Declare it with `this: void` (`set: (this: void, x: unknown) => void`) or call it without `?.`.
- A closure only sees variables declared before it; declare a variable before the function that uses it.
- Arrays are Lua sequences (1-based in Lua, 0-based in TS - TSTL translates the indices).
- Globals such as SavedVariables are declared with `declare global { var Name: Type }`.
- Classes work (methods are called with `:`); pass methods as callbacks wrapped in an arrow function.
- No import cycles: the bundle's `require` does not support them. Lower services notify upper ones
  with events on the `EventBus` (`@OnEvent`); the packages import nothing from the addon.
- Decorators (`@OnGameEvent`, `@Interval`...) need `experimentalDecorators`; a method is called as
  `instance[name](instance, ...)`. See `packages/framework/README.md`.
