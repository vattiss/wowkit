// What the Cooldown Manager's entries and icons say, worked out one entry or icon at a time.
import { getReadable } from "./secret-value.utils";

/** One icon that is up settles it; one that is out says so only until another says up. */
export function noteState<Key extends AnyNotNil>(states: LuaMap<Key, boolean>, keys: Key[], isUp: boolean): void {
    for (const key of keys) if (isUp || !states.has(key)) states.set(key, isUp);
}

/** An entry's spell, its override, then the spells linked to it. */
export function listEntrySpells(info: CooldownViewerCooldown): number[] {
    // Pushed one by one, its own spell first: a nil in the middle of a Lua list would hide what comes after it
    const ids: number[] = [];
    if (info.spellID !== undefined) ids.push(info.spellID);
    if (info.overrideSpellID !== undefined) ids.push(info.overrideSpellID);
    ids.push(...(info.linkedSpellIDs ?? []));
    return ids;
}

/** What Blizzard takes an aura by, exactly: the entry's spells and its tooltip's spell, as far as the game shows them. */
export function listAuraIds(info: CooldownViewerCooldown, spells: number[]): number[] {
    const auraIds: number[] = [];
    for (const id of [...spells, info.overrideTooltipSpellID]) {
        const readable = getReadable(id);
        if (readable !== undefined && !auraIds.includes(readable)) auraIds.push(readable);
    }
    return auraIds;
}
