// Per-character settings, saved as ForeverRemindersCharDB (## SavedVariablesPerCharacter).
//
// Player choices are changed through changeSetting(), which announces the change, so the options
// page never has to know who reacts to it. Diagnostic data (debug, blockedAction) is written
// directly: nobody reacts to it.
import { createSignal } from "./util/signal";

export type SoundKey = "none" | "ping" | "ready" | "raidwarning" | "alarm" | "whisper" | "quest" | "toast" | "click";
export type ColorKey = "buff" | "weapon";
export type Rgb = [r: number, g: number, b: number];

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

export interface Settings {
    muted: boolean;
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
    debugMode: boolean;
    debug?: DebugStore;
    /** The last action of this addon the client blocked. */
    blockedAction?: string;
}

declare global {
    // Filled in by the client before ADDON_LOADED
    var ForeverRemindersCharDB: Partial<Settings> | undefined;
}

/** The live settings. Its identity never changes: loadSettings() makes it the saved table. */
export const settings: Settings = {
    muted: false,
    hideResting: true,
    showBuff: true,
    showWeapon: true,
    showBarNotice: true,
    showRankNotice: true,
    showPartyBuffs: true,
    showReagentNotice: true,
    soundBuff: "none",
    soundWeapon: "alarm",
    colors: {},
    buffOn: {},
    debugMode: false,
};

/** A player choice changed (the key of the setting). */
export const settingChanged = createSignal<[key: keyof Settings]>();

/**
 * Changes a player choice and announces it. Nested tables (colors, buffOn) are replaced as a
 * whole: pass a new table.
 */
export function changeSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
    settings[key] = value;
    settingChanged.emit(key);
}

/** Call once on ADDON_LOADED: the saved values replace the defaults. */
export function loadSettings(): void {
    const saved = ForeverRemindersCharDB;
    if (saved !== undefined) {
        for (const [key, value] of pairs(saved)) {
            (settings as unknown as Record<string, unknown>)[key as string] = value;
        }
    }
    ForeverRemindersCharDB = settings;
}
