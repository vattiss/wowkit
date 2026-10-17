# core/

The reminder loop. A *tick* looks at the game and shows what is due, in two stages:

1. `find-reminders.ts` finds everything that is due and returns a `Reminders` value (shows nothing).
2. `show-reminders.ts` shows it: sounds for what is new, the notice (`notices.ts`), the glows.

`tick.ts` runs them every 0.2 seconds. *When* to look sooner is decided by `refresh.ts` (merges
and delays requests) and `game-events.ts` (which game event matters); `town-visit.ts` holds the
reagent warning.

Entry point: `game-events.ts` (`startGameEvents`, called from `main.ts`).
