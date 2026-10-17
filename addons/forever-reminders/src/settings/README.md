# settings/

The addon's per-character settings, saved by the game as `ForeverRemindersCharDB`.

- `settings.service.ts`: `get(key)` reads, `change(key, value)` changes a player choice and announces it
  (`setting.changed` on the EventBus), `write(key, value)` writes diagnostic data without announcing. The saved
  values are loaded in `onAddonLoaded`.
- `settings.interface.ts`: the shape of the settings. `settings.constants.ts`: the defaults and the glow colors.

`settings.constants.ts` also holds the name of the saved variable, which `addon.ts` passes to `SavedVariablesService` of `@forever/wow`.
