// Item IDs of the 1.60.1 client, written by hand while developing; see spells.ts for how they are used and checked.
// Keep the file free of imports, so scripts can load it as it is.

/** The reagents of the group buffs. */
export const Reagents = {
    HolyCandle: 17028,
    SacredCandle: 17029,
    WildBerries: 17021,
    WildThornroot: 17026,
    ArcanePowder: 17020,
    SymbolOfKings: 21177,
};

/** Items whose use is a spell with a cooldown of its own, read off the item: the Hearthstone. */
export const UseItems = {
    Hearthstone: 6948,
};

/** The item each such spell is the use of (the spell 8690 is the Hearthstone's). */
export const USE_SPELL_ITEMS: { [spellId: number]: number | undefined } = {
    8690: UseItems.Hearthstone,
};

/** Every table above, by name: what the check goes through. A new table is added here too. */
export const ITEMS = {
    Reagents,
    UseItems,
};
