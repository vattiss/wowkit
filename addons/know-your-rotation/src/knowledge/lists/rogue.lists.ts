import { Rogue as R } from "@wowkit/wow-data";
import { createStep as step } from "../step.interface";
import { BLEED_IMMUNE } from "./list-groups.constants";
import type { ClassLists } from "./list.interface";

export const ROGUE_LISTS: ClassLists = {
    rotation: {
        damage: [
            step("Stealth", R.Stealth, {
                isKeptUp: true,
                isOutOfCombatOnly: true,
                isWithEnemyTarget: true,
                needKnownAny: [R.Ambush, R.Garrote, R.CheapShot],
            }),
            step("Garrote", R.Garrote, { needBuff: R.Stealth, isAttack: true }),
            step("Ambush", R.Ambush, { needBuff: R.Stealth, isAttack: true }),
            step("SliceAndDice", R.SliceAndDice, { comboMin: 1, isKeptUp: true, refresh: 4, isAttack: true }),
            step("Rupture", R.Rupture, {
                comboMin: 5,
                keepsDebuff: true,
                noCreature: BLEED_IMMUNE,
                shouldSkipDying: true,
                minLevel: 40,
                isAttack: true,
            }),
            step("Eviscerate", R.Eviscerate, { comboMin: 2, hpPerCombo: 8, unit: "target", isAttack: true }),
            // Leveling: a mob below your level dies in a few hits, so finish from 2 points on; a mob of your level is worth 3
            step("EviscerateWeak", R.Eviscerate, { comboMin: 2, isForWeakTarget: true, maxLevel: 19, isAttack: true }),
            step("EviscerateLevel", R.Eviscerate, { comboMin: 3, maxLevel: 19, isAttack: true }),
            step("Eviscerate5", R.Eviscerate, { comboMin: 5, isAttack: true }),
            step("Riposte", R.Riposte, { proc: "parry", isAttack: true }),
            step("ExposeArmor", R.ExposeArmor, { comboMin: 5, keepsDebuff: true, isAttack: true }, false),
            step("Hemorrhage", R.Hemorrhage, { isAttack: true }),
            step("GhostlyStrike", R.GhostlyStrike, { isAttack: true }),
            step("Mutilate", R.Mutilate, { isUsableOnly: true, isAttack: true }),
            step("Venom", R.Venom, { comboMin: 5, isAttack: true }, false),
            step("Backstab", R.Backstab, { isUsableOnly: true, isFromBehind: true, isAttack: true }),
            step("SinisterStrike", R.SinisterStrike, { isFiller: true, isAttack: true }),
        ],
    },
    aoe: {
        damage: [
            step("BladeFlurry", R.BladeFlurry, { isAttack: true }),
            step("SliceAndDice", R.SliceAndDice, { comboMin: 1, isKeptUp: true, isAttack: true }),
            step("Eviscerate", R.Eviscerate, { comboMin: 5, isAttack: true }),
            step("Hemorrhage", R.Hemorrhage, { isAttack: true }),
            step("Mutilate", R.Mutilate, { isUsableOnly: true, isAttack: true }),
            step("SinisterStrike", R.SinisterStrike, { isFiller: true, isAttack: true }),
        ],
    },
    defense: {
        damage: [
            step("Preparation", R.Preparation, { isCombatOnly: true }, false),
            step("Evasion", R.Evasion, { isCombatOnly: true, hp: 40 }),
            step("Vanish", R.Vanish, { isCombatOnly: true, hp: 20 }),
            step("Sprint", R.Sprint, { isCombatOnly: true, hp: 25 }),
            step("Feint", R.Feint, { isCombatOnly: true, hp: 50, isGroupOnly: true }),
        ],
    },
};
