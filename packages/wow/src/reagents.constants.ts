// Reagents of the group buffs (classic item IDs; the English name is a fallback for the tooltip
// check when the client has not loaded the item yet).
import { Group } from "./spell-ids.constants";
import type { Reagent } from "./reagent.interface";

export const REAGENTS: Reagent[] = [
    { itemId: 17028, name: "Holy Candle", classToken: "PRIEST", spells: [Group.PrayerOfFortitude[0]!] },
    {
        itemId: 17029,
        name: "Sacred Candle",
        classToken: "PRIEST",
        spells: [Group.PrayerOfFortitude[1]!, ...Group.PrayerOfSpirit, ...Group.PrayerOfShadowProtection],
    },
    { itemId: 17021, name: "Wild Berries", classToken: "DRUID", spells: [Group.GiftOfTheWild[0]!] },
    { itemId: 17026, name: "Wild Thornroot", classToken: "DRUID", spells: [Group.GiftOfTheWild[1]!] },
    { itemId: 17020, name: "Arcane Powder", classToken: "MAGE", spells: [...Group.ArcaneBrilliance] },
    {
        itemId: 21177,
        name: "Symbol of Kings",
        classToken: "PALADIN",
        spells: [...Group.GreaterBlessingMight, ...Group.GreaterBlessingKings, ...Group.GreaterBlessingWisdom],
    },
];

/** You are warned when you have this many or fewer. */
export const REAGENT_LOW = 5;
