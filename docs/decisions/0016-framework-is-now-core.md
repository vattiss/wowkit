# 0016: The framework package is now called core

Status: accepted (2026-10-17)

## Context

The package with `Addon`, the event decorators, the `EventBus` and the lifecycle hooks was called `@wowkit/framework`.
"Framework" names a whole ready-made system; this is the lowest layer that everything else (`wow`, `ui`, the addons) is
built on, and it depends on nothing. The common name for that is "core" (`@angular/core`, `@nestjs/core`), and it reads
better next to `wow`, `ui` and `test-kit`.

## Decision

- `packages/framework` is `packages/core`, and `@wowkit/framework` is `@wowkit/core` (including `@wowkit/core/event-bus`
  for the `declare module` blocks that add an event). The records written before this one keep the old name where they
  describe what was decided then; the package names in them were updated.
- What belongs in core stays small: `Addon`, the events and timers, the lifecycle hooks, and the text helpers. Anything
  that talks to the game's API but is not about events belongs in `@wowkit/wow`, and anything for the Settings panel in
  `@wowkit/ui`.

## Consequences

- A mechanical rename: the folder, the imports, the `tsconfig` paths, the checks and the docs; the specs are unchanged.
- A package called core invites everything that has no other home; the rule above is the guard.
