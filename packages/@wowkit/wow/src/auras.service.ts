// The helpful auras (buffs) on a unit, as the game shows them: the player's aura of a spell, asked directly, or the list
// of a unit's auras. The client hides auras in combat (secret values) or answers with nothing; the answers say so, and
// what to make of that is the addon's.
import { OnEvent } from "@wowkit/core";
import { attempt, tryCall } from "./utils/protected-call.utils";
import { getReadable } from "./utils/secret-value.utils";
import type { SpellsService } from "./spells.service";
import { NO_EXPIRY } from "./wow.constants";

export interface AuraRead {
    isFound: boolean;
    /** Seconds left; NO_EXPIRY for auras without an end. */
    remain: number;
    /** The client hid at least one aura, so "not found" proves nothing. */
    isUnreadable: boolean;
}

/** One aura of a unit: what the client lets addon code see of it. */
export interface AuraEntry {
    /** Undefined when the client hid it. */
    spellId: number | undefined;
    /** Undefined when the client hid it. */
    name: string | undefined;
    /** Seconds left; NO_EXPIRY for an aura without an end. */
    remain: number;
    /** The client hid the ID or the name. */
    isHidden: boolean;
    /** Who cast it: the player, someone else, or the client hides it. */
    caster: "player" | "other" | "hidden";
}

export interface AuraScan {
    auras: AuraEntry[];
    /** The client refused to list the auras, or hid at least one of them. */
    isUnreadable: boolean;
}

/** A scan is reused for this long. */
const SCAN_REUSE = 0.2;

export class AurasService {
    /** Scans per unit. */
    private readonly scans = new LuaMap<string, { at: number; scan: AuraScan }>();

    constructor(private readonly spells: SpellsService) {}

    @OnEvent("spells.invalidated")
    wipeAuraScans(): void {
        for (const [unit] of this.scans) this.scans.delete(unit);
    }

    /** Forgets the scan of one unit (its auras changed); every scan when `unit` is undefined. */
    wipeAuraScan(unit: string | undefined): void {
        if (unit === undefined) return this.wipeAuraScans();
        this.scans.delete(unit);
    }

    /**
     * The player's aura of this spell, asked from the client directly: by the ID the player knows, by the ID, then by
     * the spell's name. Undefined when the client does not say (it may still be there: see scanAuras).
     */
    readPlayerAura(spellId: number): AuraRead | undefined {
        const resolved = this.spells.resolve(spellId);
        const fromResolved = resolved !== undefined ? this.readPlayerAuraById(resolved) : undefined;
        const fromId = fromResolved ?? this.readPlayerAuraById(spellId);
        if (fromId) return fromId;
        const name = this.spells.getSpellName(resolved ?? spellId) ?? this.spells.getSpellName(spellId);
        if (name === undefined || name === "") return undefined;
        const named = attempt(C_UnitAuras.GetAuraDataBySpellName, "player", name, "HELPFUL");
        if (named === undefined || type(named) !== "table") return undefined;
        const entry = this.describeAura(named);
        return entry.isHidden ? undefined : { isFound: true, remain: entry.remain, isUnreadable: false };
    }

    /** Every helpful aura of a unit, as the client shows it (kept for a moment, so a tick reads the list once). */
    scanAuras(unit: UnitToken): AuraScan {
        const now = GetTime();
        const cached = this.scans.get(unit);
        if (cached && now - cached.at < SCAN_REUSE) return cached.scan;
        const scan: AuraScan = { auras: [], isUnreadable: false };
        for (let i = 1; i <= 40; i++) {
            const [didSucceed, aura] = tryCall(C_UnitAuras.GetAuraDataByIndex, unit, i, "HELPFUL");
            if (!didSucceed) {
                scan.isUnreadable = true;
                break;
            }
            if (aura === undefined) break;
            const entry = this.describeAura(aura);
            if (entry.isHidden) scan.isUnreadable = true;
            scan.auras.push(entry);
        }
        this.scans.set(unit, { at: now, scan });
        return scan;
    }

    private readPlayerAuraById(spellId: number): AuraRead | undefined {
        const aura = attempt(C_UnitAuras.GetPlayerAuraBySpellID, spellId);
        if (aura === undefined || type(aura) !== "table") return undefined;
        return { isFound: true, remain: this.getRemainingSeconds(aura), isUnreadable: false };
    }

    private getRemainingSeconds(aura: AuraData): number {
        const expiration = getReadable(aura.expirationTime);
        if (expiration !== undefined && expiration > 0) return math.max(expiration - GetTime(), 0);
        return NO_EXPIRY;
    }

    /** Who cast an aura: the player, someone else, or the client hides it. */
    private findAuraCaster(aura: AuraData): "player" | "other" | "hidden" {
        const source = getReadable(aura.sourceUnit);
        if (source === undefined) return "hidden";
        return attempt(UnitIsUnit, source, "player") === true ? "player" : "other";
    }

    /** What the client lets addon code see of one aura. */
    private describeAura(aura: AuraData): AuraEntry {
        const spellId = getReadable(aura.spellId);
        const name = getReadable(aura.name);
        let isHidden = (aura.spellId !== undefined && spellId === undefined) || (aura.name !== undefined && name === undefined);
        if (!isHidden && spellId === undefined && name === undefined) isHidden = true;
        return { spellId, name, remain: this.getRemainingSeconds(aura), isHidden, caster: this.findAuraCaster(aura) };
    }
}
