// Spell info and spell resolution.
//
// Forever remaps many spell IDs, so a spell of the buff lists is resolved to the ID the player
// knows: by ID, by override, and finally by name through the spellbook index.
import { SPELL_NAME_HINT } from "../data/spells";
import { attempt, attemptMulti, isReadable, getReadable, tryCall } from "../util/safe";
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

export function getSpellInfo(spellId: number | undefined): SpellInfo | undefined {
    if (spellId === undefined) return undefined;
    return attempt(C_Spell.GetSpellInfo, spellId);
}

export function getSpellName(spellId: number | undefined): string | undefined {
    const info = getSpellInfo(spellId);
    return info ? getReadable(info.name) : undefined;
}

/** The ID the client gives a spell name; also for spells the player has not learned. */
function lookUpSpellId(name: string): number | undefined {
    if (isJunkSpellName(name)) return undefined;
    const info = attempt(C_Spell.GetSpellInfo, name);
    if (!info) return undefined;
    const id = getReadable(info.spellID);
    const got = getReadable(info.name);
    if (id !== undefined && (got === undefined || got === name) && !isJunkSpellName(got ?? name)) return id;
    return undefined;
}

/** Learned, or in the spellbook (with overrides). */
function isKnownToPlayer(id: number): boolean {
    return attempt(C_SpellBook.IsSpellKnown, id) === true || attempt(C_SpellBook.IsSpellInSpellBook, id) === true;
}

function findPlayerSpellByName(name: string): number | undefined {
    if (book.isReady()) return book.findSpellIdByName(name);
    // Before the index exists: the cheap name lookup, which also answers for spells not learned
    // yet, so ask whether it is known. Then warm the index in the background.
    const fromApi = lookUpSpellId(name);
    if (fromApi !== undefined && isKnownToPlayer(fromApi)) return fromApi;
    if (!book.isBuilding()) book.rebuild(false);
    return undefined;
}

/** Rebuilds the spellbook index (see SpellBookIndex.rebuild). */
export function rebuildSpellBook(isImmediate: boolean): void {
    book.rebuild(isImmediate);
}

/** The ID of a spell given by name (a cast name, a poison name). */
export function resolveFromName(name: string | undefined): number | undefined {
    if (name === undefined || name === "" || isJunkSpellName(name)) return undefined;
    return findPlayerSpellByName(name) ?? lookUpSpellId(name);
}

/** The English spellbook name of a spell, for IDs the client does not name. */
export function getHintName(spellId: number | undefined): string | undefined {
    return spellId !== undefined ? SPELL_NAME_HINT[spellId] : undefined;
}

export function getSpellLabel(spellId: number): string | undefined {
    return getSpellName(spellId) ?? getHintName(spellId);
}

/** spell ID -> the ID the player knows, or false when not known (cached until invalidated). */
const resolveCache = new LuaMap<number, number | false>();

/**
 * Forgets cached lookups. `full` also drops the spellbook index; otherwise only failed lookups
 * are forgotten, so a newly learned rank resolves.
 */
export function invalidateSpells(shouldDropSpellBook: boolean): void {
    for (const [id, resolved] of resolveCache) {
        if (shouldDropSpellBook || resolved === false) resolveCache.delete(id);
    }
    if (shouldDropSpellBook) book.invalidate();
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
    const [didSucceed, override] = tryCall(C_Spell.GetOverrideSpell, spellId);
    if (didSucceed && isReadable(override) && type(override) === "number") id = override!;
    if (isKnownToPlayer(id)) return id;
    if (id !== spellId && isKnownToPlayer(spellId)) return spellId;

    const names: string[] = [];
    for (const name of [getSpellName(id) ?? getSpellName(spellId), getHintName(spellId), getHintName(id)]) {
        if (name !== undefined && name !== "" && !names.includes(name)) names.push(name);
    }
    for (const name of names) {
        const fromName = lookUpSpellId(name);
        if (fromName !== undefined && isKnownToPlayer(fromName)) return fromName;
        const bookId = findPlayerSpellByName(name);
        if (bookId !== undefined) return bookId;
    }
    return undefined;
}

export function isLearned(spellId: number | undefined): boolean {
    return resolve(spellId) !== undefined;
}

/**
 * Can the spell be cast right now (power, form, ...)? Undefined when the client gives no readable
 * answer. Battle Shout with 0 rage: false.
 */
export function isCastable(spellId: number): boolean | undefined {
    const [didSucceed, usable] = attemptMulti(() => C_Spell.IsSpellUsable(spellId));
    if (!didSucceed || !isReadable(usable)) return undefined;
    return usable === true;
}

/** The rank number from the spell's subtext ("Rank 2"); undefined without a rank or text. */
export function getSpellRank(spellId: number): number | undefined {
    const text = getReadable(attempt(C_Spell.GetSpellSubtext, spellId));
    if (text === undefined) return undefined;
    const [digits] = string.match(text, "(%d+)");
    return digits !== undefined ? tonumber(digits) : undefined;
}

/** A spell was just learned (LEARNED_SPELL_IN_SKILL_LINE): add it to the ranks of its name. */
export function noteLearnedSpell(spellId: number | undefined): void {
    const id = getReadable(spellId);
    const name = getSpellName(id);
    if (id !== undefined && name !== undefined && name !== "") book.noteLearned(id, name);
}

/** The highest learned rank of a spell (by name, from the spellbook index). */
export function getHighestRank(spellId: number): number | undefined {
    const name = getSpellName(spellId);
    if (name === undefined || name === "") return undefined;
    let best: number | undefined;
    for (const id of book.getRanksByName(name)) {
        const rank = getSpellRank(id);
        if (rank !== undefined && (best === undefined || rank > best)) best = rank;
    }
    return best;
}
