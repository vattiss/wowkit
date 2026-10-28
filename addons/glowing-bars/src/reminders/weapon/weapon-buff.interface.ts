export interface WeaponBuff {
    key: string;
    id: number;
    /** The spellbook name, for buffs found by name (rogue poisons carry their name). */
    name?: string;
    /** Seconds the buff lasts. */
    duration: number;
    /** Spell IDs of every rank, lowest first. */
    ranks?: number[];
    /**
     * A buff put on with an item (rogue poisons), every rank lowest first: the item and the spell it casts when used.
     * The player has the buff when an item of it is on the bars; nothing of it is learned.
     */
    items?: { item: number; spell: number }[];
    enchants: number[];
    /** Lowercase text found in the weapon tooltip or the spell name while the buff is on. */
    match: string[];
}
