import { Group, Shaman } from "./spell-ids.constants";

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
