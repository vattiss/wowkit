import type { Rgb } from "@forever/wow";

export type SoundKey = "none" | "ping" | "ready" | "raidwarning" | "alarm" | "whisper" | "quest" | "toast" | "click";
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

export interface AddonSettings {
    isMuted: boolean;
    hideResting: boolean;
    showBuff: boolean;
    showWeapon: boolean;
    showBarNotice: boolean;
    showRankNotice: boolean;
    /** Party members missing the player's buffs. */
    showPartyBuffs: boolean;
    /** Reagents running low, on arriving in a town or an inn. */
    showReagentNotice: boolean;
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
