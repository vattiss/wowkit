// Turning Blizzard's Cooldown Manager on or off, as the player's choice needs it. Only as the interface closes, never while it
// runs: the game's own code reacts to the setting at once, and marked as the addon's it is then refused what it does next, in a
// fight (issue #66). So it is done by the Reload buttons, just before they reload, and at every logout or reload.
import type { CooldownViewerService } from "@wowkit/wow";
import type { AddonSettingsService } from "../settings/settings.interface";

/** What the manager waits for until the next reload: to be turned on, or off. */
export type WaitingSwitch = "on" | "off" | undefined;

/** The addon turns off only a manager it turned on; an addon that runs the manager's windows has it on itself. */
export function findWaitingSwitch(settings: AddonSettingsService, viewer: CooldownViewerService): WaitingSwitch {
    if (settings.get("cooldownManagerAccess") === "off") {
        return settings.get("isCooldownManagerOurs") && viewer.isTurnedOn() ? "off" : undefined;
    }
    return !viewer.isRunByOtherAddon() && !viewer.isTurnedOn() ? "on" : undefined;
}

/** Just before a reload, or as the interface closes. */
export function applyWaitingSwitch(settings: AddonSettingsService, viewer: CooldownViewerService): void {
    const waiting = findWaitingSwitch(settings, viewer);
    if (waiting === "on") {
        viewer.enable();
        settings.change("isCooldownManagerOurs", true);
    } else if (settings.get("cooldownManagerAccess") === "off" && settings.get("isCooldownManagerOurs")) {
        if (waiting === "off") viewer.disable();
        settings.change("isCooldownManagerOurs", false);
    }
}
