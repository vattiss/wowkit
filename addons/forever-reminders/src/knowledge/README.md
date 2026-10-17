# knowledge/

What only this addon knows and the game does not say. `@forever/wow` asks for it
in its constructors and never imports this folder; `addon.ts` passes it in:

- The aura knowledge is `BuffKnowledgeService`: which buffs count for each other (the buff categories in
  `buff-categories.constants.ts`) and how long a buff lasts.
- The spell name hints are `spell-name-hints.constants.ts`: English spellbook names for IDs the client
  does not name.
