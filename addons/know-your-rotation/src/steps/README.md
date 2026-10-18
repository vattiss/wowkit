# steps/

Is a step offered right now? `step.service.ts` runs the conditions of the step in a fixed order (the first that refuses
gives the reason), then asks whether the spell can be pressed: its cooldown, the client's "usable", its cost, the range.

The conditions are small checks grouped by what they look at: `target-checks.service.ts` (the target),
`player-checks.service.ts` (the player: level, combat, pet, form, combo points, mana), `aura-checks.service.ts` (buffs and
debuffs kept up or needed), `timing-checks.service.ts` (the hold, the health threshold, a proc, the cooldown). The order
matters: the aura checks clear a spell's hold when the aura is readably gone, before the hold is checked.

A new condition is a field of `StepOptions`, a method in the checks service it belongs to, and one line in the list of
`StepService`.
