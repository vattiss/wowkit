import type { Rgb } from "@wowkit/wow";
import { COLOR_DEFAULTS } from "./settings.constants";
import type { AddonSettingsService, ColorKey } from "./settings.interface";

/** The glow color of a reminder: the player's choice, else the default. */
export function getGlowColor(settings: AddonSettingsService, key: ColorKey): Rgb {
    const saved = settings.get("colors")[key];
    if (saved !== undefined && type(saved) === "table" && tonumber(saved[0]) !== undefined) {
        return [saved[0], saved[1] ?? 0, saved[2] ?? 0];
    }
    return COLOR_DEFAULTS[key];
}
