# ui/

What the player sees in the game's Settings panel and what a bug report needs. Like `wow/`, this
folder may call the game, because the Settings panel API is the game's.

- `options/`: the pages (landing, reminders, debug report). Entry point: `register-options.ts`.
  The pages only read and change settings (`changeSetting`); whoever cares reacts to `settingChanged`.
- `diagnostics/`: debug mode, what it samples, the recorder, the report text. Entry point:
  `debug-mode.ts` (`initDebug`, `applyDebugMode`); the debug page also uses `recorder.ts` and `report.ts`.
