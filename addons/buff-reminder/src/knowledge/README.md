# knowledge/

What only this addon knows and the game does not say. `@wowkit/wow` asks for it
in its constructors and never imports this folder; `addon.ts` passes it in:

- The aura knowledge is `BuffKnowledgeService`: which buffs count for each other (the buff categories in
  `buff-categories.constants.ts`) and how long a buff lasts.
- The spell name hints (English spellbook names for IDs the client does not name) are game data, so they are in
  `@wowkit/wow`; `addon.ts` passes them to `SpellsService`.
