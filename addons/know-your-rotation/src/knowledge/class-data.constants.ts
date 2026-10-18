// What each class has: its roles, its interrupt, purge and cures, the racials, and the shaman's totems.
import { Cure, Mage as M, Priest as Pr, Racial, Rogue as R, Shaman as Sh, Warrior as W } from "@wowkit/wow-data";
import type { StepOptions } from "./step.interface";

/** The roles (play styles) of each class; the first is the default. */
export const CLASS_ROLES: { [classToken: string]: string[] | undefined } = {
    WARRIOR: ["damage", "tank"],
    PALADIN: ["damage", "tank", "heal"],
    HUNTER: ["range", "melee"],
    ROGUE: ["damage"],
    PRIEST: ["damage", "heal"],
    SHAMAN: ["caster", "melee", "heal"],
    MAGE: ["damage"],
    WARLOCK: ["damage"],
    DRUID: ["hybrid", "heal", "tank"],
};

export const INTERRUPTS: { [classToken: string]: number | undefined } = {
    WARRIOR: W.Pummel,
    ROGUE: R.Kick,
    // Earth Shock interrupts in Classic
    SHAMAN: Sh.EarthShock,
    MAGE: M.Counterspell,
    PRIEST: Pr.Silence,
};

export const PURGES: { [classToken: string]: number | undefined } = {
    SHAMAN: Sh.Purge,
    PRIEST: Cure.DispelMagic,
};

/** A cure and the debuff types it removes. */
export interface CureEntry {
    id: number;
    types: string[];
}

/** The cures of each class, the best first. */
export const CURES: { [classToken: string]: CureEntry[] | undefined } = {
    PALADIN: [
        { id: Cure.Cleanse, types: ["Magic", "Disease", "Poison"] },
        { id: Cure.Purify, types: ["Disease", "Poison"] },
    ],
    PRIEST: [
        { id: Cure.AbolishDisease, types: ["Disease"] },
        { id: Cure.PriestCureDisease, types: ["Disease"] },
        { id: Cure.DispelMagic, types: ["Magic"] },
    ],
    SHAMAN: [
        { id: Sh.CureDisease, types: ["Disease"] },
        { id: Sh.CurePoison, types: ["Poison"] },
    ],
    DRUID: [
        { id: Cure.AbolishPoison, types: ["Poison"] },
        { id: Cure.DruidCurePoison, types: ["Poison"] },
        { id: Cure.RemoveCurse, types: ["Curse"] },
    ],
    MAGE: [{ id: M.RemoveLesserCurse, types: ["Curse"] }],
};

/** A racial: who has it (race IDs, factions), when it is offered, and whether it is on by default. */
export interface RacialEntry {
    key: string;
    id: number;
    races: number[];
    factions?: string[];
    opt?: StepOptions;
    isOn?: boolean;
    /** Offensive: first in the list, once the target is near (a racial has no range of its own). */
    isFront?: boolean;
    isDefensive?: boolean;
}

const OPENER: StepOptions = { isAttack: true, isFightOnly: true, reach: 28 };

/** The racials; 95 is the Alliance Aeolid (High Order), 96 the Horde one (Windshaper). Passives are not listed. */
export const RACIALS: RacialEntry[] = [
    { key: "Perception", id: Racial.Perception, races: [1], opt: { isCombatOnly: true } },
    { key: "BloodFury", id: Racial.BloodFury, races: [2], opt: OPENER, isOn: true, isFront: true },
    { key: "Stoneform", id: Racial.Stoneform, races: [3], opt: { isCombatOnly: true, hp: 70 }, isDefensive: true },
    { key: "Shadowmeld", id: Racial.Shadowmeld, races: [4], opt: { isKeptUp: true }, isDefensive: true },
    { key: "WillOfTheForsaken", id: Racial.WillOfTheForsaken, races: [5], isDefensive: true },
    { key: "WarStomp", id: Racial.WarStomp, races: [6], opt: { isAttack: true, isCombatOnly: true } },
    { key: "EscapeArtist", id: Racial.EscapeArtist, races: [7], isDefensive: true },
    { key: "Berserking", id: Racial.Berserking, races: [8], opt: OPENER, isOn: true, isFront: true },
    {
        key: "LeyLine",
        id: Racial.LeyLine,
        races: [95],
        factions: ["Alliance"],
        opt: { isAttack: true, isCombatOnly: true },
        isDefensive: true,
    },
    { key: "SkyView", id: Racial.SkyView, races: [96], factions: ["Horde"] },
    { key: "WillToSurvive", id: Racial.WillToSurvive, races: [1], isDefensive: true },
    { key: "ElunesLight", id: Racial.ElunesLight, races: [4], opt: OPENER, isOn: true, isFront: true },
    { key: "Eureka", id: Racial.Eureka, races: [7], opt: OPENER, isOn: true, isFront: true },
    { key: "ShatterCurse", id: Racial.ShatterCurse, races: [2], isDefensive: true },
    { key: "Cannibalize", id: Racial.Cannibalize, races: [5], opt: { isOutOfCombatOnly: true } },
    { key: "RapidRegeneration", id: Racial.RapidRegeneration, races: [8], opt: { isCombatOnly: true, hp: 50 }, isDefensive: true },
];

/**
 * When a totem is worth dropping: "pull" (a buff, at the start of the fight), "hostile" (an attack totem, with an
 * enemy targeted), "melee" (it only helps with enemies at your feet: a slow, a taunt, area damage).
 */
export type TotemWhen = "pull" | "hostile" | "melee";

/** A totem's slot (fire 1, earth 2, water 3, air 4), its rank-1 duration, and when it is worth dropping. */
export interface TotemEntry {
    slot: number;
    seconds: number;
    when?: TotemWhen;
}

/** Used while the totem slots are hidden (combat); a readable read replaces the duration with the real one. */
export const TOTEMS: { [spellId: number]: TotemEntry | undefined } = {
    [Sh.SearingTotem]: { slot: 1, seconds: 30, when: "hostile" },
    [Sh.MagmaTotem]: { slot: 1, seconds: 20, when: "melee" },
    [Sh.StrengthOfEarthTotem]: { slot: 2, seconds: 120, when: "pull" },
    [Sh.StoneskinTotem]: { slot: 2, seconds: 300, when: "pull" },
    [Sh.StoneclawTotem]: { slot: 2, seconds: 15, when: "melee" },
    [Sh.EarthbindTotem]: { slot: 2, seconds: 45, when: "melee" },
    [Sh.TremorTotem]: { slot: 2, seconds: 120 },
    [Sh.HealingStreamTotem]: { slot: 3, seconds: 60, when: "pull" },
    [Sh.ManaSpringTotem]: { slot: 3, seconds: 60, when: "pull" },
    [Sh.WindfuryTotem]: { slot: 4, seconds: 120, when: "pull" },
    [Sh.GraceOfAirTotem]: { slot: 4, seconds: 120, when: "pull" },
    [Sh.GroundingTotem]: { slot: 4, seconds: 45 },
};
