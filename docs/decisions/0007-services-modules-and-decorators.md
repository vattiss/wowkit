# 0007: Services, modules and decorators instead of one event list

Status: accepted (2026-10-17); the modules part is replaced by [0010](0010-providers-lists-instead-of-modules.md); widened and renamed in [0009](0009-everything-is-a-provider.md): the decorators
`@OnEvent`/`@OnPlayerEvent` became `@OnGameEvent`/`@OnUnitEvent`, `@Every` became `@Interval`, the hooks got Nest's names,
and not only the event wiring but every stateful part of the addon is a service.

## Context

`src/core/` was four files of functions with module-level state: one `startGameEvents` function (65 lines)
wired every game event, `refresh.ts` and `tick.ts` held their state in module variables, and the
first login ran a list of calls inside `onLogin`. It worked, but "who reacts to this event?" meant
reading the whole list, and nothing named the moments of the addon's life.

The long-term plan is a framework for Forever addons ([0001](0001-own-sdk-for-forever-addons.md)); a
familiar, Angular / Nest-like way to organise an addon is part of what makes it easy to write.

## Decision

An addon is made of **services** (classes), grouped in **modules**, started by `bootstrap`:

- a service says what it listens to with decorators on its methods (`@OnEvent`, `@OnPlayerEvent`,
  `@OnSignal`, `@OnSpellCast`, `@Every`);
- a service asks for another with `@Inject` on a constructor parameter; the container makes each
  service once;
- the moments of the addon's life are **lifecycle hooks** a service has or does not have: `onInit`,
  `onBoot`, `onLogin`, `onReady`, `onLogout`;
- a decorator accepts only a method that fits what it listens to, so a wrong handler does not compile.

The code is in `src/toolkit/framework/` (see its README); the services are in feature folders named like Nest / Angular modules: `src/tick/`, `src/character/`,
`src/startup/` (`*.module.ts`, `*.service.ts`), under the root `src/app.module.ts`.

## Alternatives

**Explicit definitions without decorators**
(`createService("Refresh", { uses, create, listen })`, closures instead of classes). Built and tested
side by side with the decorator version on the same 49 tests: it infers dependency types (no
`@Inject(TickService) ... : TickService` repetition) and needs no compiler flag, but the listening is
in a block after the code, and the owner found the decorator version much nicer to write. Both ran
the same tests, so the choice was about writing and reading, not about correctness. The explicit
version was deleted.

## Consequences

- `tsconfig.json` turns on `experimentalDecorators`; parameter decorators (`@Inject`) exist only in
  that legacy form.
- The built Lua is about 40 KB larger than before (the decorator helper, the container and the app).
- The order of services in a module is the order of their hooks; it matters and is documented.
- A misspelled hook name silently never runs; `implements OnBoot` and the tests are the guard.
- The three event paths that no test covered (roster change, spell cast, weapon enchant event) now
  have tests; removing any of those listeners fails one.
