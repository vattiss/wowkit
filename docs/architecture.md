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
%%{init: {"theme":"base","themeVariables":{"background":"#ffffff","lineColor":"#6b7280","textColor":"#111827","primaryColor":"#f1f5f9","primaryTextColor":"#111827","primaryBorderColor":"#94a3b8","secondaryColor":"#e2e8f0","tertiaryColor":"#ffffff","mainBkg":"#f1f5f9","nodeBorder":"#94a3b8","nodeTextColor":"#111827","titleColor":"#111827","edgeLabelBackground":"#ffffff","labelBackground":"#ffffff","labelTextColor":"#111827","clusterBkg":"#ffffff","clusterBorder":"#d1d5db","classText":"#111827","actorBkg":"#f1f5f9","actorTextColor":"#111827","actorBorder":"#94a3b8","actorLineColor":"#6b7280","signalColor":"#374151","signalTextColor":"#111827","noteBkgColor":"#fef9c3","noteTextColor":"#111827","noteBorderColor":"#ca8a04"}}}%%
flowchart LR
    classDef default fill:#f1f5f9,stroke:#94a3b8,color:#111827
    subgraph PANEL[" "]
        subgraph upstream["Gethe/wow-ui-source (forever branch)"]
            docs["Blizzard_APIDocumentationGenerated/*.lua<br/>642 documentation tables"]
        end

        subgraph typings["packages/wow-types/"]
            generated["generated/*.d.ts<br/>C_* namespaces, Enum, structures,<br/>events, widgets"]
            manual["wow-manual.d.ts, wow-framexml.d.ts<br/>script handlers, CreateFrame,<br/>Settings API, FrameXML globals"]
        end

        docs -- "pnpm fetch:wow-ui<br/>(sparse clone, pinned commit)" --> cache[".cache/wow-ui-source"]
        cache -- "pnpm gen:types<br/>scripts/generate-wow-types.ts" --> generated

        src["packages/*/src and<br/>addons/*/src"] --> tstl["TSTL<br/>luaTarget 5.1, luaBundle,<br/>noImplicitSelf"]
        generated --> tstl
        manual --> tstl
        tstl --> lua["dist/ForeverReminders/<br/>ForeverReminders.lua<br/>(in the addon folder)"]
        toc["addon/ForeverReminders.toc<br/>assets/logo.png"] -- "scripts/package-addon.ts<br/>(@version@, logo.png to logo.tga)" --> dist["dist/ForeverReminders/"]
        lua --> dist
        dist -- "pnpm test<br/>tests in TypeScript, run by LuaJIT<br/>against a fake game" --> smoke["tests"]
        dist -- "pnpm --filter forever-reminders deploy:game" --> game["_classic_beta_/Interface/AddOns"]
    end
    classDef panel fill:#ffffff,stroke:#d1d5db,color:#111827
    class PANEL panel
```

## Code layout

`main.ts` calls `startAddon` in `addon.ts`, which makes every service; every box below is a folder of
services. An arrow means "uses services of".

```mermaid
%%{init: {"theme":"base","themeVariables":{"background":"#ffffff","lineColor":"#6b7280","textColor":"#111827","primaryColor":"#f1f5f9","primaryTextColor":"#111827","primaryBorderColor":"#94a3b8","secondaryColor":"#e2e8f0","tertiaryColor":"#ffffff","mainBkg":"#f1f5f9","nodeBorder":"#94a3b8","nodeTextColor":"#111827","titleColor":"#111827","edgeLabelBackground":"#ffffff","labelBackground":"#ffffff","labelTextColor":"#111827","clusterBkg":"#ffffff","clusterBorder":"#d1d5db","classText":"#111827","actorBkg":"#f1f5f9","actorTextColor":"#111827","actorBorder":"#94a3b8","actorLineColor":"#6b7280","signalColor":"#374151","signalTextColor":"#111827","noteBkgColor":"#fef9c3","noteTextColor":"#111827","noteBorderColor":"#ca8a04"}}}%%
flowchart TB
    classDef default fill:#f1f5f9,stroke:#94a3b8,color:#111827
    subgraph PANEL[" "]
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
    end
    classDef panel fill:#ffffff,stroke:#d1d5db,color:#111827
    class PANEL panel
