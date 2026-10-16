// The buffs the addon reminds about, per class (UnitClass token).
import { Druid as D, Group as G, Hunter as H, Mage as M, Paladin as P, Priest as Pr, Shaman as Sh, Warlock as L, Warrior as W } from "./spells";

/** A buff the player can also cast on party members. */
export interface PartyBuff {
    /** The group version (Prayer of Fortitude): rank IDs, lowest first. */
    groupIds?: number[];
    /** Only for members who use mana (Arcane Intellect). */
    manaOnly?: boolean;
    /** The group version covers members of one class only (Greater Blessings). */
    perClass?: boolean;
    /** Only the player's own aura counts (blessings: another paladin's is a different choice). */
    ownOnly?: boolean;
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
    swimming?: boolean;
    /** Off by default: a buff only one role wants. */
    onByDefault: boolean;
    /** Also reminded for party members. */
    party?: PartyBuff;
}

function buff(key: string, id: number, options: Omit<BuffStep, "key" | "id" | "onByDefault"> = {}, onByDefault = true): BuffStep {
    return { key, id, onByDefault, ...options };
}

/** A blessing: the player's own counts, its Greater version covers one class. */
function blessing(groupIds: number[]): PartyBuff {
    return { groupIds, perClass: true, ownOnly: true };
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
    DRUID: [buff("MarkoftheWild", D.MarkOfTheWild, { last: 1800, party: { groupIds: G.GiftOfTheWild } }), buff("Thorns", D.Thorns, { last: 600 }), buff("Moonkin", D.Moonkin, {}, false)],
    PALADIN: [
        buff("DevotionAura", P.DevotionAura, { anyBuff: palaAuras }),
        buff("RetributionAura", P.RetributionAura, { anyBuff: palaAuras }),
        buff("ConcentrationAura", P.ConcentrationAura, { anyBuff: palaAuras }),
        buff("SanctityAura", P.SanctityAura, { anyBuff: palaAuras }),
        buff("FireResistAura", P.FireResistAura, { anyBuff: palaAuras }),
        buff("FrostResistAura", P.FrostResistAura, { anyBuff: palaAuras }),
        buff("ShadowResistAura", P.ShadowResistAura, { anyBuff: palaAuras }),
        buff("BlessingMight", P.BlessingMight, { anyBuff: palaBlessings, party: blessing(G.GreaterBlessingMight) }),
        buff("BlessingKings", P.BlessingKings, { anyBuff: palaBlessings, party: blessing(G.GreaterBlessingKings) }),
        buff("BlessingWisdom", P.BlessingWisdom, { anyBuff: palaBlessings, party: blessing(G.GreaterBlessingWisdom) }),
        buff("RighteousFury", P.RighteousFury, { last: 1800 }, false),
    ],
    WARRIOR: [buff("BattleShout", W.BattleShout, { last: 120 })],
    HUNTER: [
        buff("AspectHawk", H.AspectHawk, { anyBuff: hunterAspects }),
        buff("AspectMonkey", H.AspectMonkey, { anyBuff: hunterAspects }),
        buff("AspectWild", H.AspectWild, { anyBuff: hunterAspects }),
        buff("TrueshotAura", H.TrueshotAura, { last: 1800 }),
    ],
    ROGUE: [],
    PRIEST: [
        buff("InnerFire", Pr.InnerFire, { last: 600 }),
        buff("PowerWordFortitude", Pr.PowerWordFortitude, { last: 1800, party: { groupIds: G.PrayerOfFortitude } }),
        buff("DivineSpirit", Pr.DivineSpirit, { last: 1800, party: { groupIds: G.PrayerOfSpirit } }),
        buff("ShadowProtection", Pr.ShadowProtection, { last: 600, party: { groupIds: G.PrayerOfShadowProtection } }),
        buff("Shadowform", Pr.Shadowform, { last: 1800 }),
    ],
    SHAMAN: [
        buff("LightningShield", Sh.LightningShield, { anyBuff: shamanShields, last: 600 }),
        buff("WaterShield", Sh.WaterShield, { anyBuff: shamanShields, last: 600 }),
    ],
    MAGE: [
        buff("ArcaneIntellect", M.ArcaneIntellect, { last: 1800, party: { groupIds: G.ArcaneBrilliance, manaOnly: true } }),
        buff("MageArmor", M.MageArmor, { anyBuff: mageArmors }),
        buff("IceArmor", M.IceArmor, { anyBuff: mageArmors }),
        buff("FrostArmor", M.FrostArmor, { anyBuff: mageArmors }),
        buff("AmplifyMagic", M.AmplifyMagic, { last: 600 }, false),
    ],
    WARLOCK: [
        buff("DemonArmor", L.DemonArmor, { anyBuff: lockSkins }),
        buff("DemonSkin", L.DemonSkin, { anyBuff: lockSkins }),
        buff("UnendingBreath", L.UnendingBreath, { swimming: true, last: 600 }),
    ],
};
