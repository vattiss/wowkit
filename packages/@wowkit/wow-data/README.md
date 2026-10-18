# wow-data/

`@wowkit/wow-data`: the spell and item IDs of the World of Warcraft: Forever client that the addons use, written down by
category in one place. Blizzard's API documentation says that `C_Spell.GetSpellInfo(id)` exists; it does not say which
spell is which ID. This package does.

| File | What it holds |
|---|---|
| `src/spells.ts` | The spell IDs by class (`Paladin.BlessingMight`, `Shaman.Windfury` with every rank) with their group versions (`Priest.PrayerOfFortitude`). |
| `src/spells.ts`, at its end | `SPELL_NAME_HINT`: English names for IDs the client may not name, which `SpellsService` falls back on. |
| `src/items.ts` | The item IDs by category (`Reagents.HolyCandle`). |
| `data/ids.json` | What the client said of those IDs when it was last asked: `[19740, "Blessing of Might", 1]`, or `[19740]` for an ID the client does not know; under `candidates`, the spells the check found by the name of each unknown ID. |

## Using an ID

Write it in `src/spells.ts` or `src/items.ts` (a number is one ID; a list is the ranks of one spell, lowest first),
then use it from there. The code takes it from the package, so there is one place to correct it:

```ts
import { Paladin, Reagents } from "@wowkit/wow-data";

Paladin.BlessingMight; // 19740
Reagents.HolyCandle; // 17028
```

A new table (a new class, a new kind of item) is also added to the `SPELLS` or `ITEMS` object at the end of its file:
that object is what the check goes through. Keep both files free of imports, so scripts can load them as they are.

## Checking the IDs against the game

The [WowkitCheck](../../../addons/wowkit-check/README.md) addon asks the client about **every ID of these two files**:
`/wowkit check`. `node scripts/generate-wow-data.ts` turns what it saved into `data/ids.json`, and `pnpm check` compares
the two files with it (`scripts/check-ids.ts`), so a wrong or remapped ID fails the check without the game. Ask again
when the client is patched or an ID is added; the diff of `ids.json` shows what changed.

The package is compiled into the addons that use it, like `core` and `wow`; only the IDs they use end up in the Lua
file. `data/` is generated and never imported.
