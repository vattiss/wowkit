# Know Your Rotation

> **Retired.** This addon is no longer developed. **Glowing Bars And Auras** replaces the reminders of the Forever
> Reminders addons and lights ready cooldowns and procs on your action bars; it has no rotation queue. Install it from
> CurseForge if that is what you need.

A World of Warcraft: Forever addon (TOC `16001`) for leveling and learning a class: the spell to press next lights up
on your action bar. No window, no bars of its own: only the glow on the button you would press anyway.

| Cue | What lights up | Color |
|---|---|---|
| **Rotation** | The next spell of your class's list, when you can press it right now | White |
| **Heal** | A heal once the health you are missing is about what it restores (your own, or a party member you selected); a HoT or shield whenever it is missing | Mint (quick heal), green (kept up) |
| **Defense** | A defensive cooldown when your health is low (Shield Wall, Divine Protection, Ice Block...) | Blue |
| **Interrupt** | Your interrupt while the target casts something you can interrupt | Yellow |
| **Purge** | Your purge when the target has a magic effect you can remove (the mage: one it can steal) | Purple |
| **Cleanse** | Your cure for an effect on you (and, optionally, your group) | Green |
| **Totems** | The totems of your totem bar: buff totems at the start of a fight, slows and area totems once enemies are in melee | Orange |
| **Hunter shots** | Auto Shot (when it is off) and Concussive Shot, next to the rotation, never in melee range | Cyan |

How it decides:

- **The pull**: out of combat, with an enemy not yet in melee range, the first spell with a cast time opens (Fireball,
  Smite, Lightning Bolt): the cast is free while the mob runs in. Offensive racials (Blood Fury, Berserking, Elune's Light,
  Eureka) come first, once the target is near.
- **Fillers yield**: a spammed spell (Heroic Strike, Mind Flay) gives way to a ready action listed after it (a DoT, a
  shock, a cooldown, a proc).
- **One pass**: a spell you cast is not offered again until the list is walked through; a DoT waits for its duration on
  that target. A new target starts over.
- **Hidden health**: the game hides health and mana from addons in combat. Heals, defensive cooldowns, executes and Life
  Tap then glow faded in by the game itself, as the hidden value passes the threshold.
- **Roles**: automatic from your main talent tree (Protection: tank; Holy, Discipline, Restoration: heal), for hunters and
  shamans also from the distance to the target (melee or range); the druid's list follows the form (cat, bear).
- **AoE**: the AoE list once enough enemies fight you (3 by default; nameplates must be on).
- Aimed Shot, Multi-Shot and Volley wait for the next Auto Shot; energy spells are offered when the next tick brings
  their energy.
- Quiet while dead, mounted, on a taxi, eating, or (by default) resting in a town or an inn.

Settings (per character): *Options > AddOns > Know Your Rotation*: disable on this character, a switch per cue, the glow
colors, the sounds of the interrupt and the cleanse, the role, the combat mode and the AoE threshold, the smart heal
threshold. Only Blizzard's own action bars are supported.

It suggests a sensible order for leveling and learning a class, not a tuned endgame rotation: talents, cooldowns and boss
mechanics are not part of the lists. The lists cannot be edited yet.

The long buffs (auras, blessings, armors, aspects, shields, Battle Shout), the weapon buffs and the old ranks are the
jobs of [Buff Reminder](../buff-reminder/README.md) and [Rank Reminder](../rank-reminder/README.md).

## Credits

Based on Forever Rotation by Vohnka (wow-forever.fr) and the Lua addon Know Your Rotation, rewritten in TypeScript on
the packages of this repository. MIT, see [LICENSE](LICENSE).

How the code is organised: [src/](src/addon.ts), one README per folder.
