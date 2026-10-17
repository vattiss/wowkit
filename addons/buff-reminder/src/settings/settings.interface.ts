import type { SettingsService, SoundKey } from "@wowkit/ui";
import type { Rgb } from "@wowkit/wow";

export type ColorKey = "buff" | "weapon";

/** The settings service of this addon: a SettingsService that knows the shape of its settings. */
export type AddonSettingsService = SettingsService<AddonSettings>;

export interface AddonSettings {
    isMuted: boolean;
    hideResting: boolean;
    showBuff: boolean;
    showWeapon: boolean;
    showBarNotice: boolean;
    /** Party members missing the player's buffs. */
    showPartyBuffs: boolean;
    soundBuff: SoundKey;
    soundWeapon: SoundKey;
    colors: { [key in ColorKey]?: Rgb };
    /** Per-buff switches; only set where the player changed the default. */
    buffOn: { [buffKey: string]: boolean | undefined };
    /** Weapon buff picks (WeaponBuff.key); undefined = automatic. */
    weaponBuff?: string;
    weaponBuffOff?: string;
}