```

The packages ask the addon for three things as constructor parameters, and `addon.ts` passes them: the buff
knowledge (`BuffKnowledgeService` from `knowledge/`), the spell name hints (`knowledge/`) and the name of the saved
variable (`settings/`).

## Design patterns

The code is plain classes, but they follow a few well-known patterns, and the structure is easier to see when they
are named. Each colour below is one pattern; a grey box is plain domain code with no pattern of its own.

```mermaid
%%{init: {"theme":"base","themeVariables":{"background":"#ffffff","lineColor":"#6b7280","textColor":"#111827","primaryColor":"#f1f5f9","primaryTextColor":"#111827","primaryBorderColor":"#94a3b8","secondaryColor":"#e2e8f0","tertiaryColor":"#ffffff","mainBkg":"#f1f5f9","nodeBorder":"#94a3b8","nodeTextColor":"#111827","titleColor":"#111827","edgeLabelBackground":"#ffffff","labelBackground":"#ffffff","labelTextColor":"#111827","clusterBkg":"#ffffff","clusterBorder":"#d1d5db","classText":"#111827","actorBkg":"#f1f5f9","actorTextColor":"#111827","actorBorder":"#94a3b8","actorLineColor":"#6b7280","signalColor":"#374151","signalTextColor":"#111827","noteBkgColor":"#fef9c3","noteTextColor":"#111827","noteBorderColor":"#ca8a04"}}}%%
flowchart TB
    classDef default fill:#f1f5f9,stroke:#94a3b8,color:#111827
    classDef panel fill:#ffffff,stroke:#d1d5db,color:#111827
    classDef root fill:#e5e7eb,stroke:#4b5563,color:#111827
    classDef facade fill:#dbeafe,stroke:#2563eb,color:#111827
    classDef observer fill:#ffedd5,stroke:#ea580c,color:#111827
    classDef pipeline fill:#dcfce7,stroke:#16a34a,color:#111827
    classDef state fill:#f3e8ff,stroke:#9333ea,color:#111827
    classDef invert fill:#fee2e2,stroke:#dc2626,color:#111827
    classDef plain fill:#f8fafc,stroke:#94a3b8,color:#111827

    subgraph PANEL[" "]
        subgraph ROOT["Composition root + lifecycle hooks"]
            wiring["addon.ts<br/>makes every service with new,<br/>dependencies first"]
            addon["Addon (framework)<br/>register(), start(),<br/>onAddonLoaded ... onLogout"]
        end

        subgraph FACADE["Facade + Adapter over Blizzard's API (@forever/wow)"]
            wow["PlayerService, SpellsService, AurasService,<br/>ActionBarsService, PartyService, BagsService,<br/>WeaponEnchantsService, ClockService,<br/>GlowService, NoticeService, SavedVariablesService<br/>safe.ts, action-button.ts"]
        end

        subgraph INVERT["Dependency inversion"]
            knowledge["AuraKnowledge (interface in @forever/wow)<br/>implemented by BuffKnowledgeService (addon)<br/>spell name hints, saved variable name"]
        end

        subgraph OBSERVER["Observer / Pub-Sub"]
            bus["EventBus + @OnGameEvent, @OnUnitEvent,<br/>@OnEvent, @Interval"]
            handlers["Listeners: AuraWatch, Equipment, Roster,<br/>TownVisit, BlockedAction, Display,<br/>DebugMode, RefreshService"]
        end

        subgraph PIPELINE["Pipeline: find, then show"]
            tick["TickService (every 0.2 s)"] --> find["FindRemindersService"] --> show["ShowRemindersService<br/>NoticesService"]
            refresh["RefreshService<br/>merges and delays requests<br/>(debounce)"] -.-> tick
        end

        subgraph STATE["State by reading + memory (weapon reminder)"]
            weapon["WeaponReminderService<br/>WeaponReadingService<br/>weapon-reactions (one reaction per status)<br/>WeaponMemoryService"]
        end

        subgraph RULES["Domain services: the rules"]
            rules["ClassBuffsService, BuffReminderService,<br/>PartyBuffsService, ReagentsService,<br/>WeaponChoiceService"]
        end

        subgraph SHARED["Shared services"]
            shared["SettingsService, LocaleService,<br/>MessagesService"]
        end

        subgraph SCREEN["Settings panel and debug tools"]
            screen["Options pages, ControlsService (control factory),<br/>WidgetsService<br/>Recorder, Samples, Report, DebugMode"]
        end

        game[("WoW client")]

        wiring --> addon
        wow --> game
        rules -->|asks the game through| wow
        weapon -->|reads enchants and auras through| wow
        find -->|asks what is due| rules
        find -->|asks| weapon
        knowledge -.->|passed in by addon.ts| wow
        wow -.->|announces events| bus
        shared -.->|announces setting.changed| bus
        bus -.->|calls| handlers
        handlers -.->|ask to look again| refresh
        screen --> shared
        screen --> rules
    end

    class PANEL panel
    class ROOT,wiring,addon root
    class FACADE,wow facade
    class INVERT,knowledge invert
    class OBSERVER,bus,handlers observer
    class PIPELINE,tick,find,show,refresh pipeline
    class STATE,weapon state
    class RULES,rules,SHARED,shared,SCREEN,screen,game plain
