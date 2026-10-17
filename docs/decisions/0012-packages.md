# 0012: Packages and addons, compiled from sources

Status: accepted (2026-10-17)

## Context

[0001](0001-own-sdk-for-forever-addons.md) set the goal: an SDK that other Forever addons can use.
[0008](0008-toolkit-folders-do-not-know-the-addon.md) kept the reusable code in `src/toolkit/`, kept apart by a
check. [0011](0011-hand-wired-classes.md) removed the last thing the toolkit shared with the addon through hidden
state (the container and its tokens): what the addon knows is now a plain constructor parameter. The reusable code
can be cut out cleanly, and a spike (2026-10-17) showed how TypeScriptToLua takes code from another package:

| Route | Result of the spike |
|---|---|
| **A. Sources by path.** The addon's `tsconfig.json` maps `@wowkit/framework` to the package's `src/index.ts` (`paths`). TypeScriptToLua compiles the package sources together with the addon's. | **Works**, decorators included. No build step for the package; one `tsc` and one bundle. |
| **B. Sources through `node_modules`.** The package is linked there by npm workspaces. | **Fails**: TypeScriptToLua takes anything in `node_modules` for a precompiled Lua library and stops with "Could not resolve lua source files for require path". |
| **C. A built library.** The package is built with `"buildMode": "library"` and `"declaration": true`; the addon imports it from `node_modules`. | **Works**, decorators included. The route for a published package. |

## Decision

- **Packages in `packages/`, addons in `addons/`,** compiled by route A:

  | Folder | Name | Was |
  |---|---|---|
  | `packages/framework` | `@wowkit/framework` | `src/toolkit/framework` and `src/toolkit/util` |
  | `packages/wow` | `@wowkit/wow` | `src/toolkit/wow` |
  | `packages/wow-types` | `@wowkit/wow-types` | `types/` |
  | `packages/test-kit` | `@wowkit/test-kit` | `test/framework.ts`, `test/config.ts`, `test/world/` |
  | `addons/forever-reminders` | (the addon) | `src/` without `toolkit/`, `addon/`, `test/specs`, the `tsconfig` files |

- **A package has a door:** its `src/index.ts` is what other code imports (`@wowkit/wow`). The one exception is
  `declare module "@wowkit/framework/event-bus"`, which adds an event to `AppEvents`; TypeScript can augment the
  declaring file, not a re-export.
- **Dependencies are fixed and checked:** `framework` and `test-kit` depend on nothing, `wow` on `framework`.
  `scripts/check-layers.ts` fails on any other import across packages, or out of a package by a relative path.
  `scripts/check-boundary.ts` keeps the game-facing code to `packages/wow`, `packages/framework` and the addon's
  `options/` and `diagnostics/`.
- **One `package.json` and one `node_modules` at the root** at first; each package and addon got its own
  `package.json` the same day, with the pnpm workspace of [0013](0013-pnpm-workspace.md).
- **Not yet:** route C, publishing, a template repository, a second addon. They need only a `package.json` per
  package and library builds; nothing in the layout stands in the way.

## Consequences

- The reusable code is separate from the addon in the file tree, and the compiler and the checks keep it so.
- The editor needs a `tsconfig.json` in each package (they extend the addon's); they are there only for the editor.
- The `paths` in the addon's `tsconfig` files still tie the packages to this repository; a second addon repeats them.
- The Lua bundle is 241 KB (it was 311 KB before the container went in [0011](0011-hand-wired-classes.md)).
