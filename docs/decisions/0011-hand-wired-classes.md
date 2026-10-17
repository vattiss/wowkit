# 0011: Classes wired by hand in one file; no container, no `@Inject`

Status: accepted (2026-10-17)

## Context

After [0010](0010-providers-lists-instead-of-modules.md) the container was all that was left of the injection
system: `@Injectable`, `@Inject`, injection tokens, a providers list per feature and a start-time check. Because
TypeScriptToLua has no `emitDecoratorMetadata`, every dependency had to be written twice
(`@Inject(X) private readonly x: X`, 154 times), and a mistake showed up only when the addon started.

The owner asked whether plain `export const service = new Service()` would do. It would, but it hides the
dependencies in imports, and it cannot give the toolkit what only the addon knows (the toolkit cannot import the
addon, so it would need setters that nothing forces anyone to call).

## Decision

- **Plain classes with constructor parameters.** A service takes the services it needs (and what only the addon
  knows) as `private readonly` constructor parameters, written once. No decorator is needed for that.
- **One wiring file, `src/addon.ts`.** It makes every service with `new`, dependencies first, and gives it to
  `addon.register(...)`. The line order is the order of the lifecycle hooks, so a service's hooks run after the hooks of
  the services it needs.
- **The compiler checks the wiring.** A missing dependency or a wrong order does not compile (`used before its
  declaration`); a cycle cannot be written.
- **Gone:** `@Injectable`, `@Inject`, `InjectionToken` (`AURA_KNOWLEDGE`, `SPELL_NAME_HINTS`,
  `SAVED_VARIABLES`, `ADDON_NAME`), the container, `providers.ts`, the `*.providers.ts` files.
- **Kept:** the `EventBus` (now `addon.events`, handed to the services that use it), the event decorators, `@Interval`,
  the five lifecycle hooks, and the rule that the toolkit never imports the addon.

- **Names from the game, not from Nest.** The class is `Addon` (`register`, `events`, `start`), and the hooks are
  `onAddonLoaded`, `onFirstLogin`, `onLogin`, `onReady` and `onLogout`, in the order they happen. There are no
  modules or applications left for Nest's names to mean.

## Consequences

- No double declarations; `addon.ts` is the one place that shows the whole dependency graph (about 100 lines).
- A service can be made in a test with a stand-in: `new RefreshService(fakeTicker)`.
- Adding a service means one line in `addon.ts`, in the right place; changing a constructor means editing that line.
- The services nobody asks for (the ones that only react to events) are added without a variable.
- The old start-time messages ("X needs Y, but it is not in the providers list") are gone; the compiler says it.
