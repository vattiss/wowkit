import type { Step } from "../step.interface";

/** Lists by role (and, for the druid, by form: "cat", "bear"). */
export interface RoleLists {
    [role: string]: Step[] | undefined;
}

/**
 * The default lists of a class: the rotation (single target, also the automatic mode), its AoE variant, and the
 * defense (cooldowns for low health; the long buffs are Buff Reminder's).
 */
export interface ClassLists {
    rotation: RoleLists;
    aoe: RoleLists;
    defense: RoleLists;
}
