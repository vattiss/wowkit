// The spells that glow by themselves, per class (UnitClass token): the cooldowns worth pressing the moment they are ready,
// and the spells that become usable only after something happened (a dodge, a parry, a kill, a low target).
import { Druid, Hunter, Mage, Paladin, Priest, Racial, Rogue, Shaman, Warrior } from "@wowkit/wow-data";

/** Important cooldowns: they glow when ready, in combat. The player can switch each off. */
export const COOLDOWN_CUES: { [classToken: string]: number[] | undefined } = {
    DRUID: [Druid.Innervate, Druid.Barkskin, Druid.TigersFury, Druid.Berserk, Druid.FrenziedRegeneration],
    HUNTER: [Hunter.RapidFire, Hunter.BestialWrath, Hunter.Deterrence],
    MAGE: [Mage.PresenceOfMind, Mage.ArcanePower, Mage.Combustion, Mage.IceBlock],
    PALADIN: [Paladin.DivineShield, Paladin.DivineProtection, Paladin.LayOnHands, Paladin.SwiftJudgement],
    PRIEST: [Priest.InnerFocus, Priest.PowerInfusion, Priest.Fade],
    ROGUE: [Rogue.AdrenalineRush, Rogue.BladeFlurry, Rogue.ColdBlood, Rogue.Evasion, Rogue.Vanish],
    SHAMAN: [Shaman.ElementalMastery],
    WARRIOR: [Warrior.Recklessness, Warrior.DeathWish, Warrior.ShieldWall, Warrior.LastStand],
};

/**
 * The racials worth a glow in a fight, of every race: only the ones the player has learned count. Offensive (Blood Fury,
 * Berserking, Elune's Light, Eureka), defensive (Stoneform, Will to Survive, Rapid Regeneration), and the ones that break
 * out of a hold (Will of the Forsaken, Escape Artist, Shatter Curse), War Stomp and Perception. And the priest's spells
 * of each race that have a cooldown (Desperate Prayer, Elune's Grace, Feedback, Divine Grace...); the ones without one
 * (Touch of Weakness, Shadowguard, Hex of Weakness) are buffs and debuffs, not cooldowns.
 */
export const RACIAL_COOLDOWNS: number[] = [
    Racial.BloodFury,
    Racial.Berserking,
    Racial.ElunesLight,
    Racial.Eureka,
    Racial.Stoneform,
    Racial.WillToSurvive,
    Racial.RapidRegeneration,
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

/** Procs: the spell glows while the game says it is usable (and not on cooldown). The player can switch each off. */
export const PROC_CUES: { [classToken: string]: number[] | undefined } = {
    HUNTER: [Hunter.Counterattack, Hunter.MongooseBite],
    PALADIN: [Paladin.HammerOfWrath],
    ROGUE: [Rogue.Riposte],
    WARRIOR: [Warrior.Overpower, Warrior.Revenge, Warrior.Execute, Warrior.VictoryRush],
};
