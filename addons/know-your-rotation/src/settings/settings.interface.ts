import type { SettingsService, SoundKey } from "@wowkit/ui";
import type { Rgb } from "@wowkit/wow";

/** The glow colors the player can change. */
export type ColorKey = "next" | "heal" | "healNow" | "defense" | "totem" | "shot";

export type CombatMode = "auto" | "single" | "aoe";

/** The settings of this addon, saved per character. */
export interface AddonSettings {
    /** Turns every glow and sound off on this character. */
    isMuted: boolean;
    /** No glow while resting in a town or an inn. */
    hideResting: boolean;
    showRotation: boolean;
    showDefense: boolean;
    showInterrupt: boolean;
    showPurge: boolean;
    showCleanse: boolean;
    showTotem: boolean;
    /** The cleanse also for the party, the target, the focus and the mouseover. */
    showGroupCleanse: boolean;
    /** The smart heal threshold: a heal once the missing health is about what it restores. */
    isSmartHeal: boolean;
    /** Aimed Shot, Multi-Shot and Volley wait for the next Auto Shot. */
    showPhysics: boolean;
    isRoleAutomatic: boolean;
    /** The role picked by hand (used when not automatic). */
    role: string;
    combatMode: CombatMode;
    /** Enemies from which the automatic mode uses the AoE list. */
    aoeFrom: number;
    soundInterrupt: SoundKey;
    soundCleanse: SoundKey;
    colors: { [key in ColorKey]?: Rgb };
}

/** The settings service of this addon: a SettingsService that knows the shape of its settings. */
export type AddonSettingsService = SettingsService<AddonSettings>;
