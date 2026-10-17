import type { SettingsService, SoundKey } from "@wowkit/ui";

/** The settings of this addon, saved per character. */
export interface AddonSettings {
    /** Turns the message off on this character. */
    isMuted: boolean;
    /** The sound the message plays. */
    sound: SoundKey;
    /** Per-reagent switches (by item ID); only set where the player changed the default (on). */
    reagentOn: { [itemId: string]: boolean | undefined };
}

/** The settings service of this addon: a SettingsService that knows the shape of its settings. */
export type AddonSettingsService = SettingsService<AddonSettings>;
