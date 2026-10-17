# diagnostics/

Debug mode and the debug report. While debug mode is on, a sample is taken every second and the
events the game really sends are counted. Like `packages/wow/src/`, this folder may call the game, because it probes what the game
answers.

| File | What it does |
|---|---|
| `debug-mode.service.ts` | Switches debug mode on and off, following the `isDebugMode` setting. |
| `samples.service.ts` | What to look at once a second. |
| `recorder.service.ts` | Writes down what the game answered, in the saved settings. |
| `report.service.ts` | The collected data as text, to copy into a bug report (no character name, realm or chat). |
