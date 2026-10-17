import type { SettingsService, SoundKey } from "@wowkit/ui";

/** The settings of this addon, saved per character. */
export interface AddonSettings {
    /** Turns the message off on this character. */
    isMuted: boolean;
    /** No message while resting in a town or an inn. */
    hideResting: boolean;
    /** The sound the message plays. */
    sound: SoundKey;
}

/** The settings service of this addon: a SettingsService that knows the shape of its settings. */
export type AddonSettingsService = SettingsService<AddonSettings>;
