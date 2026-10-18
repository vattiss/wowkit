// The mage and the warlock: one role each.
import { Mage as M, Warlock as L } from "@wowkit/wow-data";
import { createStep as step } from "../step.interface";
import { WARLOCK_CURSES } from "./list-groups.constants";
import type { ClassLists } from "./list.interface";

export const MAGE_LISTS: ClassLists = {
    rotation: {
        damage: [
            step("FrostNova", M.FrostNova, {
                isInMeleeOnly: true,
                isWithEnemyTarget: true,
                keepsDebuff: true,
                refresh: 0,
                shouldSkipDying: true,
            }),
            step("Pyroblast", M.Pyroblast, { isOutOfCombatOnly: true, isAttack: true }),
            step("FireBlast", M.FireBlast, { isAttack: true }),
            step("IceLance", M.IceLance, { isAttack: true }),
            step("Scorch", M.Scorch, { keepsDebuff: M.FireVulnerability, stacks: 5, refresh: 4, isAttack: true }, false),
            step("Frostbolt", M.Frostbolt, { isFiller: true, notTree: "fire", isAttack: true }),
            step("ArcaneMissiles", M.ArcaneMissiles, { isFiller: true, notTree: "fire", isAttack: true }),
            step("ArcaneBlast", M.ArcaneBlast, { isFiller: true, isAttack: true }),
            step("FrostfireBolt", M.FrostfireBolt, { isFiller: true, isAttack: true }),
            step("Fireball", M.Fireball, { isFiller: true, isAttack: true }),
            step("Shoot", M.Shoot, { isAutoRepeat: true, isAttack: true }),
        ],
    },
    aoe: {
        damage: [
            step("ArcaneExplosion", M.ArcaneExplosion, { isAttack: true }),
            step("BlastWave", M.BlastWave, { isAttack: true }),
            step("Flamestrike", M.Flamestrike, { isAttack: true }),
            step("Blizzard", M.Blizzard, { isAttack: true }),
            step("ConeOfCold", M.ConeOfCold, { isAttack: true }),
            step("FrostNova", M.FrostNova, { isAttack: true }),
        ],
    },
    defense: {
        damage: [
            step("ManaShield", M.ManaShield, { isCombatOnly: true, hp: 55 }),
            step("IceBarrier", M.IceBarrier, { isCombatOnly: true, hp: 80 }),
            step("FireWard", M.FireWard, { isCombatOnly: true, hp: 70 }, false),
            step("FrostWard", M.FrostWard, { isCombatOnly: true, hp: 70 }, false),
            step("IceBlock", M.IceBlock, { isCombatOnly: true, hp: 30 }),
            step("Blink", M.Blink, { isCombatOnly: true, hp: 25 }),
        ],
    },
};

const curse = { keepsDebuff: true, anyDebuff: WARLOCK_CURSES, shouldSkipDying: true, isAttack: true } as const;
const dot = { keepsDebuff: true, shouldSkipDying: true, isAttack: true } as const;
const execute = { hp: 20, unit: "target", isAttack: true } as const;

export const WARLOCK_LISTS: ClassLists = {
    rotation: {
        damage: [
            step("SummonImp", L.SummonImp, { isWithoutPet: true, notKnown: L.SummonVoidwalker }),
            step("SummonVoidwalker", L.SummonVoidwalker, { isWithoutPet: true }),
            step("SummonSuccubus", L.SummonSuccubus, { isWithoutPet: true }, false),
            step("SummonIncubus", L.SummonIncubus, { isWithoutPet: true }, false),
            step("SummonFelhunter", L.SummonFelhunter, { isWithoutPet: true }, false),
            step("LifeTap", L.LifeTap, { manaMax: 20, hpMin: 40 }),
            step("CurseOfAgony", L.CurseOfAgony, curse),
            step("CurseOfTheElements", L.CurseOfTheElements, curse, false),
            step("CurseOfShadow", L.CurseOfShadow, curse, false),
            step("BaneOfHavoc", L.BaneOfHavoc, curse, false),
            step("Corruption", L.Corruption, dot),
            step("Wrack", L.Wrack, dot),
            step("SiphonLife", L.SiphonLife, dot),
            step("Immolate", L.Immolate, dot),
            step("Incinerate", L.Incinerate, { needDebuff: L.Immolate, isAttack: true }),
            step("Conflagrate", L.Conflagrate, { needDebuff: L.Immolate, isAttack: true }),
            step("Shadowburn", L.Shadowburn, execute),
            step("SoulFire", L.SoulFire, execute, false),
            step("DrainSoul", L.DrainSoul, execute, false),
            step("SearingPain", L.SearingPain, { isAttack: true }, false),
            step("DrainLife", L.DrainLife, { isAttack: true, hp: 40 }),
            step("ShadowBolt", L.ShadowBolt, { isFiller: true, isAttack: true }),
            step("Shoot", L.Shoot, { isAutoRepeat: true, isAttack: true }),
        ],
    },
    aoe: {
        damage: [
            step("RainOfFire", L.RainOfFire, { isAttack: true }),
            step("Hellfire", L.Hellfire, { isAttack: true, hpMin: 50 }),
            step("Corruption", L.Corruption, { keepsDebuff: true, isAttack: true }),
            step("CurseOfAgony", L.CurseOfAgony, { keepsDebuff: true, anyDebuff: WARLOCK_CURSES, isAttack: true }),
            step("HowlOfTerror", L.HowlOfTerror, { isCombatOnly: true }),
            step("ShadowBolt", L.ShadowBolt, { isFiller: true, isAttack: true }),
        ],
    },
    defense: {
        damage: [
            step("ShadowWard", L.ShadowWard, { isCombatOnly: true, hp: 60 }, false),
            step("HowlOfTerror", L.HowlOfTerror, { isCombatOnly: true, hp: 35 }),
        ],
    },
};
