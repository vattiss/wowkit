// The addon's own proc rules, one class at a time: what the built-in procs did, as rules (see proc-rules.interface.ts). The
// player can switch each off, and add rules of their own beside them.
import { Hunter, Mage, Paladin, Rogue, Shaman, Warlock, Warrior } from "@wowkit/wow-data";
import type { BuiltInProcRule, ProcConditionKind } from "./proc-rules.interface";

/** The creature types of the game, by their IDs (UnitCreatureType's second answer): the same in every client language. */
export const CREATURE_TYPES = {
    Beast: 1,
    Dragonkin: 2,
    Demon: 3,
    Elemental: 4,
    Giant: 5,
    Undead: 6,
    Humanoid: 7,
    Mechanical: 9,
};

/**
 * The groups of the rules of a spell told two ways (Shadow Bolt): by its buff's icon in the Cooldown Manager, or, where it
 * has no say, by a backup check. Each has its own row and look on the Procs tab, so the player sees which way lit it. A rule with no CDM way
 * at all (Revenge after a dodge, Maelstrom Weapon) needs no group.
 */
const CDM = "CDM";
const BACKUP = "backup";

/** A rule that lights its spell, asked first, with no group. */
function describeGlow(spellId: number, kind: ProcConditionKind, value?: number): BuiltInProcRule {
    return { spellId, kind, value, result: "glow", priority: 1 };
}

/** Usable by the game's word, in its own stance, and after a block, a dodge or a parry in any (Forever hides the log). */
const REVENGE: BuiltInProcRule[] = [
    describeGlow(Warrior.Revenge, "usable"),
    describeGlow(Warrior.Revenge, "afterBlock"),
    describeGlow(Warrior.Revenge, "afterDodge"),
    describeGlow(Warrior.Revenge, "afterParry"),
];

/** Exorcism hits only undead and demons: where the game hides the target's type, its range check tells. */
const EXORCISM: BuiltInProcRule[] = [CREATURE_TYPES.Undead, CREATURE_TYPES.Demon].map((creatureType) => ({
    ...describeGlow(Paladin.Exorcism, "targetType", creatureType),
    isRangeFallback: true,
}));

/**
 * Missile Barrage's proc, by its buff only (its aura, or in a fight its icon in the Cooldown Manager): Clearcasting makes
 * Arcane Missiles free too, as every other spell, and in a fight the game may hide which of them did. A rule on Clearcasting
 * is the player's to add.
 */
const ARCANE_MISSILES: BuiltInProcRule[] = [describeGlow(Mage.ArcaneMissiles, "buff", Mage.MissileBarrage)];

/** The two rules on the health the addon lights by services of their own (and rows of their own on the Procs tab). */
export const EXECUTE_HEALTH_RULE: BuiltInProcRule = { ...describeGlow(Warrior.Execute, "targetHealth", 20), group: "Defensive Stance" };
export const BULWARK_HEALTH_RULE: BuiltInProcRule = describeGlow(Paladin.TemplarsBulwark, "myHealth", 10);

export const BUILT_IN_PROC_RULES: { [classToken: string]: BuiltInProcRule[] | undefined } = {
    HUNTER: [describeGlow(Hunter.Counterattack, "usable"), describeGlow(Hunter.MongooseBite, "usable")],
    MAGE: ARCANE_MISSILES,
    PALADIN: [describeGlow(Paladin.HammerOfWrath, "usable"), ...EXORCISM, BULWARK_HEALTH_RULE],
    ROGUE: [describeGlow(Rogue.Riposte, "usable")],
    // Instant with 5 stacks of Maelstrom Weapon only; its icon shows at any number, so no buff tells
    SHAMAN: [describeGlow(Shaman.LightningBolt, "instant")],
    WARLOCK: [
        { ...describeGlow(Warlock.ShadowBolt, "buff", Warlock.ShadowTrance), group: CDM },
        { spellId: Warlock.ShadowBolt, kind: "instant", result: "glow", priority: 2, group: BACKUP },
    ],
    WARRIOR: [
        describeGlow(Warrior.Overpower, "usable"),
        describeGlow(Warrior.Overpower, "targetDodged"),
        ...REVENGE,
        describeGlow(Warrior.Execute, "usable"),
        EXECUTE_HEALTH_RULE,
        describeGlow(Warrior.VictoryRush, "usable"),
    ],
};
