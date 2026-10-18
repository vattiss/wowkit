# core/

`@wowkit/core`: an `Addon` that starts the services, lifecycle hooks, events and timers. Services are plain
classes that get what they need in their constructor; the core adds only what the game needs (listening to
events, running timers). It is platform-aware (it listens to the game's events and runs the timers), a
package that imports only itself, and knows nothing about reminders. Why it is built this way:
[docs/architecture.md](../../../docs/architecture.md#architecture-decision-records-adr).

```ts
export class RefreshService {
    constructor(private readonly ticker: TickService) {}

    @OnGameEvent("PLAYER_TALENT_UPDATE", "PLAYER_LEVEL_UP")
    scheduleSpellRefresh(): void { ... }
}

// addons/buff-reminder/src/addon.ts: every service is made by hand, dependencies first, and handed to the addon
const addon = new Addon(addonName);
const tick = addon.register(new TickService(findReminders, showReminders));
addon.register(new RefreshService(tick));
addon.start();
```

| File | What it does |
|---|---|
| `index.ts` | The door: what a service or the wiring imports. |
| `decorators.ts` | What a method listens to: `@OnGameEvent`, `@OnUnitEvent`, `@OnEvent`, `@Interval`. A decorator accepts only a method that fits what it listens to, so a handler with the wrong parameters does not compile. |
| `addon.ts` | `Addon`: takes the services (`add`), then `start` connects the listeners, runs the hooks, starts and stops the intervals. |
| `event-bus.ts` | `EventBus` (Nest's EventEmitter) and `AppEvents`, the map of event names to what they carry. `addon.events` is the addon's one bus. |
| `game-events.ts` | `GameEvents`: the game's events on one hidden frame per `Addon` (no state outside the object, so a test can make as many as it needs), and `runInterval`; only `addon.ts` uses it. |
| `metadata.ts`, `types.ts` | What the decorators write down; the words of the core. |

## Services

A service is a class. It asks for the services it needs as constructor parameters, once
(`private readonly ticker: TickService`), and nothing else is needed: no container, no registry. Because a service
can only be made after the services it needs, a missing or misordered dependency is a compile error, and a
circular one cannot be written. There is no inheritance: a service is built from the services it is given.

What only the addon knows (buff categories, spell names, the name of the saved variable) is a plain constructor
parameter too, which the addon's wiring passes in.

## Events

Game events: `@OnGameEvent("PLAYER_DEAD")`, and `@OnUnitEvent("UNIT_AURA")` for the player's own unit events.
The addon's own events go through the `EventBus`: a service calls `bus.emit("spells.invalidated")` and others
listen with `@OnEvent("spells.invalidated")`. Each event is declared next to the service that emits it:

```ts
declare module "@wowkit/core/event-bus" {
    interface AppEvents {
        "spells.invalidated": [];
    }
}
```

`@Interval(200)` runs a method every 200 milliseconds, from the first login until logout.

## Lifecycle hooks

A service gets a hook by having a method of that name (add `implements OnFirstLogin` so the compiler
checks the method exists; a misspelled hook name never runs). They are named for the moments of the game, in the order they happen.

| Hook | When |
|---|---|
| `onAddonLoaded()` | `ADDON_LOADED` of this addon: the saved data is there. |
| `onFirstLogin()` | Once, at the first login. `@Interval` work starts right after. |
| `onLogin()` | `PLAYER_LOGIN` only: the moment to greet. |
| `onReady()` | After `PLAYER_LOGIN` and after every `PLAYER_ENTERING_WORLD`. |
| `onLogout()` | `PLAYER_LOGOUT`: the intervals have stopped. |

Hooks run in the order the services were added, so every service's hook runs after the hooks of the services it
needs.

## Notes

- Parameter properties (`private readonly ticker: TickService`) need no decorator, because nothing is looked up
  by type at run time; TypeScriptToLua has no `emitDecoratorMetadata`.
- Method decorators exist under TypeScript's `experimentalDecorators`, which `tsconfig.json` turns on.
- Compiled to Lua, a decorated method is called as `instance[name](instance, ...)`, which is how Lua passes `self`.
- The Lua bundle cannot resolve import cycles, so two services cannot import each other's files; use an event.
