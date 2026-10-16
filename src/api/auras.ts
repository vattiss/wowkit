// Buffs on the player: reading them (by ID, by name, by a full scan), with AuraMemory filling in
// while the client hides them.
import { NO_EXPIRY } from "../constants";
import { familyOf } from "../data/aura-families";
import type { WeaponBuff } from "../data/weapon-buffs";
import { attempt, safe, tryCall } from "../util/safe";
import { auraKey } from "../util/text";
import { AuraMemory, type DurationLookup } from "./aura-memory";
import { resolve, spellName, spellsInvalidated } from "./spells";
import { inCombat } from "./unit";

export interface AuraRead {
    found: boolean;
    /** Seconds left; NO_EXPIRY for auras without an end. */
    remain: number;
    /** The client hid at least one aura, so "not found" proves nothing. */
    unreadable: boolean;
    /** The buff families seen in the scan (family key -> aura). */
    families?: LuaMap<string, AuraData>;
}

interface AuraScan {
    at: number;
    names: LuaMap<string, AuraData>;
    ids: LuaMap<number, AuraData>;
    families: LuaMap<string, AuraData>;
    unreadable: boolean;
}

/** A scan is reused for this long. */
const SCAN_REUSE = 0.2;

const memory = new AuraMemory();
/** Scans per "unit\0filter". */
const scans = new LuaMap<string, AuraScan>();

/** How long buffs outside the known families last (the class buff lists know). */
export function setBuffDurationLookup(lookup: DurationLookup): void {
    memory.setDurationLookup(lookup);
}

export function wipeAuraScans(): void {
    for (const [key] of scans) scans.delete(key);
}

export function wipeAuraScan(unit: string | undefined): void {
    if (unit === undefined) return wipeAuraScans();
    const prefix = `${unit}\0`;
    for (const [key] of scans) {
        if (string.sub(key, 1, prefix.length) === prefix) scans.delete(key);
    }
}

spellsInvalidated.listen(wipeAuraScans);

function remainOf(aura: AuraData): number {
    const expiration = safe(aura.expirationTime);
    if (expiration !== undefined && expiration > 0) return math.max(expiration - GetTime(), 0);
    return NO_EXPIRY;
}

/** The aura's readable ID and name, and whether the client hid them. */
function identify(aura: AuraData): LuaMultiReturn<[id: number | undefined, name: string | undefined, hidden: boolean]> {
    const id = safe(aura.spellId);
    const name = safe(aura.name);
    let hidden = (aura.spellId !== undefined && id === undefined) || (aura.name !== undefined && name === undefined);
    if (!hidden && id === undefined && name === undefined) hidden = true;
    return $multi(id, name, hidden);
}

function scan(unit: UnitToken, filter: string): AuraScan {
    const now = GetTime();
    const cacheKey = `${unit}\0${filter}`;
    const cached = scans.get(cacheKey);
    if (cached && now - cached.at < SCAN_REUSE) return cached;
    const result: AuraScan = { at: now, names: new LuaMap(), ids: new LuaMap(), families: new LuaMap(), unreadable: false };
    scans.set(cacheKey, result);
    for (let i = 1; i <= 40; i++) {
        const [ok, aura] = tryCall(C_UnitAuras.GetAuraDataByIndex, unit, i, filter);
        if (!ok) {
            result.unreadable = true;
            break;
        }
        if (aura === undefined) {
            // No auras at all while we remember some, in combat or with a target: the client
            // hides them rather than the player having none
            if (i === 1 && !memory.isEmpty() && (inCombat() || attempt(UnitExists, "target") === true)) result.unreadable = true;
            break;
        }
        const [id, name, hidden] = identify(aura);
        if (hidden) {
            result.unreadable = true;
        } else {
            if (id !== undefined) result.ids.set(id, aura);
            if (name !== undefined) {
                result.names.set(auraKey(name), aura);
                const family = familyOf(name);
                if (family) result.families.set(family.key, aura);
            }
        }
    }
    return result;
}

