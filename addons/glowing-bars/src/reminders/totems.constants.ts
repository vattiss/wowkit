// The shaman's totems by the slot they stand in: 1 fire, 2 earth, 3 water, 4 air. Each element has a row of its own in the
// table, so its look and its switch hold whichever totem of it the player drops. The game tells which totems the player
// knows for each slot (GetMultiCastTotemSpells), so a new totem needs nothing here; this list is for when it does not.
import type { Rgb } from "@wowkit/wow";
import { Shaman as Sh } from "@wowkit/wow-data";
import type { TextKey } from "../locale/texts.constants";

/** An element: its slot, its row in the table (an ID of its own, no spell's), its name, its colour and a totem to draw. */
export interface TotemElement {
    slot: number;
    rowId: number;
    text: TextKey;
    color: Rgb;
    iconSpell: number;
}

export const TOTEM_ELEMENTS: TotemElement[] = [
    { slot: 1, rowId: -9001, text: "ELEMENT_FIRE", color: [1, 0.35, 0.1], iconSpell: Sh.SearingTotem },
    { slot: 2, rowId: -9002, text: "ELEMENT_EARTH", color: [0.6, 0.42, 0.2], iconSpell: Sh.StrengthOfEarthTotem },
    { slot: 3, rowId: -9003, text: "ELEMENT_WATER", color: [0.1, 0.7, 0.65], iconSpell: Sh.HealingStreamTotem },
    { slot: 4, rowId: -9004, text: "ELEMENT_AIR", color: [0.85, 0.88, 0.92], iconSpell: Sh.WindfuryTotem },
];

/** Each totem's slot, when the game does not say. Not Fire Nova, a plain spell on Forever, nor Tranquil Air, gone there. */
export const TOTEM_SLOT_OF: [spellId: number, slot: number][] = [
    [Sh.SearingTotem, 1],
    [Sh.MagmaTotem, 1],
    [Sh.FlametongueTotem, 1],
    [Sh.FrostResistanceTotem, 1],
    [Sh.StrengthOfEarthTotem, 2],
    [Sh.StoneskinTotem, 2],
    [Sh.TremorTotem, 2],
    [Sh.EarthbindTotem, 2],
    [Sh.StoneclawTotem, 2],
    [Sh.HealingStreamTotem, 3],
    [Sh.ManaSpringTotem, 3],
    [Sh.FireResistanceTotem, 3],
    [Sh.PoisonCleansingTotem, 3],
    [Sh.DiseaseCleansingTotem, 3],
    [Sh.ManaTideTotem, 3],
    [Sh.WindfuryTotem, 4],
    [Sh.GraceOfAirTotem, 4],
    [Sh.GroundingTotem, 4],
    [Sh.NatureResistanceTotem, 4],
    [Sh.WindwallTotem, 4],
    [Sh.SentryTotem, 4],
];

/** The spells that drop the totems of the totem bar, one in each slot. */
export const TOTEM_CALLS = [Sh.CallOfTheElements, Sh.CallOfTheAncestors, Sh.CallOfTheSpirits];
