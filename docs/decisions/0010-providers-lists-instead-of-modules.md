# 0010: One providers list per feature instead of Nest-style modules

Status: accepted (2026-10-17); the providers lists and the container are replaced by hand wiring in [0011](0011-hand-wired-classes.md)

## Context

[0007](0007-services-modules-and-decorators.md) and [0009](0009-everything-is-a-provider.md) copied Nest's module
system: `@Module({ imports, providers, exports })`, `@Global()`, `@Optional()`, four kinds of custom provider, and a
graph that checked who may see what. In an addon with one process and one set of files, that is a lot of machinery
for little: it checked visibility rules the layer checks already cover (`npm run check`), and it was hard to read
(why does `tick/` export only `RefreshService`?). Nothing used `useClass` or `useFactory`.

The owner named what the addon really needs: **pipelines, singleton classes, composition over inheritance, an
event system (pub/sub)**, and the lifecycle hooks.

## Decision

- **Singletons by injection:** the container makes each `@Injectable()` service once. No inheritance anywhere; a
  service is built from the services it is given.
- **A providers list per feature** (`tick/tick.providers.ts` exports `TICK_PROVIDERS`), put together in
  `app.providers.ts` and given to `bootstrap`. The order of the list is the order of the lifecycle hooks.
- **Everything may use everything in the list.** Who may call the game and who may import what stays enforced by
  `scripts/check-boundary.ts` and `scripts/check-layers.ts`. The start checks only that the list is complete: each
  service is `@Injectable()`, listed once, and has everything it asks for in the list.
- **Providers:** a class, `{ provide, useValue }` and `{ provide, useExisting }`. Injection tokens stay, so the
  toolkit can ask for what only the addon knows. `@Module`, `@Global`, `@Optional`, `useClass` and `useFactory` are gone,
  and the toolkit's optional tokens are now required (the addon always provides them).
- **Kept as they were:** the `EventBus` and the event decorators (pub/sub), `@Interval`, and the five lifecycle hooks.
- **Pipelines:** the tick is the pipeline (`find` then `show`, `tick.service.ts`); a helper for it would only hide a
  one-line call, so there is none. It can come when a second pipeline exists.

## Consequences

- Fewer concepts to learn; `tick/` is a folder with a list, not a module with a public surface.
- A service can now use any other service in the list; keeping features tidy is up to the layer checks and review.
- Services are not hidden any more (`SpellBookService` could be injected anywhere); the READMEs say which are internal.
