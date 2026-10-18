import { Rogue as R, Warrior as W } from "@wowkit/wow-data";
import { createStep as step } from "../step.interface";
import { BLEED_IMMUNE } from "./list-groups.constants";
import type { ClassLists } from "./list.interface";

const lastResorts = [
    step("LastStand", W.LastStand, { isCombatOnly: true, hp: 35 }),
    step("ShieldWall", W.ShieldWall, { isCombatOnly: true, hp: 25 }),
];

export const WARRIOR_LISTS: ClassLists = {
    rotation: {
        damage: [
            step("Charge", W.Charge, { isOutOfCombatOnly: true, isAttack: true }),
            step("Bloodrage", W.Bloodrage, { isCombatOnly: true, hpMin: 70 }),
            step("Execute", W.Execute, { proc: true, isAttack: true }),
            step("VictoryRush", W.VictoryRush, { isAttack: true, proc: true }),
            step("Overpower", W.Overpower, { proc: "dodge", isAttack: true }),
            step("SpearingStrike", W.SpearingStrike, { isAttack: true }),
            step("Revenge", W.Revenge, { proc: "revenge", isAttack: true }),
            step("Bloodthirst", W.Bloodthirst, { isAttack: true }),
            step("Whirlwind", W.Whirlwind, { enemiesMin: 2, enemiesYards: 10, isAttack: true }),
            step("ShieldSlam", W.ShieldSlam, { isAttack: true }),
            step("MortalStrike", W.MortalStrike, { isAttack: true }),
            step("Rend", W.Rend, { keepsDebuff: true, noCreature: BLEED_IMMUNE, shouldSkipDying: true, isAttack: true }),
            step(
                "SunderArmor",
                W.SunderArmor,
                { keepsDebuff: true, stacks: 5, anyDebuff: [R.ExposeArmor], shouldSkipDying: true, isAttack: true },
                false,
            ),
            step("Slam", W.Slam, { isUsableOnly: true, isAttack: true }, false),
            step("Hamstring", W.Hamstring, { keepsDebuff: true, isAttack: true }, false),
            step("HeroicStrike", W.HeroicStrike, { isFiller: true, isAttack: true }),
        ],
        tank: [
            step("DemoralizingShout", W.DemoralizingShout, { keepsDebuff: true, isAttack: true }),
            step("VictoryRush", W.VictoryRush, { isAttack: true, proc: true }),
            step("Revenge", W.Revenge, { proc: "revenge", isAttack: true }),
            step("SpearingStrike", W.SpearingStrike, { isAttack: true }),
            step("ShieldSlam", W.ShieldSlam, { isAttack: true }),
            step("SunderArmor", W.SunderArmor, { keepsDebuff: true, stacks: 5, anyDebuff: [R.ExposeArmor], isAttack: true }),
            step("ThunderClap", W.ThunderClap, { keepsDebuff: true, isAttack: true }),
            step("ShieldBlock", W.ShieldBlock, { isCombatOnly: true, hp: 80 }),
            step("HeroicStrike", W.HeroicStrike, { isFiller: true, isAttack: true }),
        ],
    },
    aoe: {
        damage: [
            step("SweepingStrikes", W.SweepingStrikes, { isAttack: true }),
            step("Whirlwind", W.Whirlwind, { isAttack: true }),
            step("Cleave", W.Cleave, { isAttack: true }),
            step("ThunderClap", W.ThunderClap, { keepsDebuff: true, isAttack: true }),
            step("DemoralizingShout", W.DemoralizingShout, { keepsDebuff: true, isAttack: true }),
            step("PiercingHowl", W.PiercingHowl, { isAttack: true }),
            step("HeroicStrike", W.HeroicStrike, { isFiller: true, isAttack: true }),
        ],
        tank: [
            step("ThunderClap", W.ThunderClap, { keepsDebuff: true, isAttack: true }),
            step("DemoralizingShout", W.DemoralizingShout, { keepsDebuff: true, isAttack: true }),
            step("Cleave", W.Cleave, { isAttack: true }),
            step("Revenge", W.Revenge, { proc: "revenge", isAttack: true }),
            step("SunderArmor", W.SunderArmor, { isAttack: true }),
            step("HeroicStrike", W.HeroicStrike, { isFiller: true, isAttack: true }),
        ],
    },
    defense: {
        damage: [
            step("BerserkerRage", W.BerserkerRage, { isCombatOnly: true, hp: 60 }),
            ...lastResorts,
            step("Retaliation", W.Retaliation, { isCombatOnly: true, hp: 40 }),
        ],
        tank: [step("ShieldBlock", W.ShieldBlock, { isCombatOnly: true, hp: 70 }), ...lastResorts],
    },
};
