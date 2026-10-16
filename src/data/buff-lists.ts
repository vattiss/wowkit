// The buffs the addon reminds about, per class (UnitClass token).
import { Druid as D, Group as G, Hunter as H, Mage as M, Paladin as P, Priest as Pr, Shaman as Sh, Warlock as L, Warrior as W } from "./spells";

/** A buff the player can also cast on party members. */
export interface PartyBuff {
    /** The group version (Prayer of Fortitude): rank IDs, lowest first. */
    groupIds?: number[];
    /** Only for members who use mana (Arcane Intellect). */
    isManaOnly?: boolean;
    /** The group version covers members of one class only (Greater Blessings). */
    isPerClass?: boolean;
    /** Only the player's own aura counts (blessings: another paladin's is a different choice). */
    isOwnOnly?: boolean;
}

export interface BuffStep {
    key: string;
    id: number;
    /** Any aura of this family counts (one aspect, one paladin aura, one armor). */
    anyBuff?: number[];
    /**
     * How long the buff lasts (seconds), so it still counts as on you in combat, when the client
     * hides the auras.
     */
    last?: number;
    /** Only asked for while swimming. */
    isSwimmingOnly?: boolean;
    /** Off by default: a buff only one role wants. */
    isOnByDefault: boolean;
    /** Also reminded for party members. */
    party?: PartyBuff;
}

function createBuffStep(key: string, id: number, options: Omit<BuffStep, "key" | "id" | "isOnByDefault"> = {}, isOnByDefault = true): BuffStep {
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
const palaBlessings = [P.BlessingMight, P.BlessingKings, P.BlessingWisdom, P.BlessingSalvation, P.BlessingLight, P.BlessingSanctuary];
const hunterAspects = [H.AspectHawk, H.AspectMonkey, H.AspectWild, H.AspectCheetah, H.AspectPack, H.AspectBeast];

/** In list order: of a family, the first one that is learned and on the bars is the one asked for. */
export const BUFF_LISTS: { [classToken: string]: BuffStep[] | undefined } = {
    DRUID: [createBuffStep("MarkoftheWild", D.MarkOfTheWild, { last: 1800, party: { groupIds: G.GiftOfTheWild } }), createBuffStep("Thorns", D.Thorns, { last: 600 }), createBuffStep("Moonkin", D.Moonkin, {}, false)],
    PALADIN: [
        createBuffStep("DevotionAura", P.DevotionAura, { anyBuff: palaAuras }),
        createBuffStep("RetributionAura", P.RetributionAura, { anyBuff: palaAuras }),
        createBuffStep("ConcentrationAura", P.ConcentrationAura, { anyBuff: palaAuras }),
        createBuffStep("SanctityAura", P.SanctityAura, { anyBuff: palaAuras }),
        createBuffStep("FireResistAura", P.FireResistAura, { anyBuff: palaAuras }),
        createBuffStep("FrostResistAura", P.FrostResistAura, { anyBuff: palaAuras }),
        createBuffStep("ShadowResistAura", P.ShadowResistAura, { anyBuff: palaAuras }),
        createBuffStep("BlessingMight", P.BlessingMight, { anyBuff: palaBlessings, party: createBlessing(G.GreaterBlessingMight) }),
        createBuffStep("BlessingKings", P.BlessingKings, { anyBuff: palaBlessings, party: createBlessing(G.GreaterBlessingKings) }),
        createBuffStep("BlessingWisdom", P.BlessingWisdom, { anyBuff: palaBlessings, party: createBlessing(G.GreaterBlessingWisdom) }),
        createBuffStep("RighteousFury", P.RighteousFury, { last: 1800 }, false),
    ],
    WARRIOR: [createBuffStep("BattleShout", W.BattleShout, { last: 120 })],
    HUNTER: [
        createBuffStep("AspectHawk", H.AspectHawk, { anyBuff: hunterAspects }),
        createBuffStep("AspectMonkey", H.AspectMonkey, { anyBuff: hunterAspects }),
        createBuffStep("AspectWild", H.AspectWild, { anyBuff: hunterAspects }),
        createBuffStep("TrueshotAura", H.TrueshotAura, { last: 1800 }),
    ],
    ROGUE: [],
    PRIEST: [
        createBuffStep("InnerFire", Pr.InnerFire, { last: 600 }),
        createBuffStep("PowerWordFortitude", Pr.PowerWordFortitude, { last: 1800, party: { groupIds: G.PrayerOfFortitude } }),
        createBuffStep("DivineSpirit", Pr.DivineSpirit, { last: 1800, party: { groupIds: G.PrayerOfSpirit } }),
        createBuffStep("ShadowProtection", Pr.ShadowProtection, { last: 600, party: { groupIds: G.PrayerOfShadowProtection } }),
        createBuffStep("Shadowform", Pr.Shadowform, { last: 1800 }),
    ],
    SHAMAN: [
        createBuffStep("LightningShield", Sh.LightningShield, { anyBuff: shamanShields, last: 600 }),
        createBuffStep("WaterShield", Sh.WaterShield, { anyBuff: shamanShields, last: 600 }),
    ],
    MAGE: [
        createBuffStep("ArcaneIntellect", M.ArcaneIntellect, { last: 1800, party: { groupIds: G.ArcaneBrilliance, isManaOnly: true } }),
        createBuffStep("MageArmor", M.MageArmor, { anyBuff: mageArmors }),
        createBuffStep("IceArmor", M.IceArmor, { anyBuff: mageArmors }),
        createBuffStep("FrostArmor", M.FrostArmor, { anyBuff: mageArmors }),
        createBuffStep("AmplifyMagic", M.AmplifyMagic, { last: 600 }, false),
    ],
    WARLOCK: [
        createBuffStep("DemonArmor", L.DemonArmor, { anyBuff: lockSkins }),
        createBuffStep("DemonSkin", L.DemonSkin, { anyBuff: lockSkins }),
        createBuffStep("UnendingBreath", L.UnendingBreath, { isSwimmingOnly: true, last: 600 }),
    ],
};