```

| Colour | Pattern | Where | What it gives |
|---|---|---|---|
| ⬜ | **Composition root**, lifecycle hooks (Template Method) | `addon.ts`, `Addon` | One file shows what depends on what; a service only says *when* it wants to run (`onLogin`...). |
| 🟦 | **Facade** + **Adapter** | `@forever/wow`, `safe.ts`, `action-button.ts` | The rest of the code never sees secret values, protected calls or remapped IDs, only `isInCombat()`. |
| 🟧 | **Observer** (publish / subscribe) | `EventBus`, the event decorators | Lower code announces ("spells.invalidated"), upper code listens; no import cycles (the Lua bundle cannot have them). |
| 🟩 | **Pipeline** (+ **debounce**) | `tick/` | *Find* has no side effects and *show* remembers only what it showed; a burst of events becomes one tick. |
| 🟪 | **State** by reading, **Memento** | `reminders/weapon/` | The game's answer (up, missing, unknown) picks one small reaction function; a timeline remembers what the client lags on. |
| 🟥 | **Dependency inversion** | `AuraKnowledge` and friends | `@forever/wow` asks for knowledge only the addon has, without importing the addon. |

Two of these in more detail.

**State by reading (the weapon reminder).** The client's weapon-enchant answers lag behind casts and are sometimes
missing, so the answer is not a plain read. The reminder asks the *reading* service what the game says (`up`,
`missing` or `unknown`), hands that reading to one reaction function chosen by the status, and keeps its own
timeline in the *memory* service.

```mermaid
%%{init: {"theme":"base","themeVariables":{"background":"#ffffff","lineColor":"#6b7280","textColor":"#111827","primaryColor":"#f1f5f9","primaryTextColor":"#111827","primaryBorderColor":"#94a3b8","secondaryColor":"#e2e8f0","tertiaryColor":"#ffffff","mainBkg":"#f1f5f9","nodeBorder":"#94a3b8","nodeTextColor":"#111827","titleColor":"#111827","edgeLabelBackground":"#ffffff","labelBackground":"#ffffff","labelTextColor":"#111827","clusterBkg":"#ffffff","clusterBorder":"#d1d5db","classText":"#111827","actorBkg":"#f1f5f9","actorTextColor":"#111827","actorBorder":"#94a3b8","actorLineColor":"#6b7280","signalColor":"#374151","signalTextColor":"#111827","noteBkgColor":"#fef9c3","noteTextColor":"#111827","noteBorderColor":"#ca8a04"}}}%%
classDiagram
    direction LR
    classDef state fill:#f3e8ff,stroke:#9333ea,color:#111827
    namespace Weapon_reminder {
        class WeaponReminderService {
            check() WeaponCheck
            noteCast()
            noteEnchantChanged()
        }
        class WeaponReadingService {
            readWeaponBuff() BuffReading
        }
        class BuffReading {
            <<status: up, missing, unknown>>
        }
        class WeaponReactions {
            <<functions>>
            reactToReading()
            isAboutToExpire()
        }
        class WeaponMemoryService {
            rememberApply()
            noteMissing()
            isInGrace()
        }
    }
    WeaponReminderService --> WeaponReadingService : 1. what does the game say
    WeaponReadingService ..> BuffReading : returns
    WeaponReminderService --> WeaponReactions : 2. what to do with it
    WeaponReactions --> WeaponMemoryService : reads the timeline
    WeaponReminderService --> WeaponMemoryService : 3. remembers casts
    cssClass "WeaponReminderService,WeaponReadingService,BuffReading,WeaponReactions,WeaponMemoryService" state
