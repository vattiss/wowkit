// Reagents of the group buffs (classic item IDs; the English name is a fallback for the tooltip
// check when the client has not loaded the item yet).
import { Druid, Mage, Paladin, Priest, Reagents } from "@wowkit/wow-data";
import type { Reagent } from "./reagent.interface";

export const REAGENTS: Reagent[] = [
    { itemId: Reagents.HolyCandle, name: "Holy Candle", classToken: "PRIEST", spells: [Priest.PrayerOfFortitude[0]!] },
    {
        itemId: Reagents.SacredCandle,
        name: "Sacred Candle",
        classToken: "PRIEST",
        spells: [Priest.PrayerOfFortitude[1]!, ...Priest.PrayerOfSpirit, ...Priest.PrayerOfShadowProtection],
    },
    { itemId: Reagents.WildBerries, name: "Wild Berries", classToken: "DRUID", spells: [Druid.GiftOfTheWild[0]!] },
    { itemId: Reagents.WildThornroot, name: "Wild Thornroot", classToken: "DRUID", spells: [Druid.GiftOfTheWild[1]!] },
    { itemId: Reagents.ArcanePowder, name: "Arcane Powder", classToken: "MAGE", spells: [...Mage.ArcaneBrilliance] },
    {
        itemId: Reagents.SymbolOfKings,
        name: "Symbol of Kings",
        classToken: "PALADIN",
        spells: [...Paladin.GreaterBlessingMight, ...Paladin.GreaterBlessingKings, ...Paladin.GreaterBlessingWisdom],
    },
];
