// Spell IDs of the 1.60.1 client. Spells are also found by name in the spellbook, so remapped IDs
// and other ranks still match.

export const Druid = { MarkOfTheWild: 1126, Thorns: 467, Moonkin: 24858 };
export const Paladin = {
    DevotionAura: 465,
    RetributionAura: 7294,
    ConcentrationAura: 19746,
    SanctityAura: 20218,
    FireResistAura: 19891,
    FrostResistAura: 19888,
    ShadowResistAura: 19876,
    BlessingMight: 19740,
    BlessingKings: 20217,
    BlessingWisdom: 19742,
    BlessingSalvation: 1038,
    BlessingLight: 19977,
    BlessingSanctuary: 20911,
    RighteousFury: 25780,
};
export const Warrior = { BattleShout: 6673 };
export const Hunter = {
    AspectHawk: 13165,
    AspectMonkey: 13163,
    AspectWild: 20043,
    AspectCheetah: 5118,
    AspectPack: 13159,
    AspectBeast: 13161,
    TrueshotAura: 19506,
};
export const Priest = { InnerFire: 588, PowerWordFortitude: 1243, DivineSpirit: 14752, ShadowProtection: 976, Shadowform: 15473 };
export const Shaman = { LightningShield: 324, WaterShield: 408510 };
export const Mage = { ArcaneIntellect: 1459, MageArmor: 6117, IceArmor: 7302, FrostArmor: 168, AmplifyMagic: 1008 };
export const Warlock = { DemonArmor: 706, DemonSkin: 687, UnendingBreath: 5697 };

/** Group versions of the buffs (one cast for the party, needs a reagent); rank IDs, lowest first. */
export const Group = {
    PrayerOfFortitude: [21562, 21564],
    PrayerOfSpirit: [27681],
    PrayerOfShadowProtection: [27683],
    GiftOfTheWild: [21849, 21850],
    ArcaneBrilliance: [23028],
    GreaterBlessingMight: [25782],
    GreaterBlessingKings: [25898],
    GreaterBlessingWisdom: [25894],
};

/** Spellbook names (enUS) for IDs the client may not name. */
export const SPELL_NAME_HINT: { [spellId: number]: string | undefined } = {
    [Shaman.WaterShield]: "Water Shield",
    [Group.PrayerOfFortitude[0]!]: "Prayer of Fortitude",
    [Group.PrayerOfFortitude[1]!]: "Prayer of Fortitude",
    [Group.PrayerOfSpirit[0]!]: "Prayer of Spirit",
    [Group.PrayerOfShadowProtection[0]!]: "Prayer of Shadow Protection",
    [Group.GiftOfTheWild[0]!]: "Gift of the Wild",
    [Group.GiftOfTheWild[1]!]: "Gift of the Wild",
    [Group.ArcaneBrilliance[0]!]: "Arcane Brilliance",
    [Group.GreaterBlessingMight[0]!]: "Greater Blessing of Might",
    [Group.GreaterBlessingKings[0]!]: "Greater Blessing of Kings",
    [Group.GreaterBlessingWisdom[0]!]: "Greater Blessing of Wisdom",
};
