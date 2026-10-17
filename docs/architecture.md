# Architecture

Forever Reminders is a World of Warcraft: Forever addon written in TypeScript and compiled to a
single Lua file. This page shows how it is built, how the code is organised, and the three rules that
keep it readable.

## The four rules

**1. Only a few folders talk to the game.**
Blizzard's API is full of quirks: values that are secret in combat, calls that can raise errors,
spell IDs that Forever remaps, `multiple, return, values`. All of that stays inside `packages/wow/src/`, which
turns it into plain answers in the addon's own words (`isInCombat()`, `isLearned(spell)`,
`getItemCount(item)`). The reminder logic in `addons/forever-reminders/src/reminders/` never sees a Blizzard function, so it reads
like plain code. Three more folders may call the game because that is their job: `packages/framework/src/` (game
events and timers for the decorators), `addons/forever-reminders/src/options/` (the Settings panel) and `addons/forever-reminders/src/diagnostics/` (the debug
mode, which probes what the game answers).

**2. Everything is a service, made once, by hand.**
Code that keeps state, talks to the game or uses other services is a class with its dependencies in the
constructor. `addons/forever-reminders/src/addon.ts` makes each one with `new`, dependencies first, so there is one instance of each; there
is no inheritance and no container (a service is built from the services it is given). Pure data is a
`*.constants.ts` file, a shape is a `*.interface.ts` file, and a pure function of its arguments stays a function
(`packages/framework/src/text.ts`, `packages/wow/src/safe.ts`, `reminders/weapon/weapon-reactions.ts`).

**3. The packages do not know the addon.**
`packages/` (framework, wow, test-kit and the typings) could serve any Forever addon, so each imports only itself
and the packages it depends on. What only this addon knows (the buff knowledge, the spell name hints, the name of
the saved variable) is a constructor parameter, passed in by `addons/forever-reminders/src/addon.ts`. See [packages.md](packages.md).

**4. Names read like English.**
Functions start with a verb (`getSpellName`, `findMissingBuffs`, `showNotice`). Booleans read as
questions (`isFound`, `hasArrived`, `shouldRecheckDrop`).

All four rules are checked by `pnpm check` (part of `pnpm test`) or by the framework when the addon starts, so
they cannot creep back in.

## Build pipeline

The WoW API typings are generated from Blizzard's own API documentation; the addon is compiled to
one Lua 5.1 file by TypeScriptToLua (TSTL) and packaged with its TOC.

```mermaid
flowchart LR
    subgraph upstream["Gethe/wow-ui-source (forever branch)"]
        docs["Blizzard_APIDocumentationGenerated/*.lua<br/>642 documentation tables"]
    end

    subgraph typings["types/"]
        generated["generated/*.d.ts<br/>C_* namespaces, Enum, structures,<br/>events, widgets"]
        manual["wow-manual.d.ts, wow-framexml.d.ts<br/>script handlers, CreateFrame,<br/>Settings API, FrameXML globals"]
    end

    docs -- "pnpm fetch:wow-ui<br/>(sparse clone, pinned commit)" --> cache[".cache/wow-ui-source"]
    cache -- "pnpm gen:types<br/>scripts/generate-wow-types.ts" --> generated

    src["src/**/*.ts"] --> tstl["TSTL<br/>luaTarget 5.1, luaBundle,<br/>noImplicitSelf"]
    generated --> tstl
    manual --> tstl
    tstl --> lua["dist/ForeverReminders/<br/>ForeverReminders.lua<br/>(in the addon folder)"]
    toc["addon/ForeverReminders.toc<br/>addon/images"] -- "scripts/package-addon.ts<br/>(@version@)" --> dist["dist/ForeverReminders/"]
    lua --> dist
    dist -- "pnpm test<br/>tests in TypeScript, run by LuaJIT<br/>against a fake game" --> smoke["tests"]
    dist -- "pnpm --filter forever-reminders deploy:game" --> game["_classic_beta_/Interface/AddOns"]
```

## Code layout

`main.ts` calls `startAddon` in `addon.ts`, which makes every service; every box below is a folder of
services. An arrow means "uses services of".

