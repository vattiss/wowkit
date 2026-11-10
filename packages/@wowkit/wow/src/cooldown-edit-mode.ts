// The Visibility of the Cooldown Manager's windows in Edit Mode. Only through the C_EditMode data: Edit Mode's own Lua would
// spread taint. The game applies a saved layout at the next load of the interface.
import { attempt } from "./utils/protected-call.utils";

/** The saved layouts with Blizzard's presets first: SaveLayouts takes that list, and activeLayout counts through it. */
function readLayoutsToSave(): EditModeLayouts | undefined {
    const saved = C_EditMode.GetLayouts();
    const presets = EditModePresetLayoutManager.GetCopyOfPresetLayouts();
    // Saving without the presets would hand the game a list its own index no longer fits
    if (presets.length === 0) return undefined;
    return { ...saved, layouts: [...presets, ...saved.layouts] };
}

/** The settings of the active layout's windows that say Hidden; a preset cannot be changed, and has none. */
function listHiddenSettings(saved: EditModeLayouts): EditModeSettingInfo[] {
    const active = saved.layouts[saved.activeLayout - 1];
    if (active === undefined || active.layoutType === Enum.EditModeLayoutType.Preset) return [];
    const hidden: EditModeSettingInfo[] = [];
    for (const system of active.systems) {
        if (system.system !== Enum.EditModeSystem.CooldownViewer) continue;
        for (const setting of system.settings) {
            if (setting.setting !== Enum.EditModeCooldownViewerSetting.VisibleSetting) continue;
            if (setting.value === Enum.CooldownViewerVisibleSetting.Hidden) hidden.push(setting);
        }
    }
    return hidden;
}

/** Is a window of the Cooldown Manager set to Hidden in the active layout? */
export function hasHiddenWindows(): boolean {
    return (
        attempt(() => {
            const saved = readLayoutsToSave();
            return saved !== undefined && listHiddenSettings(saved).length > 0;
        }) === true
    );
}

/** Sets the windows Hidden in the active layout to always show. How many there were; undefined when it could not be done. */
export function repairHiddenWindows(): number | undefined {
    return attempt(() => {
        const saved = readLayoutsToSave();
        if (saved === undefined) return undefined;
        const hidden = listHiddenSettings(saved);
        for (const setting of hidden) setting.value = Enum.CooldownViewerVisibleSetting.Always;
        if (hidden.length > 0) C_EditMode.SaveLayouts(saved);
        return hidden.length;
    });
}
