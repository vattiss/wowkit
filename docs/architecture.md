# Architecture

Forever Reminders is a World of Warcraft: Forever addon written in TypeScript and compiled to a
single Lua file. This page shows how it is built and how its modules depend on each other at run
time.

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

## Run-time layers

Dependencies point downwards only. `api/`, `data/` and `util/` import nothing from the layers
above them; when a lower module has news for an upper one, it fires a signal (see below).
`main.ts` is the composition root: the only place that wires modules together.

```mermaid
flowchart TB
    main["main.ts<br/>composition root"]

    subgraph ui["Presentation"]
        options["options.ts<br/>Settings panel page"]
        debug["debug.ts<br/>debug report"]
        glow["glow.ts<br/>button glows"]
        notice["notice.ts<br/>on-screen notice, sounds"]
        locale["locale.ts<br/>strings, chat"]
    end

    subgraph app["Application"]
        core["core.ts<br/>0.2 s tick, game events,<br/>scheduling"]
        events["events.ts<br/>typed event subscriptions"]
        settings["settings.ts<br/>saved settings,<br/>changeSetting()"]
    end

    subgraph domain["Domain"]
        buffReminder["buff-reminder.ts<br/>missing buffs"]
        partyBuffs["party-buffs.ts<br/>party members missing<br/>the player's buffs"]
        reagents["reagents.ts<br/>reagent stock"]
        weaponReminder["weapon-reminder.ts<br/>class WeaponReminder"]
        weaponChoice["weapon-choice.ts<br/>which weapon buff"]
        buffs["buffs.ts<br/>class buff list,<br/>per-buff switches"]
        actionBars["action-bars.ts<br/>spell to button map,<br/>old ranks"]
    end

    subgraph api["Client API (api/)"]
        spells["spells.ts<br/>resolution, ranks"]
        spellbook["spellbook.ts<br/>class SpellBookIndex"]
        auras["auras.ts<br/>aura reads"]
        auraMemory["aura-memory.ts<br/>class AuraMemory"]
        weapon["weapon.ts<br/>weapon enchants"]
        unit["unit.ts<br/>combat, idle"]
    end

    subgraph base["Data and utilities"]
        data["data/<br/>buff lists, weapon buffs,<br/>aura families, spell IDs"]
        util["util/<br/>safe.ts, text.ts, signal.ts"]
        constants["constants.ts"]
    end

    client[("WoW client<br/>C_* APIs, frames, events")]

    main --> core
    main --> options
    main --> debug
    main -. "duration lookup" .-> auras

    options --> glow
    options --> notice
    options --> debug
    options --> settings
    options --> weaponChoice
    options --> buffs
    debug --> buffReminder
    debug --> weaponReminder
    debug --> actionBars
    glow --> actionBars

    core --> events
    core --> settings
    core --> glow
    core --> notice
    core --> buffReminder
    core --> partyBuffs
    core --> reagents
    core --> weaponReminder
    core --> actionBars

    buffReminder --> buffs
    partyBuffs --> buffs
    partyBuffs --> reagents
    partyBuffs --> auras
    partyBuffs --> unit
    reagents --> spells
    buffReminder --> actionBars
    buffReminder --> auras
    weaponReminder --> weaponChoice
    weaponReminder --> auras
    weaponReminder --> weapon
    weaponChoice --> buffs
    buffs --> settings
    actionBars --> spells

    spells --> spellbook
    auras --> auraMemory
    auras --> spells
    auras --> unit
    auraMemory --> spells

    api --> base
    domain --> base

    events --> client
    api --> client
    actionBars --> client
    glow --> client
    notice --> client
```

## Signals (notifications upwards)

TSTL bundles modules with `require`, which cannot resolve import cycles, so lower modules never
import upper ones. They expose a signal (`util/signal.ts`) and the upper module subscribes.

```mermaid
flowchart LR
    spellbook["SpellBookIndex.built"] --> spells["spells.ts"]
    spells -- "spellsInvalidated" --> auras["auras.ts<br/>drops aura scans"]
    spells -- "spellsInvalidated" --> weaponChoice["weapon-choice.ts<br/>drops name caches"]
    spells -- "spellBookIndexed" --> core["core.ts<br/>ticks again"]
    actionBars["action-bars.ts"] -- "barsMapped" --> core
    settings["settings.ts"] -- "settingChanged" --> core
    settings -- "settingChanged (debugMode)" --> debug["debug.ts"]
    safe["util/safe.ts"] -- "swallowedError" --> debug
    core -- "booted" --> main["main.ts<br/>registers options,<br/>starts debug"]
```

## One tick

Every 0.2 seconds (and on the next frame after relevant events) the core decides what glows and
what the notice says.

```mermaid
sequenceDiagram
    participant Core as core.ts
    participant Unit as api/unit
    participant Buff as buff-reminder
    participant Bars as action-bars
    participant Weapon as WeaponReminder
    participant Glow as glow / notice

    Core->>Buff: rememberSelfBuffs() (out of combat)
    Core->>Unit: shouldStayIdle(hideResting)
    alt not idle
        Core->>Buff: missingBuffs()
        Buff->>Bars: isOnBars(spell)
        Buff-->>Core: glow, notOnBars
        Core->>Weapon: check()
        Weapon-->>Core: spellId, remain, need
        Core->>Core: partyBuffSuggestions() (out of combat, at most every 1 s)
    end
    Core->>Glow: play sound when a reminder is new
    Core->>Bars: oldRanksOnBars()
    Core->>Glow: showNotice(lines) (repeats at most every 30 s)
    Core->>Glow: buffGlow.show(), weaponGlow.show() (only on change)
```
