import type { SettingsService, SoundKey } from "@wowkit/ui";
import type { Rgb } from "@wowkit/wow";

export type ColorKey = "buff" | "weapon";

export interface DebugStore {
    /** "probe\tcontext\tresult" -> times seen */
    counts: { [key: string]: number };
    /** "label: text" -> times seen */
    texts: { [key: string]: number };
    keys: number;
    textKeys: number;
    dropped: number;
    samples: number;
    info?: { client: string; addon: string; className: string; level: string };
}

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
    isDebugMode: boolean;
    debug?: DebugStore;
    /** The last action of this addon the client blocked. */
    blockedAction?: string;
}
