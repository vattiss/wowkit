import { isSoundKey } from "@wowkit/ui";
import type { Rgb } from "@wowkit/wow";
import type { AddonSettings, ColorKey } from "./settings.interface";

/** The global the TOC saves per character (## SavedVariablesPerCharacter). */
export const SAVED_VARIABLES_NAME = "KnowYourRotationCharDB";

export function createDefaultSettings(): AddonSettings {
    return {
        isMuted: false,
        hideResting: true,
        showRotation: true,
        showDefense: true,
        showInterrupt: true,
        showPurge: true,
        showCleanse: true,
        showTotem: true,
        showGroupCleanse: true,
        isSmartHeal: true,
        showPhysics: true,
        isRoleAutomatic: true,
        role: "damage",
        combatMode: "auto",
        aoeFrom: 3,
        soundInterrupt: "raidwarning",
        soundCleanse: "rolecheck",
        colors: {},
    };
}

export const COLOR_DEFAULTS: { [key in ColorKey]: Rgb } = {
    next: [1, 1, 1],
    heal: [0.15, 1, 0.28],
    healNow: [0.45, 1, 0.8],
    defense: [0.2, 0.55, 1],
    totem: [1, 0.6, 0.1],
    shot: [0.3, 0.9, 0.9],
};

/** The fixed colors of the interrupt, the purge and the cleanse. */
export const INTERRUPT_COLOR: Rgb = [1, 1, 0.35];
export const PURGE_COLOR: Rgb = [0.85, 0.35, 1];
export const CLEANSE_COLOR: Rgb = [0.35, 1, 0.45];

/**
 * Puts right what a saved value got wrong, and drops what the Lua addon of the same name saved before (its lists and
 * profiles): those keys mean nothing here.
 */
export function repairSettings(values: AddonSettings): void {
    const defaults = createDefaultSettings();
    for (const [key] of pairs(values)) {
        if ((defaults as unknown as Record<string, unknown>)[key as string] === undefined) {
            (values as unknown as Record<string, unknown>)[key as string] = undefined;
        }
    }
    for (const [key, value] of pairs(defaults)) {
        const saved = (values as unknown as Record<string, unknown>)[key as string];
        if (saved === undefined || type(saved) !== type(value)) (values as unknown as Record<string, unknown>)[key as string] = value;
    }
    if (!isSoundKey(values.soundInterrupt)) values.soundInterrupt = defaults.soundInterrupt;
    if (!isSoundKey(values.soundCleanse)) values.soundCleanse = defaults.soundCleanse;
    if (values.combatMode !== "auto" && values.combatMode !== "single" && values.combatMode !== "aoe") values.combatMode = "auto";
}
