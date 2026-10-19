# Getting started

From a clone to an addon running in the game, in about ten minutes.

## What you need

- [Node.js](https://nodejs.org) 24 or newer: the build scripts are TypeScript that Node runs directly.
- [pnpm](https://pnpm.io): `npm install -g pnpm`. The version is pinned in the `packageManager` field of `package.json`.
- LuaJIT (or another Lua 5.1) on your `PATH`, only to run the tests.
- World of Warcraft: Forever (1.60.x), only to see an addon run.

## Get the code and build it

```sh
git clone https://github.com/vattiss/wowkit.git
cd wowkit
pnpm install
pnpm build
```

`pnpm build` compiles every addon with [TypeScriptToLua](https://github.com/TypeScriptToLua/TypeScriptToLua). Each
addon becomes one folder in its own `dist/`:

```
addons/glowing-bars/dist/GlowingBars/
    GlowingBars.toc     the addon's description for the game
    GlowingBars.lua     all of the addon (and the packages it uses) in one Lua file
    images/logo.tga      the icon, made from assets/logo.png
```

## Run it in the game

Tell the deploy script where the game's `AddOns` folder is, then deploy one addon:

::: code-group

```sh [bash]
export WOW_ADDONS_DIR="C:/Program Files (x86)/World of Warcraft/_classic_beta_/Interface/AddOns"
pnpm --filter glowing-bars deploy:game
```

```powershell [PowerShell]
$env:WOW_ADDONS_DIR = "C:\Program Files (x86)\World of Warcraft\_classic_beta_\Interface\AddOns"
pnpm --filter glowing-bars deploy:game
```

:::

Type `/reload` in the game to load the new build. The Forever beta installs into `_classic_beta_`; the folder you
need is the one that holds your other addons.

## Check your work

```sh
pnpm check       # the rule checks, ESLint and Prettier
pnpm test        # the checks, the build, and the specs of every addon and package
pnpm format      # let Prettier lay the code out
```

`pnpm check` is not only style. It enforces the shape of the code: who may call the game, who may import whom, that
every service is wired in `addon.ts`, that function names start with a verb, and that the spell and item IDs in the
code are the ones the client knows. The reasons are in [Architecture](architecture.md).

## Find your way around

| You want to | Go to |
|---|---|
| Understand how the code is split | [Packages and addons](packages.md) and [Architecture](architecture.md) |
| Know what a word means (buff, aura, buff category...) | [Glossary](glossary.md) |
| Know why the code is so careful with the game | [The game's quirks](forever-quirks.md) |
| Look up a class or a function of the toolkit | [API reference](/api/index.html){target="_self"} |
| Write an addon of your own | [Learning guide](learning-guide.md) |
| Release an addon | [Releasing](releasing.md) |

The addon of this repository is [Glowing Bars](https://github.com/vattiss/wowkit/tree/main/addons/glowing-bars). The smallest
real addon the repository had, a notice and a Settings page in a few hundred lines, is [Rank Reminder](https://github.com/vattiss/wowkit/tree/rank-reminder-v1.0.2/addons/rank-reminder),
at its last tag: the template for a new one.
