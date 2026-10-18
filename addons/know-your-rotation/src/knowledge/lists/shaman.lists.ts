import { Shaman as Sh } from "@wowkit/wow-data";
import { createStep as step } from "../step.interface";
import type { ClassLists } from "./list.interface";

const heals = [
    step("LesserHealingWave", Sh.LesserHealingWave, { hp: 70, isHeal: true }),
    step("HealingWave", Sh.HealingWave, { hp: 80, isHeal: true }),
];
const damageDefense = [
    step("CallOfTheElements", Sh.CallOfTheElements, { isCombatOnly: true }, false),
    step("CallOfTheAncestors", Sh.CallOfTheAncestors, { isCombatOnly: true }, false),
    step("CallOfTheSpirits", Sh.CallOfTheSpirits, { isCombatOnly: true }, false),
    step("TotemicRecall", Sh.TotemicRecall, { isCombatOnly: true }, false),
    step("TotemicProjection", Sh.TotemicProjection, { isCombatOnly: true }, false),
    step("StoneclawTotem", Sh.StoneclawTotem, { isCombatOnly: true, hp: 50 }),
    step("GroundingTotem", Sh.GroundingTotem, { isCombatOnly: true, hp: 60 }, false),
    step("TremorTotem", Sh.TremorTotem, { isCombatOnly: true, hp: 70 }, false),
];

export const SHAMAN_LISTS: ClassLists = {
    rotation: {
        caster: [
            step("FlameShock", Sh.FlameShock, { keepsDebuff: true, shouldSkipDying: true, isAttack: true }),
            step("LavaBurst", Sh.LavaBurst, { needDebuff: Sh.FlameShock, isAttack: true }),
            step("EarthShock", Sh.EarthShock, { isAttack: true }),
            step("FrostShock", Sh.FrostShock, { keepsDebuff: true, needDebuff: Sh.FlameShock, isAttack: true }, false),
            step("ChainLightning", Sh.ChainLightning, { isAttack: true }, false),
            step("LightningBolt", Sh.LightningBolt, { isFiller: true, isAttack: true }),
            ...heals,
        ],
        melee: [
            step("Stormstrike", Sh.Stormstrike, { isAttack: true }),
            step("FlameShock", Sh.FlameShock, { keepsDebuff: true, shouldSkipDying: true, isAttack: true }),
            step("LavaBurst", Sh.LavaBurst, { needDebuff: Sh.FlameShock, notInMelee: Sh.Stormstrike, isAttack: true }),
            step("EarthShock", Sh.EarthShock, { isAttack: true }),
            step("FrostShock", Sh.FrostShock, { keepsDebuff: true, needDebuff: Sh.FlameShock, isAttack: true }, false),
            step("LightningBolt", Sh.LightningBolt, { isFiller: true, notInMelee: Sh.Stormstrike, isAttack: true }),
            ...heals,
        ],
        heal: [
            step("Riptide", Sh.Riptide, { hp: 90, isHeal: true }),
            step("LesserHealingWave", Sh.LesserHealingWave, { hp: 70, isHeal: true }),
            step("ChainHeal", Sh.ChainHeal, { hp: 75, isHeal: true }),
            step("HealingWave", Sh.HealingWave, { hp: 80, isHeal: true }),
            step("FlameShock", Sh.FlameShock, { keepsDebuff: true, isAttack: true }),
            step("LightningBolt", Sh.LightningBolt, { isFiller: true, isAttack: true }),
        ],
    },
    aoe: {
        caster: [
            step("ChainLightning", Sh.ChainLightning, { isAttack: true }),
            step("FireNova", Sh.FireNovaTotem, { isAttack: true }),
            step("FlameShock", Sh.FlameShock, { keepsDebuff: true, shouldSkipDying: true, isAttack: true }),
            step("FrostShock", Sh.FrostShock, { keepsDebuff: true, isAttack: true }, false),
            step("LightningBolt", Sh.LightningBolt, { isFiller: true, isAttack: true }),
            step("LesserHealingWave", Sh.LesserHealingWave, { hp: 70, isHeal: true }),
        ],
        melee: [
            step("FireNova", Sh.FireNovaTotem, { isAttack: true }),
            step("ChainLightning", Sh.ChainLightning, { isAttack: true }),
            step("Stormstrike", Sh.Stormstrike, { isAttack: true }),
            step("FlameShock", Sh.FlameShock, { keepsDebuff: true, isAttack: true }),
            step("LightningBolt", Sh.LightningBolt, { isFiller: true, isAttack: true }),
            step("LesserHealingWave", Sh.LesserHealingWave, { hp: 70, isHeal: true }),
        ],
        heal: [
            step("Riptide", Sh.Riptide, { hp: 90, isHeal: true }),
            step("ChainHeal", Sh.ChainHeal, { hp: 75, isHeal: true }),
            step("HealingStreamTotem", Sh.HealingStreamTotem),
            ...heals,
        ],
    },
    defense: {
        caster: damageDefense,
        melee: damageDefense,
        heal: [
            step("TotemicProjection", Sh.TotemicProjection, { isCombatOnly: true }, false),
            step("GroundingTotem", Sh.GroundingTotem, { isCombatOnly: true, hp: 60 }, false),
            step("StoneclawTotem", Sh.StoneclawTotem, { isCombatOnly: true, hp: 40 }),
            step("HealingStreamTotem", Sh.HealingStreamTotem, { isCombatOnly: true, hp: 80 }, false),
        ],
    },
};