```

**Dependency inversion (what only the addon knows).** `@forever/wow` declares the interface it needs (red, in
`@forever/wow`); the addon implements it (red, `BuffKnowledgeService`) and `addon.ts` passes the one instance to the two
aura services of `@forever/wow` (blue).

```mermaid
%%{init: {"theme":"base","themeVariables":{"background":"#ffffff","lineColor":"#6b7280","textColor":"#111827","primaryColor":"#f1f5f9","primaryTextColor":"#111827","primaryBorderColor":"#94a3b8","secondaryColor":"#e2e8f0","tertiaryColor":"#ffffff","mainBkg":"#f1f5f9","nodeBorder":"#94a3b8","nodeTextColor":"#111827","titleColor":"#111827","edgeLabelBackground":"#ffffff","labelBackground":"#ffffff","labelTextColor":"#111827","clusterBkg":"#ffffff","clusterBorder":"#d1d5db","classText":"#111827","actorBkg":"#f1f5f9","actorTextColor":"#111827","actorBorder":"#94a3b8","actorLineColor":"#6b7280","signalColor":"#374151","signalTextColor":"#111827","noteBkgColor":"#fef9c3","noteTextColor":"#111827","noteBorderColor":"#ca8a04"}}}%%
classDiagram
    direction LR
    classDef invert fill:#fee2e2,stroke:#dc2626,color:#111827
    classDef facade fill:#dbeafe,stroke:#2563eb,color:#111827
    namespace Dependency_inversion {
        class AuraKnowledge {
            <<interface>>
            findCategory()
            getSeconds()
        }
        class AurasService
        class AuraMemoryService
        class BuffKnowledgeService
        class ClassBuffsService
    }
    AurasService --> AuraKnowledge
    AuraMemoryService --> AuraKnowledge
    BuffKnowledgeService ..|> AuraKnowledge
    BuffKnowledgeService --> ClassBuffsService : buff lists
    cssClass "AuraKnowledge,BuffKnowledgeService" invert
    cssClass "AurasService,AuraMemoryService" facade
