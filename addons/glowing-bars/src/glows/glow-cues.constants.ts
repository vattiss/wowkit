// The spells that glow by themselves, per class (UnitClass token): the cooldowns worth pressing the moment they are ready,
// and the spells that become usable only after something happened (a dodge, a parry, a kill, a low target).
import { Druid, Hunter, Mage, Paladin, Priest, Racial, Rogue, Shaman, Travel, Warlock, Warrior } from "@wowkit/wow-data";

/** Important cooldowns: they glow when ready, in combat. The player can switch each off. */
export const COOLDOWN_CUES: { [classToken: string]: number[] | undefined } = {
    DRUID: [Druid.Innervate, Druid.NaturesSwiftness, Druid.Barkskin, Druid.TigersFury, Druid.Berserk, Druid.FrenziedRegeneration],
    HUNTER: [Hunter.RapidFire, Hunter.BestialWrath, Hunter.Deterrence],
    MAGE: [Mage.PresenceOfMind, Mage.ArcanePower, Mage.Combustion, Mage.Evocation, Mage.IceBlock, Mage.IceBarrier],
    PALADIN: [Paladin.DivineShield, Paladin.DivineProtection, Paladin.LayOnHands, Paladin.SwiftJudgement],
    PRIEST: [Priest.InnerFocus, Priest.PowerInfusion, Priest.Fade],
    ROGUE: [Rogue.AdrenalineRush, Rogue.BladeFlurry, Rogue.ColdBlood, Rogue.Preparation, Rogue.Evasion, Rogue.Vanish],
    SHAMAN: [Shaman.ElementalMastery, Shaman.NaturesSwiftness],
    WARLOCK: [Warlock.DeathCoil],
    WARRIOR: [
        Warrior.Recklessness,
        Warrior.DeathWish,
        Warrior.Bloodrage,
        Warrior.SweepingStrikes,
        Warrior.BerserkerRage,
        Warrior.Retaliation,
        Warrior.ShieldWall,
        Warrior.LastStand,
    ],
};

/**
 * The racials worth a glow in a fight, of every race: only the ones the player has learned count. Offensive (Blood Fury,
 * Berserking, Elune's Light, Eureka), defensive (Stoneform, Will to Survive), and the ones that break
 * out of a hold (Will of the Forsaken, Escape Artist, Shatter Curse), War Stomp and Perception. And the priest's spells
 * of each race that have a cooldown (Desperate Prayer, Elune's Grace, Feedback, Divine Grace...); the ones without one
 * (Touch of Weakness, Shadowguard, Hex of Weakness) are buffs and debuffs, not cooldowns. The racials of between fights are
 * the utility cooldowns.
 */
export const RACIAL_COOLDOWNS: number[] = [
    Racial.BloodFury,
    Racial.Berserking,
    Racial.ElunesLight,
    Racial.Eureka,
    Racial.Stoneform,
    Racial.WillToSurvive,
    Racial.WillOfTheForsaken,
    Racial.EscapeArtist,
    Racial.ShatterCurse,
    Racial.WarStomp,
    Racial.Perception,
    Priest.DesperatePrayer,
    Priest.DivineGrace,
    Priest.Feedback,
    Priest.Chastise,
    Priest.ElunesGrace,
    Priest.Starshards,
    Priest.DarkSacrifice,
    Priest.ConfoundingFlash,
    Priest.ContingencyPlan,
];

/**
 * The cooldowns of between fights, a type of their own (Utility cooldown) that glows anywhere, once as each is ready. The
 * racials: Cultivation, the tauren's second herb; Cannibalize, the undead's regeneration on a corpse; Rapid Regeneration,
 * the troll's heal that any move or hit breaks; the Skyborne's Read Leyline, Skysight and Walk on Air (Wind Blessed is
 * passive). And the shaman's Astral Recall, and the Hearthstone. Only the ones the player has learned count, and the
 * Hearthstone, an item, on a bar. A profession's cooldown (a transmute) cannot go on a bar: it has nothing to glow on.
 */
