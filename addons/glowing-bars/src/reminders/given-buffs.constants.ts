// What some items and spells leave on the player under another name than their own: the buff of the sleeping bag is Well-Rested,
// and a campfire's Camp Benefits. Added by its ID, one of these would look for a buff of its own name and never find it.
import { Camp } from "@wowkit/wow-data";

/** Item -> the buff it gives; the spell it uses is read from the client. */
export const BUFF_GIVEN_BY_ITEM: [itemId: number, buffId: number][] = [
    [Camp.CozySleepingBag, Camp.WellRested],
    [Camp.BasicCampfireKit, Camp.CampBenefits],
    [Camp.JourneymanCampfireKit, Camp.CampBenefits],
    [Camp.ExpertCampfireKit, Camp.CampBenefits],
];

/** Spell -> the buff it gives. */
export const BUFF_GIVEN_BY_SPELL: [spellId: number, buffId: number][] = [[Camp.BasicCampfire, Camp.CampBenefits]];
