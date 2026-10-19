# Buff Reminder

> **Moved.** This addon is replaced by **Glowing Bars**, which does what Buff Reminder, Rank Reminder and
> Reagent Reminder did, and lights the cooldowns and procs too. Install it from CurseForge and remove this addon.

A World of Warcraft: Forever addon (TOC `16001`) that reminds you of the buffs that are easy to forget.

- **Missing buffs**: every missing buff of your class list (Fortitude, Mark of the Wild, aspects, paladin auras,
  armors...) glows on its action button, all at once (one per group). Of a group (one aspect, one aura, one armor) any
  member counts. In combat, when the client hides auras, buffs you saw or cast are remembered.
- **Weapon buffs**: shaman imbues, rogue poisons (per hand) and warlock stones glow when missing or about to run out
  (30 s), with an alarm sound by default.
- **Not on your bars**: a message names missing buffs you have learned but put on no action bar.
- **Party buffs** (party, not raid; out of combat): a message names the members in range who miss one of your buffs
  (Fortitude, Mark of the Wild, Arcane Intellect for mana users, your blessing), and its button glows. With two or more
  missing and the reagent in your bags, it suggests the group version (Prayer of Fortitude, Gift of the Wild, Arcane
  Brilliance; a Greater Blessing per class). A group version on you counts as the buff.
- Quiet while dead, mounted, on a taxi, eating, or (optionally) resting in town.

Settings (per character): *Options > AddOns > Buff Reminder*: switches per feature and per buff, weapon buff pick, sounds,
glow colors, and a Help section with links to report problems. It is one page. Only Blizzard's own action bars are supported.

The old ranks and the low reagents are the jobs of [Rank Reminder](../rank-reminder/README.md) and
[Reagent Reminder](../reagent-reminder/README.md). How the code is organised: [src/](src/addon.ts), and
[docs/architecture.md](../../docs/architecture.md).
