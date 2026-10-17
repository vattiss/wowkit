import type { Rgb } from "@forever/wow";
import type { AddonSettings, ColorKey } from "./settings.interface";

/** The global the TOC saves per character (## SavedVariablesPerCharacter). */
export const SAVED_VARIABLES_NAME = "ForeverRemindersCharDB";

export function createDefaultSettings(): AddonSettings {
    return {
        isMuted: false,
        hideResting: true,
        showBuff: true,
        showWeapon: true,
        showBarNotice: true,
        showRankNotice: true,
        showPartyBuffs: true,
        showReagentNotice: true,
        soundBuff: "none",
        soundWeapon: "alarm",
        colors: {},
        buffOn: {},
        isDebugMode: false,
    };
}

export const COLOR_DEFAULTS: { [key in ColorKey]: Rgb } = {
    buff: [0.2, 0.55, 1],
    weapon: [1, 0.12, 0.08],
};
