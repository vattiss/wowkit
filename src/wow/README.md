# wow/

The only place (with `ui/`) that calls the game. It turns the game's quirks (secret values, hidden
auras, protected calls, remapped IDs) into plain answers in the addon's own words:
`isInCombat()`, `isLearned(spell)`, `getItemCount(item)`.

- Reminder logic never calls the game; it asks these modules. `npm run check` enforces it.
- Nothing here imports reminder logic or settings. When something here has news for the code above,
  it fires a signal (`util/signal.ts`).
- Why the code is defensive: [../../docs/forever-quirks.md](../../docs/forever-quirks.md).

A toolbox: most files are meant to be imported, so there is no single entry file.
