// Buffs on the player: reading them (by ID, by name, by a full scan), with AuraMemoryService filling
// in while the client hides them.
import { OnEvent } from "@forever/framework";
import { buildAuraKey } from "@forever/framework";
import type { AuraKnowledge } from "./aura-knowledge.interface";
import type { AuraMemoryService } from "./aura-memory.service";
import type { PlayerService } from "./player.service";
import { attempt, getReadable, tryCall } from "./safe";
import type { SpellsService } from "./spells.service";
import { NO_EXPIRY } from "./wow.constants";

export interface AuraRead {
    isFound: boolean;
    /** Seconds left; NO_EXPIRY for auras without an end. */
    remain: number;
    /** The client hid at least one aura, so "not found" proves nothing. */
    isUnreadable: boolean;
    /** The buff categories seen in the scan (category key -> aura). */
    categories?: LuaMap<string, AuraData>;
}

export type UnitBuffState = "has" | "missing" | "unknown";

interface AuraScan {
    at: number;
    names: LuaMap<string, AuraData>;
    ids: LuaMap<number, AuraData>;
    categories: LuaMap<string, AuraData>;
    isUnreadable: boolean;
}

/** A scan is reused for this long. */
const SCAN_REUSE = 0.2;

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

/** Who cast an aura on another unit: the player, someone else, or the client hides it. */
function findAuraCaster(aura: AuraData): "player" | "other" | "hidden" {
    const source = getReadable(aura.sourceUnit);
    if (source === undefined) return "hidden";
    return attempt(UnitIsUnit, source, "player") === true ? "player" : "other";
}

export class AurasService {
    /** Scans per "unit\0filter". */
    private readonly scans = new LuaMap<string, AuraScan>();

    constructor(
        private readonly spells: SpellsService,
        private readonly player: PlayerService,
        private readonly memory: AuraMemoryService,
        private readonly knowledge: AuraKnowledge,
    ) {}

    @OnEvent("spells.invalidated")
    wipeAuraScans(): void {
        for (const [key] of this.scans) this.scans.delete(key);
    }

    wipeAuraScan(unit: string | undefined): void {
        if (unit === undefined) return this.wipeAuraScans();
        const prefix = `${unit}\0`;
        for (const [key] of this.scans) {
            if (string.sub(key, 1, prefix.length) === prefix) this.scans.delete(key);
        }
    }

    /** Raw read of a buff on the player, without the memory. */
    findAura(spellId: number | undefined): AuraRead {
        if (spellId === undefined) return { isFound: false, remain: 0, isUnreadable: false };
        const resolved = this.spells.resolve(spellId);
        const wantName = this.spells.getSpellName(resolved ?? spellId) ?? this.spells.getSpellName(spellId);
        return this.readAuraDirectly(spellId, resolved, wantName) ?? this.readAuraFromScan(spellId, resolved, wantName);
    }

    /** Is the buff on the player, counting the remembered state while the client hides auras? */
    hasAura(spellId: number): boolean {
        const read = this.findAura(spellId);
        if (read.isFound) {
            this.memory.remember(spellId, undefined, read.remain, false);
            return true;
        }
        if (read.isUnreadable) return this.memory.isRemembered(spellId);
        // In combat the client may simply return no auras: a buff we saw or cast is trusted until it
        // runs out. "Not found" only counts out of combat.
        if (this.memory.isRemembered(spellId) && this.player.isInCombat()) return true;
        this.memory.release(spellId, read.categories);
        return false;
    }

    /** The player cast a spell: if it is a buff on the player, it is up now. */
    noteSelfBuff(spellId: number | undefined): void {
        if (spellId === undefined || issecretvalue(spellId)) return;
        this.memory.remember(spellId, undefined, undefined, true);
    }

    /** A shapeshift happened. */
    noteFormChange(): void {
        this.memory.forgetForms();
        this.wipeAuraScans();
    }

    /**
     * Does another unit (a party member) have the buff, or another buff of its category (Prayer of
     * Fortitude for Fortitude)? `isOwnOnly`: only an aura the player cast counts. "unknown" when the client hid
     * the auras: no memory here, so a hidden aura never counts as missing.
     */
    getUnitBuffState(unit: UnitToken, spellId: number, isOwnOnly: boolean): UnitBuffState {
        const wantName = this.spells.getSpellName(this.spells.resolve(spellId) ?? spellId) ?? this.spells.getSpellName(spellId);
        if (wantName === undefined) return "unknown";
        const wantKey = buildAuraKey(wantName);
        const wantCategory = this.knowledge.findCategory(wantName);
        let isUnreadable = false;
        for (let i = 1; i <= 40; i++) {
            const [didSucceed, aura] = tryCall(C_UnitAuras.GetAuraDataByIndex, unit, i, "HELPFUL");
            if (!didSucceed) return "unknown";
            if (aura === undefined) break;
            const verdict = this.judgeUnitAura(aura, wantKey, wantCategory, isOwnOnly);
            if (verdict === "has") return "has";
            if (verdict === "hidden") isUnreadable = true;
        }
        return isUnreadable ? "unknown" : "missing";
    }

