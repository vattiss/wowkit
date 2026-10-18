import { Priest as Pr } from "@wowkit/wow-data";
import { createStep as step } from "../step.interface";
import type { ClassLists } from "./list.interface";

/** The shield waits for Weakened Soul to run out. */
const shield = { isKeptUp: true, keepsDebuff: Pr.WeakenedSoul, refresh: 0 } as const;
const shieldDefense = step("PowerWordShield", Pr.PowerWordShield, { ...shield, isCombatOnly: true, hp: 70, unit: "player" });

export const PRIEST_LISTS: ClassLists = {
    rotation: {
        damage: [
            step("ShadowWordPain", Pr.ShadowWordPain, { keepsDebuff: true, shouldSkipDying: true, isAttack: true }),
            step("ShadowWordDeath", Pr.ShadowWordDeath, { hp: 20, unit: "target", isAttack: true }),
            step("DevouringPlague", Pr.DevouringPlague, { keepsDebuff: true, shouldSkipDying: true, isAttack: true }),
            step("Chastise", Pr.Chastise, { isAttack: true }, false),
            step("ConfoundingFlash", Pr.ConfoundingFlash, { isAttack: true }, false),
            step("Penance", Pr.Penance, { isAttack: true }),
            step("MindBlast", Pr.MindBlast, { isAttack: true }),
            step("MindFlay", Pr.MindFlay, { isFiller: true, isAttack: true }),
            step("HolyFire", Pr.HolyFire, { keepsDebuff: true, shouldSkipDying: true, isAttack: true }),
            step("Smite", Pr.Smite, { isFiller: true, isAttack: true }),
            step("Shoot", Pr.Shoot, { isAutoRepeat: true, isAttack: true }),
            step("FlashHeal", Pr.FlashHeal, { hp: 70, isHeal: true }),
            step("Heal", Pr.Heal, { hp: 80, isHeal: true }),
            step("PowerWordShield", Pr.PowerWordShield, { ...shield, hp: 90, isHeal: true }),
            step("Renew", Pr.Renew, { hp: 85, isKeptUp: true, refresh: 4, isHeal: true }),
            step("LesserHeal", Pr.LesserHeal, { hp: 75, isHeal: true }),
        ],
        heal: [
            step("PowerWordShield", Pr.PowerWordShield, { ...shield, hp: 90, isHeal: true }),
            step("Penance", Pr.Penance, { hp: 70, isHeal: true }),
            step("PrayerOfMending", Pr.PrayerOfMending, { hp: 90, isHeal: true }),
            step("BindingHeal", Pr.BindingHeal, { hp: 70, isHeal: true }),
            step("DivineGrace", Pr.DivineGrace, { hp: 50, isHeal: true }),
            step("ContingencyPlan", Pr.ContingencyPlan, { hp: 80, isHeal: true }),
            step("FlashHeal", Pr.FlashHeal, { hp: 70, isHeal: true }),
            step("GreaterHeal", Pr.GreaterHeal, { hp: 55, isHeal: true }),
            step("Heal", Pr.Heal, { hp: 80, isHeal: true }),
            step("Renew", Pr.Renew, { hp: 90, isKeptUp: true, refresh: 4, isHeal: true }),
            step("PrayerOfHealing", Pr.PrayerOfHealing, { hp: 75, isHeal: true }),
            step("LesserHeal", Pr.LesserHeal, { hp: 85, isHeal: true }),
            step("Smite", Pr.Smite, { isFiller: true, isAttack: true }),
            step("Shoot", Pr.Shoot, { isAutoRepeat: true, isAttack: true }),
        ],
    },
    aoe: {
        damage: [
            step("HolyNova", Pr.HolyNova, { isAttack: true }),
            step("ShadowWordPain", Pr.ShadowWordPain, { keepsDebuff: true, isAttack: true }),
            step("ShadowWordDeath", Pr.ShadowWordDeath, { hp: 20, unit: "target", isAttack: true }),
            step("MindFlay", Pr.MindFlay, { isAttack: true }),
            step("MindBlast", Pr.MindBlast, { isAttack: true }),
            step("Smite", Pr.Smite, { isFiller: true, isAttack: true }),
            step("FlashHeal", Pr.FlashHeal, { hp: 70, isHeal: true }),
        ],
        heal: [
            step("PrayerOfHealing", Pr.PrayerOfHealing, { hp: 75, isHeal: true }),
            step("PrayerOfMending", Pr.PrayerOfMending, { hp: 90, isHeal: true }),
            step("BindingHeal", Pr.BindingHeal, { hp: 70, isHeal: true }),
            step("HolyNova", Pr.HolyNova),
            step("Renew", Pr.Renew, { hp: 90, isKeptUp: true, isHeal: true }),
            step("FlashHeal", Pr.FlashHeal, { hp: 70, isHeal: true }),
            step("GreaterHeal", Pr.GreaterHeal, { hp: 55, isHeal: true }),
        ],
    },
    defense: {
        damage: [
            shieldDefense,
            step("DarkSacrifice", Pr.DarkSacrifice, { isCombatOnly: true, hp: 40 }, false),
            step("Fade", Pr.Fade, { isCombatOnly: true, hp: 50, isGroupOnly: true }),
        ],
        heal: [shieldDefense, step("Fade", Pr.Fade, { isCombatOnly: true, hp: 50, isGroupOnly: true })],
    },
};
