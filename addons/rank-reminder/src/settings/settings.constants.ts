import type { AddonSettings } from "./settings.interface";

/** The global the TOC saves per character (## SavedVariablesPerCharacter). */
export const SAVED_VARIABLES_NAME = "RankReminderCharDB";

export function createDefaultSettings(): AddonSettings {
    return { isMuted: false, hideResting: true, sound: "none" };
}
