// The default lists of every class, by class token. The ConROC Classic core for levels 1-60, tuned for Forever.
import { MAGE_LISTS, WARLOCK_LISTS } from "./caster.lists";
import { DRUID_LISTS } from "./druid.lists";
import { HUNTER_LISTS } from "./hunter.lists";
import type { ClassLists } from "./list.interface";
import { PALADIN_LISTS } from "./paladin.lists";
import { PRIEST_LISTS } from "./priest.lists";
import { ROGUE_LISTS } from "./rogue.lists";
import { SHAMAN_LISTS } from "./shaman.lists";
import { WARRIOR_LISTS } from "./warrior.lists";

export const CLASS_LISTS: { [classToken: string]: ClassLists | undefined } = {
    DRUID: DRUID_LISTS,
    HUNTER: HUNTER_LISTS,
    MAGE: MAGE_LISTS,
    PALADIN: PALADIN_LISTS,
    PRIEST: PRIEST_LISTS,
    ROGUE: ROGUE_LISTS,
    SHAMAN: SHAMAN_LISTS,
    WARLOCK: WARLOCK_LISTS,
    WARRIOR: WARRIOR_LISTS,
};
