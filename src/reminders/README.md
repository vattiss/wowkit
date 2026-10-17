# reminders/

What the addon reminds about, and when: missing buffs, the weapon buff, party members missing a
buff, low reagents. Plain logic, in the words of [../../docs/glossary.md](../../docs/glossary.md).

- Never calls the game directly; it asks `wow/` (`npm run check` enforces it).
- Never shows anything; `core/` shows what these modules find.

A toolbox: each file answers one question (`buff-reminder.ts`: which buffs are missing,
`weapon-reminder.ts`: does the weapon buff need attention...).
