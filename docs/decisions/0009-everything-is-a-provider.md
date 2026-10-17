# 0009: Everything is a provider; where in doubt, as Nest.js does it

Status: accepted (2026-10-17); the Nest-style modules, the custom providers beyond `useValue` / `useExisting` and `@Optional()` are replaced by [0010](0010-providers-lists-instead-of-modules.md)

## Context

[0007](0007-services-modules-and-decorators.md) moved the event wiring and the lifecycle into services and
modules, but the rest of the addon (the game access in `toolkit/wow/`, the reminders, the options pages, the settings,
the texts) stayed plain function modules with state in module variables. Two styles in one codebase, and the
state could not be reset or replaced.

The owner decided: do everything per the framework that can be, and where it is unclear, do it as Nest.js does.

## Decision

- **State, the game and other services mean a service.** Every class that keeps state, talks to the game or
  needs another service is `@Injectable()`, listed in a `@Module`, and injected with `@Inject`. This includes
  the game access (`PlayerService`, `SpellsService`, `AurasService`...), the reminders, the options pages
  (`HomePage`, `RemindersPage`...), the settings (`SettingsService.get/change`) and the texts
  (`LocaleService.getText`).
- **What stays outside:** pure data (`*.constants.ts`), shapes (`*.interface.ts`), and pure functions of their
  arguments (`toolkit/util/text.ts`, `toolkit/wow/safe.ts`, `reminders/weapon/weapon-reactions.ts`).
- **Modules as in Nest:** a folder per feature with a `*.module.ts`; `imports`, `providers`, `exports`; a service
  sees only its own module, the exports of imported modules and the exports of `@Global()` modules (settings,
  texts, messages, knowledge). The framework checks this when the addon starts.
- **Custom providers** (`useValue`, `useClass`, `useExisting`, `useFactory`) and **injection tokens**, so the toolkit
  can ask for what only the addon knows (`AURA_KNOWLEDGE`, `SPELL_NAME_HINTS`, `SAVED_VARIABLES`) without
  importing the addon ([0008](0008-toolkit-folders-do-not-know-the-addon.md)). `@Optional()` for what may be absent.
- **Events as Nest's EventEmitter:** the `EventBus` and `@OnEvent("name")` replace the `Signal` objects; game
  events became `@OnGameEvent` and `@OnUnitEvent`, `@Every` became `@Interval(ms)`, the hooks got Nest's names
  (`onModuleInit`, `onApplicationBootstrap`, `onApplicationShutdown`; the game adds `onLogin` and `onReady`).
- **File names as in Nest / Angular:** `*.service.ts`, `*.module.ts`, `*.constants.ts`, `*.interface.ts`, and
  `*.page.ts` / `*.section.ts` for the pieces of the options UI.

## Consequences

- One style everywhere; tests and later packages can build a fresh instance of anything.
- More files and more constructor lines: a dependency is written twice (`@Inject(X) private readonly x: X`),
  because TypeScriptToLua has no `emitDecoratorMetadata`.
- The built Lua grew from 226 KB to about 310 KB (the module graph, the container, and a class and constructor
  for what used to be a function).
- `src/ui/`, `src/data/` and `src/core/` are gone; the game may now be touched from `toolkit/wow/`, `toolkit/framework/`,
  `options/` and `diagnostics/` (`scripts/check-boundary.ts`).
- Not verified: the framework's "circular dependency" message (a test that creates one also creates an import
  cycle, which the Lua bundle cannot load); the other errors (missing import, missing `@Injectable()`) were
  triggered on purpose and read well.
