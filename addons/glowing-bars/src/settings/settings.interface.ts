import type { SettingsService, SoundKey } from "@wowkit/ui";
import type { Rgb } from "@wowkit/wow";

/** The kinds of reminder. Each has a look (color, opacity, message, sound) the player can change for the kind and for a spell. */
export type ColorKey = "buff" | "weapon" | "cooldown" | "proc" | "rank" | "reagent";

/** The settings service of this addon: a SettingsService that knows the shape of its settings. */
export type AddonSettingsService = SettingsService<AddonSettings>;

/** How a reminder looks and sounds. */
export interface Style {
    /** Of the glow and of the message. */
    color: Rgb;
    /** The opacity of the glow, 1 to 100 percent. */
    opacity: number;
    /** Does a short message at the top of the screen say so? */
    isTextOn: boolean;
    sound: SoundKey;
}

/** The parts of a look the player changed; the rest is inherited. */
export type StyleOverride = Partial<Style>;

export interface AddonSettings {
    isMuted: boolean;
    hideResting: boolean;
    showBuff: boolean;
    showWeapon: boolean;
    /** Party members missing the player's buffs. */
    showPartyBuffs: boolean;
    /** Spells on the bars at a lower rank than the one the player knows. */
    showRanks: boolean;
    /** The reagents of the group buffs running low, on arriving in a town. */
    showReagents: boolean;
    /** Important cooldowns that are ready. */
    showCooldowns: boolean;
    /** Also out of combat (by default only in combat). */
    showCooldownsOutOfCombat: boolean;
    /** As a fight starts, every ready cooldown glows too (a reminder to use it), for the same time. */
    showCooldownsAtFightStart: boolean;
    /** How long a cooldown glows in a fight once it is back, in seconds; 0 = until it is pressed. */
    cooldownGlowSeconds: number;
    /** Spells the game says are usable now (Overpower, Revenge, Execute...). */
    showProcs: boolean;
    /** The player's changes to the look of each kind of reminder (the default look of its spells). */
    styles: { [key in ColorKey]?: StyleOverride };
    /** The player's changes to the look of one spell in one kind, by the kind and the spell's name ("rank:Smite"). */
    spellStyles: { [kindAndName: string]: StyleOverride | undefined };
    /** The action bars (1 to 8) whose buttons do not glow; only set where the player switched one off. */
    barOff: { [bar: string]: boolean | undefined };
    /** Per-spell switches of the cooldown and proc glows (by spell ID); only set where the player switched one off. */
    glowOn: { [spellId: string]: boolean | undefined };
    /** Per-reagent switches (by item ID); only set where the player switched one off. */
    reagentOn: { [itemId: string]: boolean | undefined };
    /** Per-buff switches; only set where the player changed the default. */
    buffOn: { [buffKey: string]: boolean | undefined };
    /** Weapon buff picks (WeaponBuff.key); undefined = automatic. */
    weaponBuff?: string;
    weaponBuffOff?: string;
}
