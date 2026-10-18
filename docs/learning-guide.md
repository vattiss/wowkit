# Learning guide: your first addon

You will write **Target Reminder**, an addon that shows a notice when you are fighting without a target. It is small
on purpose: one service, about thirty lines of TypeScript, and it touches every part of the toolkit that matters.
Do [Getting started](getting-started.md) first, so that `pnpm build` works.

## The idea in one minute

An addon here is a set of **services**. A service is a plain class. It asks for the services it needs in its
constructor, and it says what makes it run with a decorator on a method:

- `@Interval(1000)` runs the method every second,
- `@OnGameEvent("PLAYER_DEAD")` runs it when the game fires that event,
- `@OnEvent("spells.invalidated")` runs it when another service announces something.

A service never calls the game itself. It asks a service of `@wowkit/wow` ("is the player in combat?"), which is the
only door to the game. A file called `addon.ts` makes every service with `new` and hands them to the `Addon`. That
is all the wiring there is. The reasons are in [Architecture](architecture.md).

## 1. Make the folder

An addon is a folder under `addons/`:

```
addons/target-reminder/
    package.json
    tsconfig.json
    addon/TargetReminder.toc
    src/main.ts
    src/addon.ts
    src/target-notice.service.ts
```

The quickest start is to copy [`addons/rank-reminder`](https://github.com/vattiss/wowkit/tree/main/addons/rank-reminder),
delete what you do not need and rename. The files below are what is left of it.

## 2. Describe the package

`package.json` names the package and the folder the game will load. The `addon.name` is also the name of the Lua
file the build makes.

```json [addons/target-reminder/package.json]
{
  "name": "@forever-reminders/target-reminder",
  "version": "1.0.0",
  "private": true,
  "license": "MIT",
  "addon": { "name": "TargetReminder" },
  "scripts": {
    "build": "tstl -p tsconfig.json && node ../../scripts/package-addon.ts",
    "deploy:game": "pnpm build && node ../../scripts/deploy.ts"
  },
  "dependencies": {
    "@wowkit/core": "workspace:*",
    "@wowkit/wow": "workspace:*"
  },
  "devDependencies": {
    "@wowkit/wow-types": "workspace:*"
  }
}
```

Run `pnpm install` once after adding it, so that pnpm links the workspace packages.

## 3. Tell TypeScriptToLua what to build

`tsconfig.json` is the longest file and you copy it rather than write it. The parts that matter: `paths` points the
`@wowkit/*` imports at the sources of the packages, so they are compiled into your addon, and `luaBundle` makes one
Lua file, because the game has no `require`.

```json [addons/target-reminder/tsconfig.json]
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["ESNext"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["lua-types/5.1", "@typescript-to-lua/language-extensions"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "experimentalDecorators": true,
    "paths": {
      "@wowkit/core": ["../../packages/@wowkit/core/src/index.ts"],
      "@wowkit/core/*": ["../../packages/@wowkit/core/src/*"],
      "@wowkit/wow": ["../../packages/@wowkit/wow/src/index.ts"],
      "@wowkit/wow-data": ["../../packages/@wowkit/wow-data/src/index.ts"]
    },
    "rootDir": "../..",
    "outDir": "dist/TargetReminder"
  },
  "include": [
    "src/**/*.ts",
    "../../packages/@wowkit/core/src/**/*.ts",
    "../../packages/@wowkit/wow/src/**/*.ts",
    "../../packages/@wowkit/wow-data/src/**/*.ts",
    "../../packages/@wowkit/wow-types/**/*.d.ts"
  ],
  "tstl": {
    "luaTarget": "5.1",
    "luaBundle": "TargetReminder.lua",
    "luaBundleEntry": "src/main.ts",
    "luaLibImport": "require-minimal",
    "noImplicitSelf": true,
    "noHeader": true
  }
}
```

`luaTarget` is 5.1 because that is the Lua the game embeds.

## 4. Write the TOC

The TOC is the file the game reads first. `@version@` is filled from `package.json` by the build.

```text [addons/target-reminder/addon/TargetReminder.toc]
## Interface: 16001
## AllowLoadGameType: camelot
## Title: Target Reminder
## Notes: Tells you when you are fighting without a target.
## Version: @version@

TargetReminder.lua
```

## 5. The entry point

The game gives every file of an addon the addon's folder name as its first argument. `main.ts` reads it and starts
the addon.

```ts [src/main.ts]
import { startAddon } from "./addon";

// The game gives every file of an addon the addon's folder name as its first argument; `[...$vararg]` reads it.
const [addonName] = [...$vararg];

startAddon(addonName!);
```

## 6. The service

This is the addon. Read it top to bottom: what it needs (the constructor), when it runs (`@Interval`), what it does
(the body).

```ts [src/target-notice.service.ts]
import { Interval } from "@wowkit/core";
import type { NoticeService, PlayerService } from "@wowkit/wow";

export class TargetNoticeService {
    constructor(
        private readonly player: PlayerService,
        private readonly notice: NoticeService,
    ) {}

    /** Once a second: in combat and nothing targeted? Say so. */
    @Interval(1000)
    showNoticeIfNoTarget(): void {
        if (this.player.isInCombat() && !this.player.hasTarget()) this.notice.showNotice("You have no target.");
    }
}
```

`PlayerService` and `NoticeService` are imported as **types**: the service does not make them, it is given them. The
name of the method starts with a verb, because `pnpm check` insists.

## 7. The wiring

`addon.ts` makes every service, the ones that are needed first. The order of the lines is also the order the
lifecycle hooks run in.

```ts [src/addon.ts]
import { Addon } from "@wowkit/core";
import { NoticeService, PlayerService } from "@wowkit/wow";
import { TargetNoticeService } from "./target-notice.service";

export function startAddon(addonName: string): void {
    const addon = new Addon(addonName);
    const player = addon.register(new PlayerService());
    const notice = addon.register(new NoticeService(addonName));
    addon.register(new TargetNoticeService(player, notice));
    addon.start();
}
```

If you wrote `new TargetNoticeService(player, notice)` before `notice` exists, it would not compile. That is the
whole dependency system.

## 8. Build and run

```sh
pnpm install
pnpm --filter @forever-reminders/target-reminder deploy:game
```

Then `/reload` in the game, pull a monster and press Escape to clear your target. The notice appears in the upper
middle of the screen and goes out by itself after ten seconds.

## Where to go next

Your addon works, but it is not yet a *good* addon. The real ones also have these, and each is a small step:

| Add | How | Look at |
|---|---|---|
| A way to turn it off | `SettingsService`, a settings page and saved variables per character | [`rank-reminder/src/settings`](https://github.com/vattiss/wowkit/tree/main/addons/rank-reminder/src/settings) and [`options`](https://github.com/vattiss/wowkit/tree/main/addons/rank-reminder/src/options) |
| Texts in one place | A `TEXTS` object and `LocaleService` | [`rank-reminder/src/locale`](https://github.com/vattiss/wowkit/tree/main/addons/rank-reminder/src/locale) |
| Silence in towns, while dead or mounted | `IdleService` of `@forever-reminders/shared` | [`rank-notice.service.ts`](https://github.com/vattiss/wowkit/blob/main/addons/rank-reminder/src/rank-notice.service.ts) |
| Tests | A spec against the fake game of `@wowkit/test-kit`; `state.isInCombat = true`, advance the clock, `expect(world.notice())` | [`rank-reminder/test`](https://github.com/vattiss/wowkit/tree/main/addons/rank-reminder/test) |
| A release | A tag and the release workflow | [Releasing](releasing.md) |

When you meet a word you do not know, the [Glossary](glossary.md) has it. When a function you want is not there, look in
the [API reference](/api/index.html){target="_self"} first: the answer to a question about the game is usually
already a method of one of the services.
