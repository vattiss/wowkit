// Weapon buffs per class (lab client 1.60.1). `enchants` are the enchantIDs the client reports
// for the weapon while the buff is on it.

import { Rogue, Shaman, Warlock } from "@wowkit/wow-data";
import type { WeaponBuff } from "./weapon-buff.interface";

export const WEAPON_BUFFS: { [classToken: string]: WeaponBuff[] | undefined } = {
    SHAMAN: [
        {
            key: "Windfury",
            id: Shaman.Windfury[0]!,
            duration: 3600,
            ranks: Shaman.Windfury,
            enchants: [283, 284, 525, 1669, 7569],
            match: ["windfury"],
        },
        {
            key: "Flametongue",
            id: Shaman.Flametongue[0]!,
            duration: 3600,
            ranks: Shaman.Flametongue,
            enchants: [3, 4, 5, 523, 1665, 1666, 7567],
            match: ["flametongue"],
        },
        {
            key: "Rockbiter",
            id: Shaman.Rockbiter[0]!,
            duration: 3600,
            ranks: Shaman.Rockbiter,
            enchants: [1, 6, 29, 503, 504, 683, 1663, 1664, 7568],
            match: ["rockbiter"],
        },
        {
            key: "Frostbrand",
            id: Shaman.Frostbrand[0]!,
            duration: 3600,
            ranks: Shaman.Frostbrand,
            enchants: [2, 12, 524, 1667, 1668, 7566],
            match: ["frostbrand"],
        },
    ],
    ROGUE: [
        {
            key: "InstantPoison",
            name: "Instant Poison",
            id: Rogue.InstantPoison,
            duration: 1800,
            enchants: [323, 324, 325, 623, 624, 625],
            match: ["instant poison"],
        },
        {
            key: "DeadlyPoison",
            name: "Deadly Poison",
            id: Rogue.DeadlyPoison,
            duration: 1800,
            enchants: [7, 8, 626, 627, 2630],
            match: ["deadly poison"],
        },
        {
            key: "CripplingPoison",
            name: "Crippling Poison",
            id: Rogue.CripplingPoison,
            duration: 1800,
            enchants: [22, 603],
            match: ["crippling"],
        },
        {
            key: "WoundPoison",
            name: "Wound Poison",
            id: Rogue.WoundPoison,
            duration: 1800,
            enchants: [703, 704, 705, 706],
            match: ["wound poison"],
        },
        {
            key: "MindNumbingPoison",
            name: "Mind-numbing Poison",
            id: Rogue.MindNumbingPoison,
            duration: 1800,
            enchants: [23, 35, 643],
            match: ["mind-numbing", "mind numbing"],
        },
    ],
    WARLOCK: [
        { key: "Firestone", id: Warlock.Firestone, duration: 7200, enchants: [1803, 1823, 1824, 1825], match: ["firestone"] },
        { key: "Spellstone", id: Warlock.Spellstone, duration: 7200, enchants: [8059, 8060, 8061], match: ["spellstone"] },
    ],
};

/** The automatic pick, best first (melee shamans pick Windfury on the options page). */
export const WEAPON_PRIORITY: { [classToken: string]: string[] | undefined } = {
    SHAMAN: ["Flametongue", "Rockbiter", "Frostbrand", "Windfury"],
    ROGUE: ["InstantPoison", "DeadlyPoison", "WoundPoison", "CripplingPoison", "MindNumbingPoison"],
};

/** Classes that coat both weapons, and what goes on the off-hand by default. */
export const OFFHAND_PRIORITY: { [classToken: string]: string[] | undefined } = {
    ROGUE: ["DeadlyPoison", "InstantPoison", "CripplingPoison", "WoundPoison", "MindNumbingPoison"],
};

export const WEAPON_BUFF_BY_SPELL = new LuaMap<number, WeaponBuff>();
export const WEAPON_BUFF_BY_ENCHANT = new LuaMap<number, WeaponBuff>();
for (const [, list] of pairs(WEAPON_BUFFS)) {
    for (const entry of list ?? []) {
        WEAPON_BUFF_BY_SPELL.set(entry.id, entry);
        for (const rankId of entry.ranks ?? []) WEAPON_BUFF_BY_SPELL.set(rankId, entry);
        for (const enchantId of entry.enchants) WEAPON_BUFF_BY_ENCHANT.set(enchantId, entry);
    }
}
