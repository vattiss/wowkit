# Architecture

Forever Reminders is a World of Warcraft: Forever addon written in TypeScript and compiled to a
single Lua file. This page shows how it is built, how the code is organised, and the two rules that
keep it readable.

## The two rules

**1. Only `src/wow/` and `src/ui/` talk to the game.**
Blizzard's API is full of quirks: values that are secret in combat, calls that can raise errors,
spell IDs that Forever remaps, `multiple, return, values`. All of that stays inside `src/wow/`,
which turns it into plain answers in the addon's own words (`isInCombat()`, `isLearned(spell)`,
`getItemCount(item)`). The reminder logic in `src/reminders/` never sees a Blizzard function, so it
reads like plain code. `src/ui/` is the other place that may call the game, because the options page
and the debug report are built from the Settings panel API.

**2. Names read like English.**
Functions start with a verb (`getSpellName`, `findMissingBuffs`, `showNotice`). Booleans read as
questions (`isFound`, `hasArrived`, `shouldRecheckDrop`).

Both rules are checked by `npm run check` (part of `npm test`), so they cannot creep back in.

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

    docs -- "npm run fetch:wow-ui<br/>(sparse clone, pinned commit)" --> cache[".cache/wow-ui-source"]
    cache -- "npm run gen:types<br/>scripts/generate-wow-types.ts" --> generated

    src["src/**/*.ts"] --> tstl["TSTL<br/>luaTarget 5.1, luaBundle,<br/>noImplicitSelf"]
    generated --> tstl
    manual --> tstl
    tstl --> lua["dist/ForeverReminders/<br/>ForeverReminders.lua"]
    toc["addon/ForeverReminders.toc<br/>addon/images"] -- "scripts/package-addon.ts<br/>(@version@)" --> dist["dist/ForeverReminders/"]
    lua --> dist
    dist -- "npm test<br/>LuaJIT + test/mock_wow.lua" --> smoke["smoke test"]
    dist -- "npm run deploy" --> game["_classic_beta_/Interface/AddOns"]
```

## Code layout

Dependencies point downwards only. `wow/` imports no reminder logic and no settings; when it has
news for something above it, it fires a signal (see below).

```mermaid
flowchart TB
    main["main.ts<br/>wires everything together"]
    core["core.ts<br/>the 0.2 s tick, game events, notices"]

    subgraph ui["ui/ (may call the game: Settings panel)"]
        optionsPage["options-page.ts<br/>the Settings panel pages"]
        diagnostics["diagnostics.ts<br/>debug report"]
    end

    subgraph reminders["reminders/ (what to remind about; no Blizzard calls)"]
        buffReminder["buff-reminder.ts<br/>which buffs are missing"]
        classBuffs["class-buffs.ts<br/>the class buff list, switches"]
        weaponChoice["weapon-choice.ts<br/>which weapon buff"]
        weaponReminder["weapon-reminder.ts<br/>class WeaponReminder"]
        partyBuffs["party-buffs.ts<br/>party members missing a buff"]
        reagents["reagents.ts<br/>reagent stock"]
    end

    subgraph wow["wow/ (the only code that calls the game)"]
        spells["spells.ts, spellbook.ts<br/>learned, ranks, castable"]
        auras["auras.ts, aura-memory.ts<br/>buffs on the player and the party"]
        weaponEnchants["weapon-enchants.ts"]
        actionBars["action-bars.ts<br/>which spell is on which button"]
        player["player.ts, party.ts"]
        screen["glow.ts, notice.ts<br/>glows, notices, sounds, chat"]
        misc["clock.ts, bags.ts, events.ts,<br/>saved-variables.ts"]
        safe["safe.ts<br/>secret values, protected calls"]
    end

    shared["settings.ts, locale.ts, constants.ts<br/>data/ (buff lists, spell IDs), util/"]
    game[("WoW client<br/>C_* APIs, frames, events")]

    main --> core
    main --> ui
    core --> reminders
    core --> wow
    ui --> reminders
    ui --> wow
    reminders --> wow
    reminders --> shared
    wow --> shared
    wow --> game
    ui --> game
```

## Signals (notifications upwards)

TSTL bundles modules with `require`, which cannot resolve import cycles, so lower modules never
import upper ones. They expose a signal (`util/signal.ts`) and the upper module subscribes.

```mermaid
flowchart LR
    spellbook["SpellBookIndex.built"] --> spells["wow/spells.ts"]
    spells -- "spellsInvalidated" --> auras["wow/auras.ts<br/>drops aura scans"]
    spells -- "spellsInvalidated" --> weaponChoice["weapon-choice.ts<br/>drops name caches"]
    spells -- "spellBookIndexed" --> core["core.ts<br/>ticks again"]
    actionBars["wow/action-bars.ts"] -- "barsMapped" --> core
    settings["settings.ts"] -- "settingChanged" --> core
    settings -- "settingChanged (isDebugMode)" --> diagnostics["ui/diagnostics.ts"]
    safe["wow/safe.ts"] -- "swallowedError" --> diagnostics
    core -- "booted" --> main["main.ts<br/>registers options,<br/>starts debug"]
```

## One tick

Every 0.2 seconds (and on the next frame after relevant events) the core decides what glows and
what the notice says.

```mermaid
sequenceDiagram
    participant Core as core.ts
    participant Player as wow/player
    participant Buff as buff-reminder
    participant Bars as wow/action-bars
    participant Weapon as WeaponReminder
    participant Screen as wow/glow, wow/notice

    Core->>Buff: rememberSelfBuffs() (out of combat)
    Core->>Player: shouldStayIdle(quietWhenResting)
    alt not idle
        Core->>Buff: findMissingBuffs()
        Buff->>Bars: isOnBars(spell)
        Buff-->>Core: glow, notOnBars
        Core->>Weapon: check()
        Weapon-->>Core: spellId, remain, isNeeded
        Core->>Core: findPartyBuffSuggestions() (out of combat, at most every 1 s)
    end
    Core->>Screen: playAlertSound() when a reminder is new
    Core->>Bars: findOutdatedRanks()
    Core->>Screen: showNotice(lines) (repeats at most every 30 s)
    Core->>Screen: glow.show(spells, color) (only on change)
```