/** Raw read of a buff on the player, without the memory. */
export function findAura(spellId: number | undefined): AuraRead {
    if (spellId === undefined) return { found: false, remain: 0, unreadable: false };
    const resolved = resolve(spellId);
    const wantName = spellName(resolved ?? spellId) ?? spellName(spellId);

    for (const id of [resolved, spellId]) {
        if (id !== undefined) {
            const aura = attempt(C_UnitAuras.GetPlayerAuraBySpellID, id);
            if (aura !== undefined && type(aura) === "table") return { found: true, remain: remainOf(aura), unreadable: false };
        }
    }
    if (wantName !== undefined && wantName !== "") {
        const named = attempt(C_UnitAuras.GetAuraDataBySpellName, "player", wantName, "HELPFUL");
        if (named !== undefined && type(named) === "table") {
            const [, , hidden] = identify(named);
            if (!hidden) return { found: true, remain: remainOf(named), unreadable: false };
        }
    }

    const result = scan("player", "HELPFUL");
    const wantFamily = familyOf(wantName);
    const aura =
        (wantName !== undefined ? result.names.get(auraKey(wantName)) : undefined) ??
        (resolved !== undefined ? result.ids.get(resolved) : undefined) ??
        result.ids.get(spellId) ??
        (wantFamily ? result.families.get(wantFamily.key) : undefined);
    if (aura) return { found: true, remain: remainOf(aura), unreadable: false, families: result.families };
    return { found: false, remain: 0, unreadable: result.unreadable, families: result.families };
}

/** Is the buff on the player, counting the remembered state while the client hides auras? */
export function hasAura(spellId: number): boolean {
    const read = findAura(spellId);
    if (read.found) {
        memory.remember(spellId, undefined, read.remain, false);
        return true;
    }
    if (read.unreadable) return memory.holds(spellId);
    // In combat the client may simply return no auras: a buff we saw or cast is trusted until it
    // runs out. "Not found" only counts out of combat.
    if (memory.holds(spellId) && inCombat()) return true;
    memory.release(spellId, read.families);
    return false;
}

/** The player cast a spell: if it is a buff on the player, it is up now. */
export function noteSelfBuff(spellId: number | undefined): void {
    if (spellId === undefined || issecretvalue(spellId)) return;
    memory.remember(spellId, undefined, undefined, true);
}

export type UnitBuffState = "has" | "missing" | "unknown";

/**
 * Does another unit (a party member) have the buff, or one of its family (Prayer of Fortitude
 * for Fortitude)? `ownOnly`: only an aura the player cast counts. "unknown" when the client hid
 * the auras: no memory here, so a hidden aura never counts as missing.
 */
export function unitBuffState(unit: UnitToken, spellId: number, ownOnly: boolean): UnitBuffState {
    const wantName = spellName(resolve(spellId) ?? spellId) ?? spellName(spellId);
    if (wantName === undefined) return "unknown";
    const wantKey = auraKey(wantName);
    const wantFamily = familyOf(wantName);
    let unreadable = false;
    for (let i = 1; i <= 40; i++) {
        const [ok, aura] = tryCall(C_UnitAuras.GetAuraDataByIndex, unit, i, "HELPFUL");
        if (!ok) return "unknown";
        if (aura === undefined) break;
        const [, name, hidden] = identify(aura);
        if (hidden || name === undefined) {
            unreadable = true;
        } else if (auraKey(name) === wantKey || (wantFamily !== undefined && familyOf(name) === wantFamily)) {
            if (!ownOnly) return "has";
            const source = safe(aura.sourceUnit);
            if (source === undefined) unreadable = true;
            else if (attempt(UnitIsUnit, source, "player") === true) return "has";
        }
    }
    return unreadable ? "unknown" : "missing";
}

/** A weapon buff kept as an aura on the player (some clients show imbues that way). */
export function findWeaponBuffAura(entry: WeaponBuff): AuraRead {
    for (const id of [entry.id, ...(entry.ranks ?? [])]) {
        const read = findAura(id);
        if (read.found) return read;
    }
    return { found: false, remain: 0, unreadable: false };
}

/** A shapeshift happened. */
export function formChanged(): void {
    memory.forgetForms();
    wipeAuraScans();
}
