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
     * How long the buff lasts (seconds), so it still counts as on you in combat, when the client
     * hides the auras.
     */
    last?: number;
    /** Only asked for while swimming. */
    isSwimmingOnly?: boolean;
    /** Off by default: a buff only one role wants. */
    isOnByDefault: boolean;
    /** Also reminded for party members. */
    party?: PartyBuff;
}
