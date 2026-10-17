import { isSoundKey } from "@wowkit/ui";
import type { AddonSettings } from "./settings.interface";

/** The global the TOC saves per character (## SavedVariablesPerCharacter). */
export const SAVED_VARIABLES_NAME = "ReagentReminderCharDB";

export function createDefaultSettings(): AddonSettings {
    return { isMuted: false, sound: "none", reagentOn: {} };
}

/** A saved sound that is no longer in the list is the default again. */
export function repairSettings(values: AddonSettings): void {
    if (!isSoundKey(values.sound)) values.sound = createDefaultSettings().sound;
}
