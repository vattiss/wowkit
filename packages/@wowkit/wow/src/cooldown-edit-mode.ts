// The Visibility of the Cooldown Manager's windows in Edit Mode. Only through the C_EditMode data: Edit Mode's own Lua would
// spread taint. The game applies a saved layout at the next load of the interface.
import { attempt } from "./utils/protected-call.utils";

/** The saved layouts with Blizzard's presets first: SaveLayouts takes that list, and activeLayout counts through it. */
function readLayoutsToSave(): EditModeLayouts | undefined {
    const saved = C_EditMode.GetLayouts();
    const presets = EditModePresetLayoutManager.GetCopyOfPresetLayouts();
    // Saving without the presets would hand the game a list its own index no longer fits
    if (presets.length === 0) return undefined;
    saved.layouts = [...presets, ...saved.layouts];
    return saved;
}

function showHiddenWindows(saved: EditModeLayouts): number {
    const active = saved.layouts[saved.activeLayout - 1];
    if (active === undefined || active.layoutType === Enum.EditModeLayoutType.Preset) return 0;
    let count = 0;
    for (const system of active.systems) {
        if (system.system !== Enum.EditModeSystem.CooldownViewer) continue;
        for (const setting of system.settings) {
            if (setting.setting !== Enum.EditModeCooldownViewerSetting.VisibleSetting) continue;
            if (setting.value !== Enum.CooldownViewerVisibleSetting.Hidden) continue;
            setting.value = Enum.CooldownViewerVisibleSetting.Always;
            count += 1;
        }
    }
    return count;
}

/** Sets the windows Hidden in the active layout to always show. How many there were; undefined when it could not be done. */
export function repairHiddenWindows(): number | undefined {
    return attempt(() => {
        const saved = readLayoutsToSave();
        if (saved === undefined) return undefined;
        const count = showHiddenWindows(saved);
        if (count > 0) C_EditMode.SaveLayouts(saved);
        return count;
    });
}