```

## Events (notifications upwards)

TSTL bundles modules with `require`, which cannot resolve import cycles, so a lower service never imports an
upper one. It emits a named event on the `EventBus` (Nest's EventEmitter) and the upper service listens with
`@OnEvent("name")`. Each event is declared next to the service that emits it, by adding to `AppEvents`.

```mermaid
%%{init: {"theme":"base","themeVariables":{"background":"#ffffff","lineColor":"#6b7280","textColor":"#111827","primaryColor":"#f1f5f9","primaryTextColor":"#111827","primaryBorderColor":"#94a3b8","secondaryColor":"#e2e8f0","tertiaryColor":"#ffffff","mainBkg":"#f1f5f9","nodeBorder":"#94a3b8","nodeTextColor":"#111827","titleColor":"#111827","edgeLabelBackground":"#ffffff","labelBackground":"#ffffff","labelTextColor":"#111827","clusterBkg":"#ffffff","clusterBorder":"#d1d5db","classText":"#111827","actorBkg":"#f1f5f9","actorTextColor":"#111827","actorBorder":"#94a3b8","actorLineColor":"#6b7280","signalColor":"#374151","signalTextColor":"#111827","noteBkgColor":"#fef9c3","noteTextColor":"#111827","noteBorderColor":"#ca8a04"}}}%%
flowchart LR
    classDef default fill:#f1f5f9,stroke:#94a3b8,color:#111827
    subgraph PANEL[" "]
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
    end
    classDef panel fill:#ffffff,stroke:#d1d5db,color:#111827
    class PANEL panel
```

The helpers in `packages/wow/src/safe.ts` are plain functions and cannot be injected, so they report swallowed errors to a
listener (`listenToSwallowedErrors`) that `DebugModeService` registers.

## One tick: a two-stage pipeline

Every 0.2 seconds (`@Interval(200)`, and on the next frame after relevant events) a tick runs. It has two stages
and one value passed between them, so the stage that decides never shows anything, and the stage that shows
never decides.

```mermaid
%%{init: {"theme":"base","themeVariables":{"background":"#ffffff","lineColor":"#6b7280","textColor":"#111827","primaryColor":"#f1f5f9","primaryTextColor":"#111827","primaryBorderColor":"#94a3b8","secondaryColor":"#e2e8f0","tertiaryColor":"#ffffff","mainBkg":"#f1f5f9","nodeBorder":"#94a3b8","nodeTextColor":"#111827","titleColor":"#111827","edgeLabelBackground":"#ffffff","labelBackground":"#ffffff","labelTextColor":"#111827","clusterBkg":"#ffffff","clusterBorder":"#d1d5db","classText":"#111827","actorBkg":"#f1f5f9","actorTextColor":"#111827","actorBorder":"#94a3b8","actorLineColor":"#6b7280","signalColor":"#374151","signalTextColor":"#111827","noteBkgColor":"#fef9c3","noteTextColor":"#111827","noteBorderColor":"#ca8a04"}}}%%
sequenceDiagram
    participant Tick as tick/TickService
    participant Find as tick/FindRemindersService
    participant Logic as reminders/*
    participant Show as tick/ShowRemindersService
    participant Screen as packages/wow/src/GlowService, NoticeService

    rect rgb(255, 255, 255)
        Tick->>Find: findReminders()
        Find->>Logic: rememberSelfBuffs() (out of combat)
        Note over Find: idle or muted: nothing is due
        Find->>Logic: findMissingBuffs(), findPartyBuffSuggestions(), weaponReminder.check()
        Find-->>Tick: Reminders (buffsToCast, weaponSpell, buffsNotOnBars, partySuggestions, outdatedRanks)
        Tick->>Show: showReminders(reminders)
        Show->>Screen: playAlertSound() for what is new
        Show->>Screen: showNotice(lines) (the same message not again within 30 s)
        Show->>Screen: glow.show(spells, color) (only when the set changed)
    end
```

The triggers are separate: each service says with decorators which game event it reacts to
(`@OnGameEvent`, `@OnUnitEvent`), and `tick/refresh.service.ts` merges and delays the requests (event bursts froze
Forever once), then calls `tick`. The first read of the game, the options page, the greeting and logout are
lifecycle hooks (`onFirstLogin`, `onLogin`, `onLogout`).
