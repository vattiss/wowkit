# packages/

What could serve any Forever addon. Each package knows the game or how to start services, not what this addon
reminds about, and may import only itself and the packages it depends on (`pnpm check` enforces it, decision
[0008](../docs/decisions/0008-toolkit-folders-do-not-know-the-addon.md) and [0012](../docs/decisions/0012-packages.md)).
What only the addon knows is a constructor parameter, which the addon's `addon.ts` passes in.

| Package | Name | What it is | Depends on |
|---|---|---|---|
| [framework/](framework/README.md) | `@forever/framework` | `Addon`, the decorators, the `EventBus`, the lifecycle hooks, and the text helpers. | nothing |
| [wow/](wow/README.md) | `@forever/wow` | The services that talk to the game: spells, auras, action bars, player, party, bags, clock, glows, notices, saved variables, protected calls. | `@forever/framework` |
| [wow-types/](wow-types) | `@forever/wow-types` | The typings of Blizzard's API: generated from its documentation, plus hand-written ones. Only types; they disappear when compiled. | nothing |
| [test-kit/](test-kit/README.md) | `@forever/test-kit` | `describe` / `it` / `expect` and a fake game that implements the raw API. | `@forever/wow-types` (types only) |

The addons that use them are in [../addons/](../addons).

## How a package is used today

The packages are **compiled from their sources together with the addon** (route A of
[0012](../docs/decisions/0012-packages.md)): an addon's `tsconfig.json` maps `@forever/framework` and `@forever/wow`
to the sources under `paths`, so there is one `tsc`, one TypeScriptToLua run and one Lua file per addon, and nothing
to build or publish first. A package is not yet something you install from npm; that comes with a published
build (route C, see the same record).
