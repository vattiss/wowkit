# Decisions

Short records of the choices that shape the project: what was decided, why, and what follows from it.
A record is *accepted* when the owner has decided it, *proposed* when it is only a recommendation.

| # | Decision | Status |
|---|---|---|
| [0001](0001-own-sdk-for-forever-addons.md) | Build our own TypeScript SDK for Forever addons | accepted |
| [0002](0002-forever-only.md) | Support Forever only | accepted |
| [0003](0003-layers-and-an-escape-hatch.md) | Layered SDK: generated typings at the bottom, a friendly API on top, the raw API always reachable | proposed |
| [0004](0004-compiled-into-each-addon.md) | The SDK is compiled into each addon, not installed as a shared addon | proposed |
| [0005](0005-own-test-runner.md) | Keep our own `describe` / `it` runner on LuaJIT | accepted |
| [0006](0006-tooling.md) | ESLint + Prettier, workspaces (now pnpm, see 0013), BigWigs packager and GitHub Actions later | accepted |
| [0007](0007-services-modules-and-decorators.md) | Services, modules, injection and lifecycle hooks with decorators | accepted |
| [0008](0008-toolkit-folders-do-not-know-the-addon.md) | The toolkit folders import only themselves; the addon provides what they ask for | accepted |
| [0009](0009-everything-is-a-provider.md) | Everything is a provider in a Nest-style module; where in doubt, as Nest.js does it | accepted |
| [0010](0010-providers-lists-instead-of-modules.md) | One providers list per feature instead of Nest-style modules | accepted |
| [0011](0011-hand-wired-classes.md) | Classes wired by hand in one file; no container, no `@Inject` | accepted |
| [0012](0012-packages.md) | The code is split into packages (core, wow, wow-types, test-kit) and addons, compiled from sources | accepted |
| [0013](0013-pnpm-workspace.md) | pnpm workspace: a package.json per package and addon, shared tools at the root | accepted |
| [0014](0014-three-addons-and-the-ui-package.md) | Three addons (buff, rank, reagent), the ui package and the new names (wowkit) | accepted |
| [0015](0015-one-page-and-no-debug-report.md) | One main page per addon, and the debug report is gone | accepted |
| [0016](0016-framework-is-now-core.md) | The framework package is renamed core | accepted |
