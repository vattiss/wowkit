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
            items: [
                { item: 6947, spell: 8679 },
                { item: 6949, spell: 8686 },
                { item: 6950, spell: 8688 },
                { item: 8926, spell: 11338 },
                { item: 8927, spell: 11339 },
                { item: 8928, spell: 11340 },
            ],
            duration: 1800,
            enchants: [323, 324, 325, 623, 624, 625],
            match: ["instant poison"],
        },
        {
            key: "DeadlyPoison",
            name: "Deadly Poison",
            id: Rogue.DeadlyPoison,
            items: [
                { item: 2892, spell: 2823 },
                { item: 2893, spell: 2824 },
                { item: 8984, spell: 11355 },
                { item: 8985, spell: 11356 },
                { item: 20844, spell: 25351 },
            ],
            duration: 1800,
            enchants: [7, 8, 626, 627, 2630],
            match: ["deadly poison"],
        },
        {
            key: "CripplingPoison",
            name: "Crippling Poison",
            id: Rogue.CripplingPoison,
            items: [
                { item: 3775, spell: 3408 },
                { item: 3776, spell: 11202 },
            ],
            duration: 1800,
            enchants: [22, 603],
            match: ["crippling"],
        },
        {
            key: "WoundPoison",
            name: "Wound Poison",
            id: Rogue.WoundPoison,
            items: [
                { item: 10918, spell: 13219 },
                { item: 10920, spell: 13225 },
                { item: 10921, spell: 13226 },
                { item: 10922, spell: 13227 },
            ],
            duration: 1800,
            enchants: [703, 704, 705, 706],
            match: ["wound poison"],
        },
        {
            key: "MindNumbingPoison",
            name: "Mind-numbing Poison",
            id: Rogue.MindNumbingPoison,
            items: [
                { item: 5237, spell: 5761 },
                { item: 6951, spell: 8693 },
                { item: 9186, spell: 11399 },
            ],
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
        for (const { spell } of entry.items ?? []) WEAPON_BUFF_BY_SPELL.set(spell, entry);
        for (const enchantId of entry.enchants) WEAPON_BUFF_BY_ENCHANT.set(enchantId, entry);
    }
}
