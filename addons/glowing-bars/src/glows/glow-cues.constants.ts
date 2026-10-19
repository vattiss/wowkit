// The spells that glow by themselves, per class (UnitClass token): the cooldowns worth pressing the moment they are ready,
// and the spells that become usable only after something happened (a dodge, a parry, a kill, a low target).
import { Druid, Hunter, Mage, Paladin, Priest, Rogue, Shaman, Warrior } from "@wowkit/wow-data";

/** Important cooldowns: they glow when ready, in combat. The player can switch each off. */
export const COOLDOWN_CUES: { [classToken: string]: number[] | undefined } = {
    DRUID: [Druid.Innervate, Druid.Barkskin, Druid.TigersFury, Druid.Berserk, Druid.FrenziedRegeneration],
    HUNTER: [Hunter.RapidFire, Hunter.BestialWrath, Hunter.Deterrence],
    MAGE: [Mage.PresenceOfMind, Mage.ArcanePower, Mage.Combustion, Mage.IceBlock],
    PALADIN: [Paladin.DivineShield, Paladin.DivineProtection, Paladin.LayOnHands],
    PRIEST: [Priest.InnerFocus, Priest.PowerInfusion, Priest.Fade],
    ROGUE: [Rogue.AdrenalineRush, Rogue.BladeFlurry, Rogue.ColdBlood, Rogue.Evasion, Rogue.Vanish],
    SHAMAN: [Shaman.ElementalMastery],
    WARRIOR: [Warrior.Recklessness, Warrior.DeathWish, Warrior.ShieldWall, Warrior.LastStand],
};

/** Procs: the spell glows while the game says it is usable (and not on cooldown). The player can switch each off. */
export const PROC_CUES: { [classToken: string]: number[] | undefined } = {
    HUNTER: [Hunter.Counterattack, Hunter.MongooseBite],
    PALADIN: [Paladin.HammerOfWrath],
    ROGUE: [Rogue.Riposte],
    WARRIOR: [Warrior.Overpower, Warrior.Revenge, Warrior.Execute, Warrior.VictoryRush],
};
