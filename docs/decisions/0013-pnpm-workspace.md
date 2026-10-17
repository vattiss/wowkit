# 0013: A pnpm workspace

Status: accepted (2026-10-17)

## Context

[0012](0012-packages.md) split the code into packages and an addon, but there was one `package.json`, so the scripts
were fixed to one addon (`forever-reminders`) and the packages had no metadata of their own. The owner wants
`forever-reminders` to stay as the example project and to build other addons next to it.
[0006](0006-tooling.md) had planned workspaces.

## Decision

- **pnpm** (version in `packageManager`, `pnpm-workspace.yaml` with `packages/*` and `addons/*`), installed with
  `npm install -g pnpm`. `pnpm-lock.yaml` replaces `package-lock.json`.
- **A `package.json` per package and addon.** An addon's holds its name, its version (filled into the TOC), the folder
  name the game loads (`addon.name`) and its scripts (`build`, `build:tests`, `test:run`, `typecheck`, `watch`,
  `deploy:game`). The root holds the shared tools, the pinned commit of Blizzard's API documentation and the commands
  that run for everything (`pnpm test`, `pnpm check`, `pnpm build`).
- **Packages are `workspace:*` dependencies** (the addon on `@wowkit/core`, `@wowkit/wow`; `wow` on
  `framework`), so the dependency graph is written down. Compiling still uses `paths` to the sources: TypeScriptToLua
  cannot compile sources it finds through the `node_modules` links (route B of 0012).
- **The shared scripts work on the folder they run in** (`getAddonDir` in `scripts/lib/paths.ts`), so pnpm's
  `--filter` picks the addon. The checks that read the code look at every folder under `addons/`. Each addon builds
  into its own `dist/` and `dist-test/`.
- The deploy script is `deploy:game`, because `pnpm deploy` is a command of pnpm itself.

## Consequences

- A second addon is a folder with a `package.json`, the `tsconfig` files and its sources; no script changes.
- pnpm has to be installed (`npm install -g pnpm`); CI uses `pnpm/action-setup` and the `packageManager` field.
- The checks use one TypeScript program for all addons and the first addon's compiler options, so addons must share
  their options (they do, being copies of one another).
