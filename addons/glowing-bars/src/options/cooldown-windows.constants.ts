import type { CooldownWindow } from "@wowkit/wow";
import type { TextKey } from "../locale/texts.constants";

/** The windows of the Cooldown Manager, as Blizzard names them. */
export const WINDOW_TEXTS: { [window in CooldownWindow]: TextKey } = {
    essential: "OPT_BAR_ESSENTIAL",
    utility: "OPT_BAR_UTILITY",
    trackedBuffs: "OPT_BAR_TRACKED_BUFFS",
    trackedBars: "OPT_BAR_TRACKED_BARS",
};