```mermaid
flowchart TB
    main["main.ts<br/>startAddon()"] --> wiring["addon.ts<br/>makes every service, in order"]

    subgraph global["used by every feature"]
        settings["settings/<br/>SettingsService: the saved settings,<br/>change() announces"]
        locale["locale/<br/>LocaleService: the texts"]
        messages["messages/<br/>MessagesService: say, alert sounds,<br/>the greeting"]
        knowledge["knowledge/<br/>what only this addon knows:<br/>buff categories, spell names"]
    end

    subgraph features["features (the addon)"]
        tick["tick/<br/>a tick every 0.2 s: find what is due,<br/>show it; when to look sooner"]
        character["character/<br/>weapons, auras and casts,<br/>party roster, towns, blocked actions"]
        options["options/<br/>the Settings panel pages"]
        diagnostics["diagnostics/<br/>debug mode and report"]
        reminders["reminders/<br/>missing buffs, weapon buff,<br/>party buffs, reagents"]
    end

    subgraph toolkit["packages (could serve any Forever addon)"]
        wow["packages/wow/src/<br/>the only code that calls the game<br/>spells, auras, action bars, player, party, bags,<br/>glows, notices, saved variables"]
        framework["packages/framework/src/<br/>Addon, lifecycle hooks, EventBus,<br/>@OnGameEvent, @Interval"]
    end

    game[("WoW client<br/>C_* APIs, frames, events")]

    wiring --> global
    wiring --> features
    tick --> reminders
    tick --> wow
    character --> tick
    character --> reminders
    character --> wow
    options --> diagnostics
    options --> reminders
    options --> wow
    diagnostics --> reminders
    diagnostics --> wow
    knowledge --> reminders
    reminders --> wow
    settings --> wow
    messages --> wow
    wow --> game
    wow --> framework
    framework --> game
    features --> framework
```

The packages ask the addon for three things as constructor parameters, and `addon.ts` passes them: the buff
knowledge (`BuffKnowledgeService` from `knowledge/`), the spell name hints (`knowledge/`) and the name of the saved
variable (`settings/`).

## Classes

Every service as a box, grouped by folder; an arrow means "takes it in its constructor" (generated from
`addons/forever-reminders/src/addon.ts`). To keep the picture readable, the arrows to the services nearly everyone takes are left out:
`SettingsService`, `LocaleService`, `MessagesService`, `PlayerService`, `SpellsService` and `ClockService`.

```mermaid
classDiagram
    direction LR
    namespace Package_wow {
        class ClockService
        class PlayerService
        class PartyService
        class BagsService
        class SavedVariablesService
        class SpellBookService
        class SpellsService
        class SpellCastService
        class AuraMemoryService
        class AurasService
        class ActionBarsService
        class WeaponEnchantsService
        class GlowService
        class NoticeService
    }
    namespace Settings {
        class SettingsService
    }
    namespace Locale {
        class LocaleService
    }
    namespace Messages {
        class MessagesService
        class GreetingService
    }
    namespace Knowledge {
        class BuffKnowledgeService
    }
    namespace Reminders {
        class ClassBuffsService
        class BuffReminderService
        class ReagentsService
        class PartyBuffsService
        class WeaponChoiceService
        class WeaponMemoryService
        class WeaponReadingService
        class WeaponReminderService
    }
    namespace Tick {
        class GameDataService
        class FindRemindersService
        class NoticesService
        class ShowRemindersService
        class TickService
        class RefreshService
        class DisplayService
    }
    namespace Character {
        class EquipmentService
        class AuraWatchService
        class RosterService
        class TownVisitService
        class BlockedActionService
    }
    namespace Diagnostics {
        class RecorderService
        class SamplesService
        class ReportService
        class DebugModeService
    }
    namespace Options {
        class ControlsService
        class WidgetsService
        class WeaponSection
        class HomePage
        class RemindersPage
        class DebugPage
        class OptionsService
    }
    SpellsService --> SpellBookService
    SettingsService --> SavedVariablesService
    BuffKnowledgeService --> ClassBuffsService
    AuraMemoryService --> BuffKnowledgeService
    AurasService --> AuraMemoryService
    AurasService --> BuffKnowledgeService
    GlowService --> ActionBarsService
    MessagesService --> NoticeService
    BuffReminderService --> AurasService
    BuffReminderService --> ActionBarsService
    BuffReminderService --> ClassBuffsService
    ReagentsService --> BagsService
    PartyBuffsService --> AurasService
    PartyBuffsService --> PartyService
    PartyBuffsService --> ClassBuffsService
    PartyBuffsService --> ReagentsService
    WeaponReadingService --> AurasService
    WeaponReadingService --> WeaponEnchantsService
    WeaponReadingService --> WeaponChoiceService
    WeaponReminderService --> WeaponEnchantsService
    WeaponReminderService --> WeaponChoiceService
    WeaponReminderService --> WeaponMemoryService
    WeaponReminderService --> WeaponReadingService
    GameDataService --> ActionBarsService
    FindRemindersService --> ActionBarsService
    FindRemindersService --> BuffReminderService
    FindRemindersService --> PartyBuffsService
    FindRemindersService --> WeaponReminderService
    NoticesService --> ActionBarsService
    NoticesService --> NoticeService
    ShowRemindersService --> GlowService
    ShowRemindersService --> NoticesService
    TickService --> FindRemindersService
    TickService --> ShowRemindersService
    RefreshService --> TickService
    RefreshService --> ShowRemindersService
    RefreshService --> ActionBarsService
    RefreshService --> AurasService
    DisplayService --> ShowRemindersService
    DisplayService --> TickService
    EquipmentService --> RefreshService
    EquipmentService --> WeaponEnchantsService
    EquipmentService --> WeaponReminderService
    AuraWatchService --> RefreshService
    AuraWatchService --> AurasService
    AuraWatchService --> WeaponReminderService
    RosterService --> RefreshService
    RosterService --> PartyBuffsService
    TownVisitService --> ReagentsService
    TownVisitService --> NoticeService
    SamplesService --> RecorderService
    SamplesService --> ActionBarsService
    SamplesService --> PartyService
    SamplesService --> WeaponEnchantsService
    SamplesService --> BuffReminderService
    SamplesService --> ClassBuffsService
    SamplesService --> PartyBuffsService
    SamplesService --> ReagentsService
    SamplesService --> WeaponChoiceService
    SamplesService --> WeaponReminderService
    ReportService --> RecorderService
    DebugModeService --> RecorderService
    DebugModeService --> SamplesService
    WeaponSection --> WeaponChoiceService
    WeaponSection --> ControlsService
    HomePage --> WidgetsService
    RemindersPage --> ClassBuffsService
    RemindersPage --> ControlsService
    RemindersPage --> WeaponSection
    DebugPage --> RecorderService
    DebugPage --> ReportService
    DebugPage --> WidgetsService
    OptionsService --> HomePage
    OptionsService --> RemindersPage
    OptionsService --> DebugPage
```

