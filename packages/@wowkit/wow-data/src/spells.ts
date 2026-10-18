// Spell IDs of the 1.60.1 client, by class, written by hand while developing. A number is one spell; a list is the ranks
// of one spell, lowest first. Spells are also found by name in the spellbook, so remapped IDs and other ranks still match.
//
// To use a new spell: add it here, then use it through the package `@wowkit/wow-data`. The WowkitCheck addon (/wowkit check) asks the
// game about every ID of this file, so a wrong one shows up; `pnpm check` compares the file with its answers.
// Keep the file free of imports, so scripts can load it as it is.

export const Druid = {
    MarkOfTheWild: 1126,
    Thorns: 467,
    Moonkin: 24858,
    // The shapeshift forms
    BearForm: 5487,
    DireBearForm: 9634,
    CatForm: 768,
    TravelForm: 783,
    AquaticForm: 1066,
    // The group version of Mark of the Wild (one cast for the party, needs a reagent)
    GiftOfTheWild: [21849, 21850],
};
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
    RighteousFury: 25780,
    // The group versions of the blessings (one cast for a class of the party, needs a reagent)
    GreaterBlessingMight: [25782],
    GreaterBlessingKings: [25898],
    GreaterBlessingWisdom: [25894],
};
export const Warrior = {
    BattleShout: 6673,
};
export const Hunter = {
    AspectHawk: 13165,
    AspectMonkey: 13163,
    AspectWild: 20043,
    AspectCheetah: 5118,
    AspectPack: 13159,
    AspectBeast: 13161,
    TrueshotAura: 19506,
};
export const Priest = {
    InnerFire: 588,
    PowerWordFortitude: 1243,
    DivineSpirit: 14752,
    ShadowProtection: 976,
    Shadowform: 15473,
    // The group versions of the buffs (one cast for the party, needs a reagent)
    PrayerOfFortitude: [21562, 21564],
    PrayerOfSpirit: [27681],
    PrayerOfShadowProtection: [27683],
};
export const Rogue = {
    InstantPoison: 8679,
    DeadlyPoison: 2823,
    CripplingPoison: 3408,
    WoundPoison: 13219,
    MindNumbingPoison: 5761,
};
export const Shaman = {
    LightningShield: 324,
    WaterShield: 408510,
    // The imbues, every rank (the last ones are Forever's own)
    Windfury: [8232, 8235, 10486, 16362, 439431, 461636],
    Flametongue: [8024, 8027, 8030, 16339, 16341, 16342, 461634],
    Rockbiter: [8017, 8018, 8019, 10399, 16314, 16315, 16316, 461635],
    Frostbrand: [8033, 8038, 10456, 16355, 16356, 461633],
};
export const Mage = {
    ArcaneIntellect: 1459,
    MageArmor: 6117,
    IceArmor: 7302,
    FrostArmor: 168,
    AmplifyMagic: 1008,
    ArcaneBrilliance: [23028],
};
export const Warlock = {
    DemonArmor: 706,
    DemonSkin: 687,
    UnendingBreath: 5697,
    Firestone: 6366,
    Spellstone: 2362,
};

/** The buffs of eating and drinking: every food gives the buff "Food", every drink "Drink". */
export const Consumable = {
    Food: 433,
    Drink: 430,
};

/** The English spellbook names of IDs the client may not name: a facade falls back on them. */
export const SPELL_NAME_HINT: { [spellId: number]: string | undefined } = {
    [Shaman.WaterShield]: "Water Shield",
    [Priest.PrayerOfFortitude[0]!]: "Prayer of Fortitude",
    [Priest.PrayerOfFortitude[1]!]: "Prayer of Fortitude",
    [Priest.PrayerOfSpirit[0]!]: "Prayer of Spirit",
    [Priest.PrayerOfShadowProtection[0]!]: "Prayer of Shadow Protection",
    [Druid.GiftOfTheWild[0]!]: "Gift of the Wild",
    [Druid.GiftOfTheWild[1]!]: "Gift of the Wild",
    [Mage.ArcaneBrilliance[0]!]: "Arcane Brilliance",
    [Paladin.GreaterBlessingMight[0]!]: "Greater Blessing of Might",
    [Paladin.GreaterBlessingKings[0]!]: "Greater Blessing of Kings",
    [Paladin.GreaterBlessingWisdom[0]!]: "Greater Blessing of Wisdom",
};

/** Every table above, by name: what the check goes through. A new table is added here too. */
export const SPELLS = {
    Consumable,
    Druid,
    Hunter,
    Mage,
    Paladin,
    Priest,
    Rogue,
    Shaman,
    Warlock,
    Warrior,
};
