import { Paladin as P } from "@wowkit/wow-data";
import { createStep as step } from "../step.interface";
import { PALADIN_SEALS, UNDEAD_AND_DEMONS } from "./list-groups.constants";
import type { ClassLists } from "./list.interface";

const createSeal = (key: string, id: number) => step(key, id, { isKeptUp: true, anyBuff: PALADIN_SEALS, isFightOnly: true });
const heals = [step("FlashOfLight", P.FlashOfLight, { hp: 70, isHeal: true }), step("HolyLight", P.HolyLight, { hp: 80, isHeal: true })];
const lastResorts = [
    step("VoiceOfTruth", P.VoiceOfTruth, { isCombatOnly: true, hp: 50 }),
    step("DivineProtection", P.DivineProtection, { isCombatOnly: true, hp: 40 }),
    step("DivineShield", P.DivineShield, { isCombatOnly: true, hp: 25 }),
    step("LayOnHands", P.LayOnHands, { isCombatOnly: true, hp: 15 }),
];

export const PALADIN_LISTS: ClassLists = {
    rotation: {
        damage: [
            step("SealOfTheCrusader", P.SealOfTheCrusader, {
                isKeptUp: true,
                anyBuff: PALADIN_SEALS,
                isFightOnly: true,
                keepsDebuff: P.JudgementOfTheCrusader,
            }),
            step("Judgement", P.Judgement, { needAnyBuff: PALADIN_SEALS, isAttack: true }),
            createSeal("SealOfCommand", P.SealOfCommand),
            createSeal("SealOfFury", P.SealOfFury),
            createSeal("SealOfRighteousness", P.SealOfRighteousness),
            step("HammerOfWrath", P.HammerOfWrath, { proc: true, isAttack: true }),
            step("HolyStrike", P.HolyStrike, { isAttack: true }),
            step("SwiftJudgement", P.SwiftJudgement, { needAnyBuff: PALADIN_SEALS, isAttack: true }),
            step("CrusaderStrike", P.CrusaderStrike, { isAttack: true }),
            step("HolyShock", P.HolyShock, { isAttack: true }),
            step("Consecration", P.Consecration, { enemiesMin: 2, enemiesYards: 10, isAttack: true }),
            step("Exorcism", P.Exorcism, { isUsableOnly: true, creature: UNDEAD_AND_DEMONS, isAttack: true }),
            ...heals,
        ],
        tank: [
            createSeal("SealOfFury", P.SealOfFury),
            createSeal("SealOfRighteousness", P.SealOfRighteousness),
            step("HolyShield", P.HolyShield, { isCombatOnly: true, isAttack: true }),
            step("HolyStrike", P.HolyStrike, { isAttack: true }),
            step("CrusaderStrike", P.CrusaderStrike, { isAttack: true }),
            step("Judgement", P.Judgement, { needAnyBuff: PALADIN_SEALS, isAttack: true }),
            step("SwiftJudgement", P.SwiftJudgement, { needAnyBuff: PALADIN_SEALS, isAttack: true }),
            step("Consecration", P.Consecration, { enemiesMin: 2, enemiesYards: 10, isAttack: true }),
            step("HammerOfJustice", P.HammerOfJustice, { isAttack: true }),
            step("HolyShock", P.HolyShock, { isAttack: true }),
            ...heals,
        ],
        heal: [
            step("SealOfLight", P.SealOfLight, {
                isKeptUp: true,
                anyBuff: PALADIN_SEALS,
                isFightOnly: true,
                keepsDebuff: P.JudgementOfLight,
            }),
            step("SealOfWisdom", P.SealOfWisdom, {
                isKeptUp: true,
                anyBuff: PALADIN_SEALS,
                isFightOnly: true,
                keepsDebuff: P.JudgementOfWisdom,
            }),
            step("Judgement", P.Judgement, { needAnyBuff: PALADIN_SEALS, isAttack: true }),
            step("LightsVigil", P.LightsVigil, { hp: 70, isHeal: true }),
            step("HolyShock", P.HolyShock, { hp: 80, isHeal: true }),
            ...heals,
            step("SwiftJudgement", P.SwiftJudgement, { needAnyBuff: PALADIN_SEALS, isAttack: true }),
        ],
    },
    aoe: {
        damage: [
            createSeal("SealOfCommand", P.SealOfCommand),
            createSeal("SealOfFury", P.SealOfFury),
            createSeal("SealOfRighteousness", P.SealOfRighteousness),
            step("Consecration", P.Consecration, { isAttack: true }),
            step("HolyWrath", P.HolyWrath, { isUsableOnly: true, isAttack: true }),
            step("HolyStrike", P.HolyStrike, { isAttack: true }),
            step("CrusaderStrike", P.CrusaderStrike, { isAttack: true }),
            step("Judgement", P.Judgement, { isAttack: true }),
            step("SwiftJudgement", P.SwiftJudgement, { isAttack: true }),
            step("Exorcism", P.Exorcism, { isUsableOnly: true, isAttack: true }),
            ...heals,
        ],
        tank: [
            createSeal("SealOfFury", P.SealOfFury),
            createSeal("SealOfRighteousness", P.SealOfRighteousness),
            step("Consecration", P.Consecration, { isAttack: true }),
            step("HolyWrath", P.HolyWrath, { isUsableOnly: true, isAttack: true }),
            step("HolyShield", P.HolyShield, { isCombatOnly: true }),
            step("Judgement", P.Judgement, { isAttack: true }),
            step("SwiftJudgement", P.SwiftJudgement, { isAttack: true }),
            ...heals,
        ],
        heal: [
            step("HolyWrath", P.HolyWrath, { isUsableOnly: true, isAttack: true }),
            step("Consecration", P.Consecration, { isAttack: true }),
            step("LightsVigil", P.LightsVigil, { hp: 70, isHeal: true }),
            step("HolyShock", P.HolyShock, { hp: 80, isHeal: true }),
            ...heals,
        ],
    },
    defense: {
        damage: lastResorts,
        tank: [
            step("HolyShield", P.HolyShield, { isCombatOnly: true, hp: 80 }),
            step("TemplarsBulwark", P.TemplarsBulwark, { isCombatOnly: true, hp: 60 }),
            ...lastResorts,
        ],
        heal: lastResorts,
    },
};
