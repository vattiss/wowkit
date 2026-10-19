// The buffs the addon reminds about, per class (UnitClass token).
import { Druid as D, Hunter as H, Mage as M, Paladin as P, Priest as Pr, Shaman as Sh, Warlock as L, Warrior as W } from "@wowkit/wow-data";
import type { ClassBuff, PartyBuff } from "./class-buff.interface";

function createClassBuff(
    key: string,
    id: number,
    options: Omit<ClassBuff, "key" | "id" | "isOnByDefault"> = {},
    isOnByDefault = true,
): ClassBuff {
    return { key, id, isOnByDefault, ...options };
}

/** A blessing: the player's own counts, its Greater version covers one class. */
function createBlessing(groupIds: number[]): PartyBuff {
    return { groupIds, isPerClass: true, isOwnOnly: true };
}

const mageArmors = [M.MageArmor, M.IceArmor, M.FrostArmor];
const lockSkins = [L.DemonArmor, L.DemonSkin];
const shamanShields = [Sh.LightningShield, Sh.WaterShield];
const palaAuras = [
    P.DevotionAura,
    P.RetributionAura,
    P.ConcentrationAura,
    P.SanctityAura,
    P.FireResistAura,
    P.FrostResistAura,
    P.ShadowResistAura,
];
const palaBlessings = [P.BlessingMight, P.BlessingKings, P.BlessingWisdom, P.BlessingSalvation, P.BlessingLight];
const hunterAspects = [H.AspectHawk, H.AspectMonkey, H.AspectWild, H.AspectCheetah, H.AspectPack, H.AspectBeast];

/** In list order: of a category, the first one that is learned and on the bars is the one asked for. */
export const BUFF_LISTS: { [classToken: string]: ClassBuff[] | undefined } = {
    DRUID: [
        createClassBuff("MarkoftheWild", D.MarkOfTheWild, { last: 1800, party: { groupIds: D.GiftOfTheWild } }),
        createClassBuff("Thorns", D.Thorns, { last: 600 }),
        createClassBuff("Moonkin", D.Moonkin, {}, false),
    ],
    PALADIN: [
        createClassBuff("DevotionAura", P.DevotionAura, { categoryMembers: palaAuras }),
        createClassBuff("RetributionAura", P.RetributionAura, { categoryMembers: palaAuras }),
        createClassBuff("ConcentrationAura", P.ConcentrationAura, { categoryMembers: palaAuras }),
        createClassBuff("SanctityAura", P.SanctityAura, { categoryMembers: palaAuras }),
        createClassBuff("FireResistAura", P.FireResistAura, { categoryMembers: palaAuras }),
        createClassBuff("FrostResistAura", P.FrostResistAura, { categoryMembers: palaAuras }),
        createClassBuff("ShadowResistAura", P.ShadowResistAura, { categoryMembers: palaAuras }),
        createClassBuff("BlessingMight", P.BlessingMight, {
            categoryMembers: palaBlessings,
            party: createBlessing(P.GreaterBlessingMight),
        }),
        createClassBuff("BlessingKings", P.BlessingKings, {
            categoryMembers: palaBlessings,
            party: createBlessing(P.GreaterBlessingKings),
        }),
        createClassBuff("BlessingWisdom", P.BlessingWisdom, {
            categoryMembers: palaBlessings,
            party: createBlessing(P.GreaterBlessingWisdom),
        }),
        createClassBuff("RighteousFury", P.RighteousFury, { last: 1800 }, false),
    ],
    WARRIOR: [createClassBuff("BattleShout", W.BattleShout, { last: 120 })],
    HUNTER: [
        createClassBuff("AspectHawk", H.AspectHawk, { categoryMembers: hunterAspects }),
        createClassBuff("AspectMonkey", H.AspectMonkey, { categoryMembers: hunterAspects }),
        createClassBuff("AspectWild", H.AspectWild, { categoryMembers: hunterAspects }),
        createClassBuff("TrueshotAura", H.TrueshotAura, { last: 1800 }),
    ],
    ROGUE: [],
    PRIEST: [
        createClassBuff("InnerFire", Pr.InnerFire, { last: 600 }),
        createClassBuff("PowerWordFortitude", Pr.PowerWordFortitude, { last: 1800, party: { groupIds: Pr.PrayerOfFortitude } }),
        createClassBuff("DivineSpirit", Pr.DivineSpirit, { last: 1800, party: { groupIds: Pr.PrayerOfSpirit } }),
        createClassBuff("ShadowProtection", Pr.ShadowProtection, { last: 600, party: { groupIds: Pr.PrayerOfShadowProtection } }),
        createClassBuff("Shadowform", Pr.Shadowform, { last: 1800 }),
    ],
    SHAMAN: [
        createClassBuff("LightningShield", Sh.LightningShield, { categoryMembers: shamanShields, last: 600 }),
        createClassBuff("WaterShield", Sh.WaterShield, { categoryMembers: shamanShields, last: 600 }),
    ],
    MAGE: [
        createClassBuff("ArcaneIntellect", M.ArcaneIntellect, { last: 1800, party: { groupIds: M.ArcaneBrilliance, isManaOnly: true } }),
        createClassBuff("MageArmor", M.MageArmor, { categoryMembers: mageArmors }),
        createClassBuff("IceArmor", M.IceArmor, { categoryMembers: mageArmors }),
        createClassBuff("FrostArmor", M.FrostArmor, { categoryMembers: mageArmors }),
        createClassBuff("AmplifyMagic", M.AmplifyMagic, { last: 600 }, false),
    ],
    WARLOCK: [
        createClassBuff("DemonArmor", L.DemonArmor, { categoryMembers: lockSkins }),
        createClassBuff("DemonSkin", L.DemonSkin, { categoryMembers: lockSkins }),
        createClassBuff("UnendingBreath", L.UnendingBreath, { isSwimmingOnly: true, last: 600 }),
    ],
};
