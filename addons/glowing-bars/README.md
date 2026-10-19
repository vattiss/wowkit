# Glowing Bars

A World of Warcraft: Forever addon (TOC `16001`) that lights up your action bars. No window and no bars of its own: the
button you should press anyway glows. It replaces Buff Reminder, Rank Reminder and Reagent Reminder, and retires Know
Your Rotation.

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
- **Old ranks**: a spell on your action bars that is a lower rank than the one you know glows, quietly.
- **Reagents**: the group buff on your action bar (Prayer of Fortitude, Gift of the Wild...) glows, quietly, while its reagent runs low, also in a town; on arriving in a town or an inn a message names the reagents.
- **Ready cooldowns**: the important cooldowns of your class (Recklessness, Rapid Fire, Adrenaline Rush, Innervate...)
  glow when they are ready, in combat (or always, if you ask). The list per class is a default you can switch off spell
  by spell. When the client hides a cooldown in combat, the addon remembers the one it saw or started with a cast.
- **Procs**: a spell glows while the game says it can be used: Overpower, Revenge, Execute, Victory Rush, Riposte,
  Counterattack, Mongoose Bite, Hammer of Wrath.
- Quiet while dead, mounted, on a taxi, eating, or (optionally) resting in town.

Every kind of reminder has the same four settings: the **color** of its glow and message, the **opacity** of the glow
(1 to 100 percent), whether a short **message** at the top of the screen says so, and a **sound**. The defaults: missing
buffs blue, weapon buffs orange, ready cooldowns white, procs red, old ranks and low reagents yellow (and a quieter glow
than the others). They are set in a table, and every spell of your class can have a look of its own in the same table.
It opens with `/gb` or from the Settings page.

Settings (per character): *Options > AddOns > Glowing Bars*: a switch per feature and per spell, the button
that opens the table of looks, and a Help section with links to report problems. Only Blizzard's own action bars are supported.

How the code is organised: [src/](src/addon.ts), and [docs/architecture.md](../../docs/architecture.md). The old
addons are in the history, at the tags `buff-reminder-v1.0.2`, `rank-reminder-v1.0.2`, `reagent-reminder-v1.0.2` and
`know-your-rotation-v1.0.2`.
