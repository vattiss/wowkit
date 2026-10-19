export interface WeaponBuff {
    key: string;
    id: number;
    /** The spellbook name, for buffs found by name (rogue poisons carry their name). */
    name?: string;
    /** Seconds the buff lasts. */
    duration: number;
    /** Spell IDs of every rank, lowest first. */
    ranks?: number[];
    enchants: number[];
    /** Lowercase text found in the weapon tooltip or the spell name while the buff is on. */
    match: string[];
}
