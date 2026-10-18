import { Druid as D } from "@wowkit/wow-data";
import { createStep as step } from "../step.interface";
import { BLEED_IMMUNE } from "./list-groups.constants";
import type { ClassLists } from "./list.interface";

const damage = [
    step("FaerieFire", D.FaerieFire, { keepsDebuff: true, isAttack: true }, false),
    step("Moonfire", D.Moonfire, { keepsDebuff: true, shouldSkipDying: true, isAttack: true }),
    step("InsectSwarm", D.InsectSwarm, { keepsDebuff: true, shouldSkipDying: true, isAttack: true }),
    step("Starfire", D.Starfire, { isAttack: true }),
    step("Wrath", D.Wrath, { isFiller: true, isAttack: true }),
    step("Rejuvenation", D.Rejuvenation, { hp: 90, isKeptUp: true, isHeal: true }),
    step("HealingTouch", D.HealingTouch, { hp: 80, isHeal: true }),
];
const bear = [
    step("DemoralizingRoar", D.DemoralizingRoar, { keepsDebuff: true, isAttack: true }),
    step("MangleBear", D.Mangle, { isAttack: true }),
    step("Lacerate", D.Lacerate, { keepsDebuff: true, stacks: 5, noCreature: BLEED_IMMUNE, isAttack: true }),
    step("Swipe", D.Swipe, { enemiesMin: 3, enemiesYards: 10, isAttack: true }),
    step("Maul", D.Maul, { isFiller: true, isAttack: true }),
];
const damageDefense = [
    step("Barkskin", D.Barkskin, { isCombatOnly: true, hp: 50 }),
    step("NaturesGrasp", D.NaturesGrasp, { isCombatOnly: true, hp: 40 }),
];

export const DRUID_LISTS: ClassLists = {
    rotation: {
        damage,
        hybrid: damage,
        heal: [
            step("Swiftmend", D.Swiftmend, { hp: 60, isHeal: true }),
            step("WildGrowth", D.WildGrowth, { hp: 80, isHeal: true }),
            step("Regrowth", D.Regrowth, { hp: 70, isHeal: true }),
            step("Rejuvenation", D.Rejuvenation, { hp: 90, isKeptUp: true, isHeal: true }),
            step("HealingTouch", D.HealingTouch, { hp: 80, isHeal: true }),
            step("Innervate", D.Innervate, { isCombatOnly: true, manaMax: 30 }),
            step("Moonfire", D.Moonfire, { keepsDebuff: true, isAttack: true }),
            step("Wrath", D.Wrath, { isFiller: true, isAttack: true }),
        ],
        // The tank list is used out of bear form: shift first
        tank: [step("BearForm", D.BearForm, { noForm: D.BearForm, isFightOnly: true }), ...bear],
        cat: [
            step("Prowl", D.Prowl, { isKeptUp: true, isOutOfCombatOnly: true, isWithEnemyTarget: true, needKnownAny: [D.Ravage] }),
            step("Ravage", D.Ravage, { needBuff: D.Prowl, isAttack: true }),
            step("FeralChargeCat", D.FeralChargeCat, { isAttack: true }),
            step("TigersFury", D.TigersFury, { isKeptUp: true, isFightOnly: true }, false),
            step("MangleCat", D.Mangle, { isAttack: true }),
            step("Rake", D.Rake, { keepsDebuff: true, noCreature: BLEED_IMMUNE, shouldSkipDying: true, isAttack: true }),
            step("Rip", D.Rip, { comboMin: 5, keepsDebuff: true, noCreature: BLEED_IMMUNE, shouldSkipDying: true, isAttack: true }),
            step("FerociousBite", D.FerociousBite, { comboMin: 5, isAttack: true }),
            step("Shred", D.Shred, { isUsableOnly: true, isFromBehind: true, isAttack: true }),
            step("Claw", D.Claw, { isFiller: true, isAttack: true }),
        ],
        bear,
    },
    aoe: {
        damage: [
            step("Hurricane", D.Hurricane, { isAttack: true }),
            step("Moonfire", D.Moonfire, { keepsDebuff: true, isAttack: true }),
            step("FaerieFire", D.FaerieFire, { keepsDebuff: true, isAttack: true }),
            step("Starfire", D.Starfire, { isAttack: true }),
            step("Wrath", D.Wrath, { isFiller: true, isAttack: true }),
            step("HealingTouch", D.HealingTouch, { hp: 80, isHeal: true }),
        ],
        heal: [
            step("Tranquility", D.Tranquility, { hp: 70, isHeal: true }),
            step("WildGrowth", D.WildGrowth, { hp: 80, isHeal: true }),
            step("Hurricane", D.Hurricane, { isAttack: true }),
            step("Rejuvenation", D.Rejuvenation, { hp: 90, isKeptUp: true, isHeal: true }),
            step("Regrowth", D.Regrowth, { hp: 70, isHeal: true }),
            step("HealingTouch", D.HealingTouch, { hp: 80, isHeal: true }),
        ],
        tank: [
            step("DemoralizingRoar", D.DemoralizingRoar, { keepsDebuff: true, isAttack: true }),
            step("MangleBear", D.Mangle, { isAttack: true }),
            step("Lacerate", D.Lacerate, { keepsDebuff: true, isAttack: true }),
            step("Swipe", D.Swipe, { isAttack: true }),
            step("Maul", D.Maul, { isFiller: true, isAttack: true }),
        ],
        cat: [
            step("TigersFury", D.TigersFury, { isKeptUp: true, isFightOnly: true }),
            step("Rip", D.Rip, { comboMin: 5, keepsDebuff: true, isAttack: true }),
            step("Rake", D.Rake, { keepsDebuff: true, isAttack: true }),
            step("Claw", D.Claw, { isFiller: true, isAttack: true }),
        ],
        bear: [
            step("DemoralizingRoar", D.DemoralizingRoar, { keepsDebuff: true, isAttack: true }),
            step("MangleBear", D.Mangle, { isAttack: true }),
            step("Lacerate", D.Lacerate, { keepsDebuff: true, isAttack: true }),
            step("Swipe", D.Swipe, { isAttack: true }),
            step("Maul", D.Maul, { isFiller: true, isAttack: true }),
        ],
    },
    defense: {
        damage: damageDefense,
        hybrid: damageDefense,
        tank: [
            step("Barkskin", D.Barkskin, { isCombatOnly: true, hp: 60 }),
            step("FrenziedRegeneration", D.FrenziedRegeneration, { isCombatOnly: true, hp: 40 }),
            step("NaturesGrasp", D.NaturesGrasp, { isCombatOnly: true, hp: 40 }),
        ],
        heal: [
            step("Barkskin", D.Barkskin, { isCombatOnly: true, hp: 50 }),
            step("Innervate", D.Innervate, { isCombatOnly: true, manaMax: 30 }, false),
        ],
        cat: [step("Barkskin", D.Barkskin, { isCombatOnly: true, hp: 50 })],
        bear: [
            step("Barkskin", D.Barkskin, { isCombatOnly: true, hp: 60 }),
            step("FrenziedRegeneration", D.FrenziedRegeneration, { isCombatOnly: true, hp: 40 }),
        ],
    },
};
