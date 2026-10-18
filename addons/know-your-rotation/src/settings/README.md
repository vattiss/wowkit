# settings/

The addon's per-character settings, saved by the game as `KnowYourRotationCharDB`. The service is the generic
`SettingsService<T>` of `@wowkit/ui` ([ui/](../../../../packages/@wowkit/ui/README.md)); only the shape is this addon's:

- `settings.interface.ts`: `AddonSettings` (a switch per cue, the role and the combat mode, the sounds, the colors).
- `settings.constants.ts`: the defaults, the colors, and `repairSettings`, which also drops what the Lua addon of the
  same name saved (its lists and profiles).
- `settings.colors.ts`: the glow color of a cue, the player's choice or the default.
