// The shaman's totems by the slot they stand in: 1 fire, 2 earth, 3 water, 4 air. The game tells which totems the player
// knows for each slot (GetMultiCastTotemSpells), so a new totem needs nothing here; this list is for when it does not.
import { Shaman as Sh } from "@wowkit/wow-data";
import type { TextKey } from "../locale/texts.constants";

export const TOTEM_SLOTS = [1, 2, 3, 4];

/** The words of a slot: its element, the heading of its totems in the table. */
export const TOTEM_SLOT_TEXTS: { [slot: number]: TextKey } = {
    1: "ELEMENT_FIRE",
    2: "ELEMENT_EARTH",
    3: "ELEMENT_WATER",
    4: "ELEMENT_AIR",
};

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

/** The spells that drop totems without being one: a set of four at a cast. */
export const TOTEM_CALLS = [Sh.CallOfTheElements, Sh.CallOfTheAncestors, Sh.CallOfTheSpirits];
