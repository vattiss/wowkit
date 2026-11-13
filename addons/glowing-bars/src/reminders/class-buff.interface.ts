/** A buff the player can also cast on party members. */
export interface PartyBuff {
    /** The group version (Prayer of Fortitude): rank IDs, lowest first. */
    groupIds?: number[];
    /** Only for members who use mana (Arcane Intellect). */
    isManaOnly?: boolean;
    /** The group version covers members of one class only (Greater Blessings). */
    isPerClass?: boolean;
    /** Only the player's own aura counts (blessings: another paladin's is a different choice). */
    isOwnOnly?: boolean;
}

export interface ClassBuff {
    key: string;
    id: number;
    /** Any buff of this category counts (one aspect, one paladin aura, one armor). */
    categoryMembers?: number[];
    /**
     * Each caster keeps one buff of the category on a target, and different casters' stack (a paladin's blessing, a paladin's
     * aura): another caster's counts only when it is the same buff.
     */
    isOnePerCaster?: boolean;
    /**
     * How long the buff lasts (seconds), so it still counts as on you in combat, when the client
     * hides the auras.
     */
    last?: number;
    /** The reminder comes this many seconds before the buff runs out (a short buff the player keeps up in a fight). */
    lead?: number;
    /** Only this race has it, in the game's own word for the race (Scourge is the Undead). */
    race?: string;
    /** Only asked for while swimming. */
    isSwimmingOnly?: boolean;
    /** Only asked for with a living pet: it cannot be cast without one (Soul Link, on the demon). */
    isPetOnly?: boolean;
    /** Off by default: a buff only one role wants. */
    isOnByDefault: boolean;
    /** Also reminded for party members. */
    party?: PartyBuff;
}
