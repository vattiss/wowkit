// Spell info and spell resolution.
//
// Forever remaps many spell IDs, so a spell of the buff lists is resolved to the ID the player
// knows: by ID, by override, and finally by name through the spellbook index.
import { SPELL_NAME_HINT } from "../data/spells";
import { attempt, attemptMulti, readable, safe, tryCall } from "../util/safe";
import { createSignal } from "../util/signal";
import { isJunkSpellName, SpellBookIndex } from "./spellbook";

/** Spell lookups were invalidated (new spells learned, talents changed). */
export const spellsInvalidated = createSignal();
/** The spellbook index was rebuilt. */
export const spellBookIndexed = createSignal();

const book = new SpellBookIndex();
book.built.listen(() => {
    invalidateSpells(false);
    // One frame later, so the index build and the next tick never share a frame
    C_Timer.After(0, () => spellBookIndexed.emit());
});

export function spellInfo(spellId: number | undefined): SpellInfo | undefined {
    if (spellId === undefined) return undefined;
    return attempt(C_Spell.GetSpellInfo, spellId);
}

export function spellName(spellId: number | undefined): string | undefined {
    const info = spellInfo(spellId);
    return info ? safe(info.name) : undefined;
}

/** The ID the client gives a spell name; also for spells the player has not learned. */
function spellIdFromName(name: string): number | undefined {
    if (isJunkSpellName(name)) return undefined;
    const info = attempt(C_Spell.GetSpellInfo, name);
    if (!info) return undefined;
    const id = safe(info.spellID);
    const got = safe(info.name);
    if (id !== undefined && (got === undefined || got === name) && !isJunkSpellName(got ?? name)) return id;
    return undefined;
}

/** Learned, or in the spellbook (with overrides). */
function playerKnows(id: number): boolean {
    return attempt(C_SpellBook.IsSpellKnown, id) === true || attempt(C_SpellBook.IsSpellInSpellBook, id) === true;
}

function findPlayerSpellByName(name: string): number | undefined {
    if (book.isReady()) return book.idFor(name);
    // Before the index exists: the cheap name lookup, which also answers for spells not learned
    // yet, so ask whether it is known. Then warm the index in the background.
    const fromApi = spellIdFromName(name);
    if (fromApi !== undefined && playerKnows(fromApi)) return fromApi;
    if (!book.isBuilding()) book.rebuild(false);
    return undefined;
}

/** Rebuilds the spellbook index (see SpellBookIndex.rebuild). */
export function rebuildSpellBook(sync: boolean): void {
    book.rebuild(sync);
}

/** The ID of a spell given by name (a cast name, a poison name). */
export function resolveFromName(name: string | undefined): number | undefined {
    if (name === undefined || name === "" || isJunkSpellName(name)) return undefined;
    return findPlayerSpellByName(name) ?? spellIdFromName(name);
}

/** The English spellbook name of a spell, for IDs the client does not name. */
export function hintName(spellId: number | undefined): string | undefined {
    return spellId !== undefined ? SPELL_NAME_HINT[spellId] : undefined;
}

export function spellLabel(spellId: number): string | undefined {
    return spellName(spellId) ?? hintName(spellId);
}

/** spell ID -> the ID the player knows, or false when not known (cached until invalidated). */
const resolveCache = new LuaMap<number, number | false>();

/**
 * Forgets cached lookups. `full` also drops the spellbook index; otherwise only failed lookups
 * are forgotten, so a newly learned rank resolves.
 */
export function invalidateSpells(full: boolean): void {
    for (const [id, resolved] of resolveCache) {
        if (full || resolved === false) resolveCache.delete(id);
    }
    if (full) book.invalidate();
    spellsInvalidated.emit();
}

/** The spell ID the player knows for this spell (by ID, override, name and spellbook). */
export function resolve(spellId: number | undefined): number | undefined {
    if (spellId === undefined) return undefined;
    const cached = resolveCache.get(spellId);
    if (cached !== undefined) return cached === false ? undefined : cached;
    const id = findKnownId(spellId);
    resolveCache.set(spellId, id ?? false);
    return id;
}

function findKnownId(spellId: number): number | undefined {
    let id = spellId;
    const [ok, override] = tryCall(C_Spell.GetOverrideSpell, spellId);
    if (ok && readable(override) && type(override) === "number") id = override!;
    if (playerKnows(id)) return id;
    if (id !== spellId && playerKnows(spellId)) return spellId;

    const names: string[] = [];
    for (const name of [spellName(id) ?? spellName(spellId), hintName(spellId), hintName(id)]) {
        if (name !== undefined && name !== "" && !names.includes(name)) names.push(name);
    }
    for (const name of names) {
        const fromName = spellIdFromName(name);
        if (fromName !== undefined && playerKnows(fromName)) return fromName;
        const bookId = findPlayerSpellByName(name);
        if (bookId !== undefined) return bookId;
    }
    return undefined;
}

export function known(spellId: number | undefined): boolean {
    return resolve(spellId) !== undefined;
}

/**
 * Can the spell be cast right now (power, form, ...)? Undefined when the client gives no readable
 * answer. Battle Shout with 0 rage: false.
 */
export function spellUsable(spellId: number): boolean | undefined {
    const [ok, usable] = attemptMulti(() => C_Spell.IsSpellUsable(spellId));
    if (!ok || !readable(usable)) return undefined;
    return usable === true;
}

/** The rank number from the spell's subtext ("Rank 2"); undefined without a rank or text. */
export function spellRank(spellId: number): number | undefined {
    const text = safe(attempt(C_Spell.GetSpellSubtext, spellId));
    if (text === undefined) return undefined;
    const [digits] = string.match(text, "(%d+)");
    return digits !== undefined ? tonumber(digits) : undefined;
}

/** A spell was just learned (LEARNED_SPELL_IN_SKILL_LINE): add it to the ranks of its name. */
export function noteLearnedSpell(spellId: number | undefined): void {
    const id = safe(spellId);
    const name = spellName(id);
    if (id !== undefined && name !== undefined && name !== "") book.noteLearned(id, name);
}

/** The highest learned rank of a spell (by name, from the spellbook index). */
export function highestKnownRank(spellId: number): number | undefined {
    const name = spellName(spellId);
    if (name === undefined || name === "") return undefined;
    let best: number | undefined;
    for (const id of book.ranksFor(name)) {
        const rank = spellRank(id);
        if (rank !== undefined && (best === undefined || rank > best)) best = rank;
    }
    return best;
}
