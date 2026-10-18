# packages/

The toolkit (`@wowkit/*`) could serve any Forever addon: each of its packages knows the game or how to start services,
not what an addon reminds about. `@forever-reminders/shared` holds what the reminder addons share. Each package may
import only itself and the packages it depends on (`pnpm check` enforces it; see
[why](../docs/architecture.md#architecture-decision-records-adr)). What only an addon knows is a constructor parameter,
which the addon's `addon.ts` passes in.

| Package | Name | What it is | Depends on |
|---|---|---|---|
| [@wowkit/core/](@wowkit/core/README.md) | `@wowkit/core` | `Addon`, the decorators, the `EventBus`, the lifecycle hooks, and the text helpers. | nothing |
| [@wowkit/wow/](@wowkit/wow/README.md) | `@wowkit/wow` | The services that talk to the game, and nothing else: spells, auras, action bars, player, party, bags, clock, glows, notices, saved variables, protected calls. | `@wowkit/core`, `@wowkit/wow-data` |
| [@wowkit/ui/](@wowkit/ui/README.md) | `@wowkit/ui` | What every addon needs besides the game's door: settings (the shape is the addon's), texts, chat lines and sounds, and the pages of the Settings panel. | `@wowkit/core`, `@wowkit/wow` |
| [@forever-reminders/shared/](@forever-reminders/shared/README.md) | `@forever-reminders/shared` | What the reminder addons share and the game's door does not need: the reagents of the group buffs and when the reminders keep quiet. | `@wowkit/core`, `@wowkit/wow`, `@wowkit/wow-data` |
| [@wowkit/wow-types/](@wowkit/wow-types) | `@wowkit/wow-types` | The typings of Blizzard's API: generated from its documentation, plus hand-written ones. Only types; they disappear when compiled. | nothing |
| [@wowkit/wow-data/](@wowkit/wow-data/README.md) | `@wowkit/wow-data` | The spell and item IDs the addons use, written by hand by category (`Paladin.BlessingMight`, `Reagents.HolyCandle`), and what the client said of them (generated). | nothing |
| [@wowkit/test-kit/](@wowkit/test-kit/README.md) | `@wowkit/test-kit` | `describe` / `it` / `expect`, a fake game that implements the raw API, and fixtures (the classes and spells of the specs). | `@wowkit/wow-types` (types only) |

The addons that use them are in [../addons/](../addons).

## How a package is used today

The packages are **compiled from their sources together with the addon** (see [why](../docs/architecture.md#architecture-decision-records-adr)): an addon's `tsconfig.json` maps `@wowkit/core` and `@wowkit/wow`
to the sources under `paths`, so there is one `tsc`, one TypeScriptToLua run and one Lua file per addon, and nothing
to build or publish first. A package is not yet something you install from npm; that comes with a published
build.
