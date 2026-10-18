// Groups of spells the lists share: one of them at a time (one seal, one sting, one curse), and the creature types some
// spells do not work on.
import { Hunter as H, Paladin as P, Warlock as L } from "@wowkit/wow-data";
import type { CreatureList } from "../step.interface";

export const PALADIN_SEALS = [
    P.SealOfCommand,
    P.SealOfFury,
    P.SealOfRighteousness,
    P.SealOfTheCrusader,
    P.SealOfLight,
    P.SealOfWisdom,
    P.SealOfJustice,
];
export const HUNTER_STINGS = [H.SerpentSting, H.ViperSting, H.ScorpidSting];
export const WARLOCK_CURSES = [L.CurseOfAgony, L.CurseOfTheElements, L.CurseOfShadow, L.BaneOfHavoc];
/** Bleeds and armor debuffs do not work on these. */
export const BLEED_IMMUNE: CreatureList = ["mechanical", "elemental", "undead"];
export const UNDEAD_AND_DEMONS: CreatureList = ["undead", "demon"];
