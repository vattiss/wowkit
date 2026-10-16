// Buffs on the player: reading them (by ID, by name, by a full scan), with AuraMemory filling in
// while the client hides them.
import { NO_EXPIRY } from "../constants";
import { findFamilyOf } from "../data/aura-families";
import type { WeaponBuff } from "../data/weapon-buffs";
import { attempt, getReadable, tryCall } from "../util/safe";
import { buildAuraKey } from "../util/text";
import { AuraMemory, type DurationLookup } from "./aura-memory";
import { resolve, getSpellName, spellsInvalidated } from "./spells";
import { isInCombat } from "./unit";

export interface AuraRead {
    isFound: boolean;
    /** Seconds left; NO_EXPIRY for auras without an end. */
    remain: number;
    /** The client hid at least one aura, so "not found" proves nothing. */
    isUnreadable: boolean;
    /** The buff families seen in the scan (family key -> aura). */
    families?: LuaMap<string, AuraData>;
}

interface AuraScan {
    at: number;
    names: LuaMap<string, AuraData>;
    ids: LuaMap<number, AuraData>;
    families: LuaMap<string, AuraData>;
    isUnreadable: boolean;
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

function getRemainingSeconds(aura: AuraData): number {
    const expiration = getReadable(aura.expirationTime);
    if (expiration !== undefined && expiration > 0) return math.max(expiration - GetTime(), 0);
    return NO_EXPIRY;
}

/** The aura's readable ID and name, and whether the client hid them. */
function identify(aura: AuraData): LuaMultiReturn<[id: number | undefined, name: string | undefined, hidden: boolean]> {
    const id = getReadable(aura.spellId);
    const name = getReadable(aura.name);
    let isHidden = (aura.spellId !== undefined && id === undefined) || (aura.name !== undefined && name === undefined);
    if (!isHidden && id === undefined && name === undefined) isHidden = true;
    return $multi(id, name, isHidden);
}

function scanAuras(unit: UnitToken, filter: string): AuraScan {
    const now = GetTime();
    const cacheKey = `${unit}\0${filter}`;
    const cached = scans.get(cacheKey);
    if (cached && now - cached.at < SCAN_REUSE) return cached;
    const result: AuraScan = { at: now, names: new LuaMap(), ids: new LuaMap(), families: new LuaMap(), isUnreadable: false };
    scans.set(cacheKey, result);
    for (let i = 1; i <= 40; i++) {
        const [didSucceed, aura] = tryCall(C_UnitAuras.GetAuraDataByIndex, unit, i, filter);
        if (!didSucceed) {
            result.isUnreadable = true;
            break;
        }
        if (aura === undefined) {
            // No auras at all while we remember some, in combat or with a target: the client
            // hides them rather than the player having none
            if (i === 1 && !memory.isEmpty() && (isInCombat() || attempt(UnitExists, "target") === true)) result.isUnreadable = true;
            break;
        }
        const [id, name, isHidden] = identify(aura);
        if (isHidden) {
            result.isUnreadable = true;
        } else {
            if (id !== undefined) result.ids.set(id, aura);
            if (name !== undefined) {
                result.names.set(buildAuraKey(name), aura);
                const family = findFamilyOf(name);
                if (family) result.families.set(family.key, aura);
            }
        }
    }
    return result;
}

/** Raw read of a buff on the player, without the memory. */
export function findAura(spellId: number | undefined): AuraRead {
    if (spellId === undefined) return { isFound: false, remain: 0, isUnreadable: false };
    const resolved = resolve(spellId);
    const wantName = getSpellName(resolved ?? spellId) ?? getSpellName(spellId);

    for (const id of [resolved, spellId]) {
        if (id !== undefined) {
            const aura = attempt(C_UnitAuras.GetPlayerAuraBySpellID, id);
            if (aura !== undefined && type(aura) === "table") return { isFound: true, remain: getRemainingSeconds(aura), isUnreadable: false };
        }
    }
    if (wantName !== undefined && wantName !== "") {
        const named = attempt(C_UnitAuras.GetAuraDataBySpellName, "player", wantName, "HELPFUL");
        if (named !== undefined && type(named) === "table") {
            const [, , isHidden] = identify(named);
            if (!isHidden) return { isFound: true, remain: getRemainingSeconds(named), isUnreadable: false };
        }
    }

    const result = scanAuras("player", "HELPFUL");
    const wantFamily = findFamilyOf(wantName);
    const aura =
        (wantName !== undefined ? result.names.get(buildAuraKey(wantName)) : undefined) ??
        (resolved !== undefined ? result.ids.get(resolved) : undefined) ??
        result.ids.get(spellId) ??
        (wantFamily ? result.families.get(wantFamily.key) : undefined);
    if (aura) return { isFound: true, remain: getRemainingSeconds(aura), isUnreadable: false, families: result.families };
    return { isFound: false, remain: 0, isUnreadable: result.isUnreadable, families: result.families };
}

/** Is the buff on the player, counting the remembered state while the client hides auras? */
export function hasAura(spellId: number): boolean {
    const read = findAura(spellId);
    if (read.isFound) {
        memory.remember(spellId, undefined, read.remain, false);
        return true;
    }
    if (read.isUnreadable) return memory.isRemembered(spellId);
    // In combat the client may simply return no auras: a buff we saw or cast is trusted until it
    // runs out. "Not found" only counts out of combat.
    if (memory.isRemembered(spellId) && isInCombat()) return true;
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
export function getUnitBuffState(unit: UnitToken, spellId: number, isOwnOnly: boolean): UnitBuffState {
    const wantName = getSpellName(resolve(spellId) ?? spellId) ?? getSpellName(spellId);
    if (wantName === undefined) return "unknown";
    const wantKey = buildAuraKey(wantName);
    const wantFamily = findFamilyOf(wantName);
    let isUnreadable = false;
    for (let i = 1; i <= 40; i++) {
        const [didSucceed, aura] = tryCall(C_UnitAuras.GetAuraDataByIndex, unit, i, "HELPFUL");
        if (!didSucceed) return "unknown";
        if (aura === undefined) break;
        const [, name, isHidden] = identify(aura);
        if (isHidden || name === undefined) {
            isUnreadable = true;
        } else if (buildAuraKey(name) === wantKey || (wantFamily !== undefined && findFamilyOf(name) === wantFamily)) {
            if (!isOwnOnly) return "has";
            const source = getReadable(aura.sourceUnit);
            if (source === undefined) isUnreadable = true;
            else if (attempt(UnitIsUnit, source, "player") === true) return "has";
        }
    }
    return isUnreadable ? "unknown" : "missing";
}

/** A weapon buff kept as an aura on the player (some clients show imbues that way). */
export function findWeaponBuffAura(entry: WeaponBuff): AuraRead {
    for (const id of [entry.id, ...(entry.ranks ?? [])]) {
        const read = findAura(id);
        if (read.isFound) return read;
    }
    return { isFound: false, remain: 0, isUnreadable: false };
}

/** A shapeshift happened. */
export function noteFormChange(): void {
    memory.forgetForms();
    wipeAuraScans();
}
