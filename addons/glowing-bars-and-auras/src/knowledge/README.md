# knowledge/

What only this addon knows and the game does not say:

- `BuffKnowledgeService`: which buffs count for each other (the buff categories in `buff-categories.constants.ts`),
  which are shapeshift forms, and how long a buff lasts. The names come from the client by spell ID, so they hold in
  every language. `character/buff-state.service.ts` and `character/buff-memory.service.ts` use it.
- The spell name hints (English spellbook names for IDs the client does not name) are facts about the game: they are in
  `@wowkit/wow-data` (`SPELL_NAME_HINT`), and `SpellsService` reads them itself.
