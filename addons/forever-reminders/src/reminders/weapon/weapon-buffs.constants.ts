// Weapon buffs per class (lab client 1.60.1). `enchants` are the enchantIDs the client reports
// for the weapon while the buff is on it.

import type { WeaponBuff } from "./weapon-buff.interface";

export const WEAPON_BUFFS: { [classToken: string]: WeaponBuff[] | undefined } = {
    SHAMAN: [
        {
            key: "Windfury",
            id: 8232,
            duration: 3600,
            ranks: [8232, 8235, 10486, 16362, 439431, 461636],
            enchants: [283, 284, 525, 1669, 7569],
            match: ["windfury"],
        },
        {
            key: "Flametongue",
            id: 8024,
            duration: 3600,
            ranks: [8024, 8027, 8030, 16339, 16341, 16342, 461634],
            enchants: [3, 4, 5, 523, 1665, 1666, 7567],
            match: ["flametongue"],
        },
        {
            key: "Rockbiter",
            id: 8017,
            duration: 3600,
            ranks: [8017, 8018, 8019, 10399, 16314, 16315, 16316, 461635],
            enchants: [1, 6, 29, 503, 504, 683, 1663, 1664, 7568],
            match: ["rockbiter"],
        },
        {
            key: "Frostbrand",
            id: 8033,
            duration: 3600,
            ranks: [8033, 8038, 10456, 16355, 16356, 461633],
            enchants: [2, 12, 524, 1667, 1668, 7566],
            match: ["frostbrand"],
        },
    ],
    ROGUE: [
        {
            key: "InstantPoison",
            name: "Instant Poison",
            id: 8679,
            duration: 1800,
            enchants: [323, 324, 325, 623, 624, 625],
            match: ["instant poison"],
        },
        {
            key: "DeadlyPoison",
            name: "Deadly Poison",
            id: 2823,
            duration: 1800,
            enchants: [7, 8, 626, 627, 2630],
            match: ["deadly poison"],
        },
        { key: "CripplingPoison", name: "Crippling Poison", id: 3408, duration: 1800, enchants: [22, 603], match: ["crippling"] },
        { key: "WoundPoison", name: "Wound Poison", id: 13219, duration: 1800, enchants: [703, 704, 705, 706], match: ["wound poison"] },
        {
            key: "MindNumbingPoison",
            name: "Mind-numbing Poison",
            id: 5761,
            duration: 1800,
            enchants: [23, 35, 643],
            match: ["mind-numbing", "mind numbing"],
        },
    ],
    WARLOCK: [
        { key: "Firestone", id: 6366, duration: 7200, enchants: [1803, 1823, 1824, 1825], match: ["firestone"] },
        { key: "Spellstone", id: 2362, duration: 7200, enchants: [8059, 8060, 8061], match: ["spellstone"] },
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
