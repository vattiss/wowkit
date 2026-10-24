# Wowkit Check

A developer tool, **not released**: it asks the World of Warcraft: Forever client about the spell and item IDs written in
[@wowkit/wow-data](../../packages/@wowkit/wow-data/README.md) and saves the answers, so the IDs can be checked against
the real game. It is disabled by default (`## DefaultState: disabled`), has no logo and no `zip` script, so the release
tags and `pnpm zip` skip it.

## In the game

Enable it in the addon list once, then type `/wowkit` (or `/wowkit check`). The addon goes through **every ID written in
wow-data** (the class buff spells with their group versions, the weapon buffs and their ranks, the reagent items) and
asks the client for the name and rank of each. It says which IDs the client does not know. It takes a few seconds; the
items answer 3 seconds after the first ask, because the client loads an item name then.

**Looking for the real ID.** For a spell ID the client does not know, the check then goes through the spell IDs (a few
hundred a frame, so the game stays playable, about half a minute) and lists the spells whose name has all the words of
the name the code gives the ID: `Paladin.BlessingLight` finds the spells with "blessing" and "light" in their
name, with their IDs and ranks. Correct the ID in wow-data with what it finds. Items are not searched, because the client
loads an item name from the server on the first ask.

The game writes the saved variable to disk on `/reload` or logout. It is account-wide: `WowkitCheckDB`.

**IDs in the tooltips.** While the addon is enabled, every spell tooltip (the spellbook, the action bars, links) ends
with `Spell ID: <id>`, and the tooltip of an item with a use (an elixir, a potion, food) with `Use spell ID: <id>`, the
spell the item casts. It is how an ID is read off the game before it is written in wow-data.

## On this machine

```
node scripts/generate-wow-data.ts --game 1.60.1.70425   # writes packages/@wowkit/wow-data/data/ids.json, with the candidates
node scripts/check-ids.ts                                # the IDs in wow-data against ids.json, with no game (also part of pnpm check)
```

The script looks for `WTF/Account/<ACCOUNT>/SavedVariables/WowkitCheck.lua` next to the game's `Interface` folder
(`WOW_ADDONS_DIR`), or takes the file as an argument. `ids.json` is part of the repository, so the check needs no game;
run `/wowkit` again after a client patch or when an ID is added to wow-data.

Not checked: the weapon `enchants` IDs (the client reports one only for the weapon you wear with the buff on, and has no
list of them).

## Code

`src/id-check.service.ts` is the check, with no game calls of its own (it uses the services of `@wowkit/wow`); the lists
it asks about are the tables of `@wowkit/wow-data`. `src/options/check-command.ts` is the slash command, the only part
that touches the game. `src/id-tooltip.service.ts` adds the ID lines to the tooltips, through `TooltipService` of `@wowkit/wow`. The spec in `test/` runs the check against the fake game.
