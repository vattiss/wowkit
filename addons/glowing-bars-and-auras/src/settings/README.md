# settings/

The addon's per-character settings, saved by the game as `GlowingBarsAndAurasCharDB`. The service is the generic
`SettingsService<T>` of `@wowkit/ui` ([ui/](../../../../packages/@wowkit/ui/README.md)): `get`, `change` (announces
`setting.changed`), Only the shape is this addon's:

- `settings.interface.ts`: `AddonSettings` (the shape), `AddonSettingsService` (the service typed with it).
- `settings.constants.ts`: the defaults, the glow colors and the name of the saved variable, which `addon.ts` passes to
  `SavedVariablesService` of `@wowkit/wow`.
- `settings.colors.ts`: the glow color of a reminder, the player's choice or the default.