## Events (notifications upwards)

TSTL bundles modules with `require`, which cannot resolve import cycles, so a lower service never imports an
upper one. It emits a named event on the `EventBus` (Nest's EventEmitter) and the upper service listens with
`@OnEvent("name")`. Each event is declared next to the service that emits it, by adding to `AppEvents`.

```mermaid
flowchart LR
    spellbook["SpellBookService"] -- "spellbook.built" --> spells["SpellsService"]
    spells -- "spells.invalidated" --> auras["AurasService<br/>drops aura scans"]
    spells -- "spells.invalidated" --> weaponChoice["WeaponChoiceService<br/>drops name caches"]
    spells -- "spells.invalidated" --> reagents["ReagentsService<br/>drops tooltip answers"]
    spells -- "spellbook.indexed" --> display["tick/DisplayService<br/>ticks again"]
    actionBars["ActionBarsService"] -- "bars.mapped" --> display
    settings["SettingsService"] -- "setting.changed" --> display
    settings -- "setting.changed" --> debug["DebugModeService"]
    cast["SpellCastService"] -- "player.spell-cast" --> watch["character/AuraWatchService"]
    safe["packages/wow/src/safe.ts<br/>(plain functions)"] -- "listenToSwallowedErrors" --> debug
```

The helpers in `packages/wow/src/safe.ts` are plain functions and cannot be injected, so they report swallowed errors to a
listener (`listenToSwallowedErrors`) that `DebugModeService` registers.

## One tick: a two-stage pipeline

Every 0.2 seconds (`@Interval(200)`, and on the next frame after relevant events) a tick runs. It has two stages
and one value passed between them, so the stage that decides never shows anything, and the stage that shows
never decides.

```mermaid
sequenceDiagram
    participant Tick as tick/TickService
    participant Find as tick/FindRemindersService
    participant Logic as reminders/*
    participant Show as tick/ShowRemindersService
    participant Screen as packages/wow/src/GlowService, NoticeService

    Tick->>Find: findReminders()
    Find->>Logic: rememberSelfBuffs() (out of combat)
    Note over Find: idle or muted: nothing is due
    Find->>Logic: findMissingBuffs(), findPartyBuffSuggestions(), weaponReminder.check()
    Find-->>Tick: Reminders (buffsToCast, weaponSpell, buffsNotOnBars, partySuggestions, outdatedRanks)
    Tick->>Show: showReminders(reminders)
    Show->>Screen: playAlertSound() for what is new
    Show->>Screen: showNotice(lines) (the same message not again within 30 s)
    Show->>Screen: glow.show(spells, color) (only when the set changed)
```

The triggers are separate: each service says with decorators which game event it reacts to
(`@OnGameEvent`, `@OnUnitEvent`), and `tick/refresh.service.ts` merges and delays the requests (event bursts froze
Forever once), then calls `tick`. The first read of the game, the options page, the greeting and logout are
lifecycle hooks (`onFirstLogin`, `onLogin`, `onLogout`).
