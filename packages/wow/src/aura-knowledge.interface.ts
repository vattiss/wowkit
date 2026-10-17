// What the addon knows about buffs and the game does not say. The addon provides it (the aura services take it in their constructors).

/** Buffs of one category count for each other (Prayer of Fortitude for Fortitude). */
export interface AuraCategory {
    key: string;
    /** How long a seen or cast member counts as up while auras are hidden. */
    seconds: number;
}

export interface AuraKnowledge {
    /** The category a buff belongs to, found by its name. */
    findCategory(name: string | undefined): AuraCategory | undefined;
    /** How long a seen or cast buff lasts (seconds), for buffs outside the categories. */
    getSeconds(spellId: number | undefined, name: string): number;
}