export const UTILITY_COOLDOWNS: number[] = [
    Racial.Cultivation,
    Racial.Cannibalize,
    Racial.RapidRegeneration,
    Racial.ReadLeyline,
    Racial.Skysight,
    Racial.WalkOnAir,
    Shaman.AstralRecall,
    Travel.Hearthstone,
];

/** Procs: the spell glows while the game says it is usable (and not on cooldown). The player can switch each off. */
export const PROC_CUES: { [classToken: string]: number[] | undefined } = {
    HUNTER: [Hunter.Counterattack, Hunter.MongooseBite],
    PALADIN: [Paladin.HammerOfWrath, Paladin.Exorcism],
    ROGUE: [Rogue.Riposte],
    WARRIOR: [Warrior.Overpower, Warrior.Revenge, Warrior.Execute, Warrior.VictoryRush],
};

/**
 * Last-resort defensives that glow at low health (LowHealthDefenseService): lit all the while they are ready, shown only at
 * 10% health or below, by the health the game hides. (An idea of sorrow8's fork.)
 */
export const LOW_HEALTH_CUES: { [classToken: string]: number[] | undefined } = {
    PALADIN: [Paladin.TemplarsBulwark],
};

/** The creature types of the game, by their IDs (UnitCreatureType's second answer): the same in every client language. */
export const CREATURE_TYPE = { Demon: 3, Undead: 6 };

/**
 * Procs that also need a target of a kind: the creature types they hit. Where the game hides the target's type, the spell's
 * range check stands in: it says no for a target the spell cannot hit. (An idea of sorrow8's fork.)
 */
export const TARGET_TYPE_CUES: [spellId: number, creatureTypes: number[]][] = [
    [Paladin.Exorcism, [CREATURE_TYPE.Demon, CREATURE_TYPE.Undead]],
];

/** A proc told by its buffs, and by its spell where no other buff makes it so. */
export interface SpellProcCue {
    id: number;
    /** The spell turns free or instant with the proc; none where something else does it too (Clearcasting: any spell free). */
    sign?: "free" | "instant";
    /** The proc's buffs: by their aura, or in a fight by their icons in the Cooldown Manager. */
    auras: number[];
}

/**
 * Procs told by their buffs (`auras`: the aura, or in a fight, when the game hides it, the icon in the Cooldown Manager), or
 * by their spell turning free or instant. Without the talent the spell never does, so no other check is needed.
 */
export const SPELL_PROC_CUES: { [classToken: string]: SpellProcCue[] | undefined } = {
    // Missile Barrage's proc, by its buff only: Clearcasting makes Arcane Missiles free too, as every other spell, which is not
    // its proc, and in a fight the game may hide which of them did
    MAGE: [{ id: Mage.ArcaneMissiles, auras: [Mage.MissileBarrage] }],
    WARLOCK: [{ id: Warlock.ShadowBolt, sign: "instant", auras: [Warlock.ShadowTrance] }],
    // Instant with 5 stacks of Maelstrom Weapon only. No buff to ask: its icon shows at any number of stacks
    SHAMAN: [{ id: Shaman.LightningBolt, sign: "instant", auras: [] }],
};

/**
 * Cooldowns that start when another spell is cast, not when they are: Swift Judgement makes the next Judgement cheap, and
 * its cooldown starts as that Judgement uses it up, however long that takes. Until then the spell is not ready.
 */
/**
 * Spells with a cooldown only in a form, which the game's data and the tooltip of the other forms do not show: Faerie Fire
 * in Bear Form on Forever. They can be added as a cooldown in any form; they glow only in the one with the cooldown.
 */
export const FORM_COOLDOWNS: number[] = [...Druid.FaerieFireRanks];

export const COOLDOWN_STARTED_BY: [spellId: number, startedBy: number[]][] = [[Paladin.SwiftJudgement, [Paladin.Judgement]]];