    /** What one aura of another unit says about the wanted buff: it is the buff, it hides what it is, or it is another one. */
    private judgeUnitAura(
        aura: AuraData,
        wantKey: string,
        wantCategory: object | undefined,
        isOwnOnly: boolean,
    ): "has" | "hidden" | "other" {
        const [, name, isHidden] = identify(aura);
        if (isHidden || name === undefined) return "hidden";
        const isWanted =
            buildAuraKey(name) === wantKey || (wantCategory !== undefined && this.knowledge.findCategory(name) === wantCategory);
        if (!isWanted) return "other";
        if (!isOwnOnly) return "has";
        const caster = findAuraCaster(aura);
        if (caster === "player") return "has";
        return caster === "hidden" ? "hidden" : "other";
    }

    /** Sorts one aura into the scan: by ID, by name and by buff category. */
    private addToScan(scan: AuraScan, aura: AuraData): void {
        const [id, name, isHidden] = identify(aura);
        if (isHidden) {
            scan.isUnreadable = true;
            return;
        }
        if (id !== undefined) scan.ids.set(id, aura);
        if (name === undefined) return;
        scan.names.set(buildAuraKey(name), aura);
        const category = this.knowledge.findCategory(name);
        if (category) scan.categories.set(category.key, aura);
    }

    /**
     * No auras at all while we remember some, in combat or with a target: the client hides them
     * rather than the player having none.
     */
    private isEmptyListSuspicious(): boolean {
        return !this.memory.isEmpty() && (this.player.isInCombat() || attempt(UnitExists, "target") === true);
    }

    private scanAuras(unit: UnitToken, filter: string): AuraScan {
        const now = GetTime();
        const cacheKey = `${unit}\0${filter}`;
        const cached = this.scans.get(cacheKey);
        if (cached && now - cached.at < SCAN_REUSE) return cached;
        const result: AuraScan = { at: now, names: new LuaMap(), ids: new LuaMap(), categories: new LuaMap(), isUnreadable: false };
        this.scans.set(cacheKey, result);
        for (let i = 1; i <= 40; i++) {
            const [didSucceed, aura] = tryCall(C_UnitAuras.GetAuraDataByIndex, unit, i, filter);
            if (!didSucceed) {
                result.isUnreadable = true;
                break;
            }
            if (aura === undefined) {
                if (i === 1 && this.isEmptyListSuspicious()) result.isUnreadable = true;
                break;
            }
            this.addToScan(result, aura);
        }
        return result;
    }

    /** Asks the client for the buff directly, by ID and then by name; undefined when it does not say. */
    private readAuraDirectly(spellId: number, resolved: number | undefined, wantName: string | undefined): AuraRead | undefined {
        for (const id of [resolved, spellId]) {
            if (id !== undefined) {
                const aura = attempt(C_UnitAuras.GetPlayerAuraBySpellID, id);
                if (aura !== undefined && type(aura) === "table")
                    return { isFound: true, remain: getRemainingSeconds(aura), isUnreadable: false };
            }
        }
        if (wantName === undefined || wantName === "") return undefined;
        const named = attempt(C_UnitAuras.GetAuraDataBySpellName, "player", wantName, "HELPFUL");
        if (named === undefined || type(named) !== "table") return undefined;
        const [, , isHidden] = identify(named);
        return isHidden ? undefined : { isFound: true, remain: getRemainingSeconds(named), isUnreadable: false };
    }

    /** Looks for the buff in a scan of all the auras: by name, by ID, then by its buff category. */
    private readAuraFromScan(spellId: number, resolved: number | undefined, wantName: string | undefined): AuraRead {
        const result = this.scanAuras("player", "HELPFUL");
        const wantCategory = this.knowledge.findCategory(wantName);
        const aura =
            (wantName !== undefined ? result.names.get(buildAuraKey(wantName)) : undefined) ??
            (resolved !== undefined ? result.ids.get(resolved) : undefined) ??
            result.ids.get(spellId) ??
            (wantCategory ? result.categories.get(wantCategory.key) : undefined);
        if (aura) return { isFound: true, remain: getRemainingSeconds(aura), isUnreadable: false, categories: result.categories };
        return { isFound: false, remain: 0, isUnreadable: result.isUnreadable, categories: result.categories };
    }
}
