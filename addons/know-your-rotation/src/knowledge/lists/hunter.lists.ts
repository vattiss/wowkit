import { Hunter as H } from "@wowkit/wow-data";
import { createStep as step } from "../step.interface";
import { HUNTER_STINGS } from "./list-groups.constants";
import type { ClassLists } from "./list.interface";

const pet = [
    step("CallPet", H.CallPet, { isWithoutPet: true, isPetAliveOnly: true, isWithTamedPet: true, isFightOnly: true }),
    step("RevivePet", H.RevivePet, { isPetDeadOnly: true, isOutOfCombatOnly: true }),
    step("SummonHawk", H.SummonHawk, { isWithoutPet: true }, false),
];
const sting = { keepsDebuff: true, anyDebuff: HUNTER_STINGS, noCreature: true, shouldSkipDying: true, isAttack: true } as const;
const defense = [
    step("Deterrence", H.Deterrence, { isCombatOnly: true, hp: 40 }),
    step("FeignDeath", H.FeignDeath, { isCombatOnly: true, hp: 25 }),
    step("Disengage", H.Disengage, { isCombatOnly: true, hp: 35, isGroupOnly: true, isAlsoWithPet: true }),
];

export const HUNTER_LISTS: ClassLists = {
    rotation: {
        range: [
            ...pet,
            step("MendPet", H.MendPet, { isWithPet: true, hp: 40, unit: "pet" }),
            step("HuntersMark", H.HuntersMark, { keepsDebuff: true, shouldSkipDying: true, isPullFirst: true, isAttack: true }),
            step("SerpentSting", H.SerpentSting, sting),
            step("ViperSting", H.ViperSting, { ...sting, isForManaUsers: true }, false),
            step("ScorpidSting", H.ScorpidSting, sting, false),
            step("AimedShot", H.AimedShot, { isAttack: true }),
            step("SniperShot", H.SniperShot, { isAttack: true }),
            step("HydraShot", H.HydraShot, { isAttack: true }, false),
            step("ScatterShot", H.ScatterShot, { isAttack: true }, false),
            step("TranquilizingShot", H.TranquilizingShot, { isAttack: true }, false),
            step("EnchantedFlare", H.EnchantedFlare, { isAttack: true }, false),
            step("Flare", H.Flare, { isAttack: true }, false),
            step("DistractingShot", H.DistractingShot, { isAttack: true }, false),
            step("MultiShot", H.MultiShot, { isAttack: true }),
            step("ArcaneShot", H.ArcaneShot, { isAttack: true }),
            step("Intimidation", H.Intimidation, { isAttack: true }, false),
        ],
        melee: [
            ...pet,
            step("HuntersMark", H.HuntersMark, { keepsDebuff: true, shouldSkipDying: true, isPullFirst: true, isAttack: true }),
            step("Counterattack", H.Counterattack, { proc: "parry", isAttack: true }),
            step("MongooseBite", H.MongooseBite, { proc: "mongoose", isAttack: true }),
            step("StriderKick", H.StriderKick, { isAttack: true }),
            step("Lacerate", H.Lacerate, { keepsDebuff: true, isAttack: true }),
            step("WingClip", H.WingClip, { keepsDebuff: true, isAttack: true }),
            step("RaptorStrike", H.RaptorStrike, { isFiller: true, isAttack: true }),
        ],
    },
    aoe: {
        range: [
            step("HuntersMark", H.HuntersMark, { keepsDebuff: true, isPullFirst: true, isAttack: true }),
            step("MultiShot", H.MultiShot, { isAttack: true }),
            step("Volley", H.Volley, { isAttack: true }),
            step("ArcaneShot", H.ArcaneShot, { isAttack: true }),
            step("SerpentSting", H.SerpentSting, { keepsDebuff: true, noCreature: true, isAttack: true }),
        ],
        melee: [
            step("MultiShot", H.MultiShot, { isAttack: true }),
            step("Volley", H.Volley, { isAttack: true }),
            step("Counterattack", H.Counterattack, { proc: "parry", isAttack: true }),
            step("MongooseBite", H.MongooseBite, { proc: "mongoose", isAttack: true }),
            step("StriderKick", H.StriderKick, { isAttack: true }),
            step("RaptorStrike", H.RaptorStrike, { isFiller: true, isAttack: true }),
        ],
    },
    defense: {
        range: defense,
        melee: defense,
    },
};
