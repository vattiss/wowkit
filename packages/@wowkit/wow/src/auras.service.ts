// The auras on a unit, as the game shows them: the player's aura of a spell, asked directly, an aura by name, or the list
// of a unit's buffs (helpful) or debuffs (harmful). The client hides auras in combat (secret values) or answers with nothing; the answers say so, and
// what to make of that is the addon's.
import { OnEvent, OnGameEvent } from "@wowkit/core";
import { attempt, tryCall } from "./utils/protected-call.utils";
import { getReadable, isReadable } from "./utils/secret-value.utils";
import type { SpellsService } from "./spells.service";
import { NO_EXPIRY } from "./wow.constants";

export interface AuraRead {
    isFound: boolean;
    /** Seconds left; NO_EXPIRY for auras without an end. */
    remain: number;
    /** The client hid at least one aura, so "not found" proves nothing. */
    isUnreadable: boolean;
    /** Applications (stacks), at least 1 for a found aura. */
    stacks?: number;
    /** Who cast a found aura. */
    caster?: "player" | "other" | "hidden";
    /** A found aura's spell ID, when the client shows it: the rank it is of. */
    spellId?: number;
    /** How long a found aura lasts in all, when the client shows it (not for one without an end). */
    duration?: number;
}

/** Which auras: buffs, debuffs, or only the debuffs the player cast. */
export type AuraFilter = "HELPFUL" | "HARMFUL" | "HARMFUL|PLAYER";

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
    /** Applications (stacks), at least 1. */
    stacks: number;
    /** "Magic", "Curse", "Disease", "Poison"; undefined when it cannot be dispelled or the client hides it. */
    dispelType: string | undefined;
    /** A mage can steal it (a readable yes only). */
    isStealable: boolean;
    /** How long it lasts in all, when the client shows it (not for one without an end). */
    duration: number | undefined;
}

export interface AuraScan {
    auras: AuraEntry[];
    /** The client refused to list the auras, or hid at least one of them. */
    isUnreadable: boolean;
}

/** A scan is reused for this long. */
const SCAN_REUSE = 0.2;

export class AurasService {
    /** Scans per unit and filter. */
    private readonly scans = new LuaMap<string, { at: number; scan: AuraScan }>();

    constructor(private readonly spells: SpellsService) {}

    @OnEvent("spells.invalidated")
    wipeAuraScans(): void {
        for (const [key] of this.scans) this.scans.delete(key);
    }

    /** A fight starting or ending, or a zone: the client may start or stop hiding auras, so a scan of a moment ago is stale. */
    @OnGameEvent("PLAYER_REGEN_DISABLED", "PLAYER_REGEN_ENABLED", "PLAYER_ENTERING_WORLD", "ZONE_CHANGED_NEW_AREA")
    wipeScansForSecrecy(): void {
        this.wipeAuraScans();
    }

    /** Forgets the scans of one unit (its auras changed); every scan when `unit` is undefined. */
    wipeAuraScan(unit: string | undefined): void {
        if (unit === undefined) return this.wipeAuraScans();
        for (const filter of ["HELPFUL", "HARMFUL", "HARMFUL|PLAYER"]) this.scans.delete(`${unit}\u0000${filter}`);
    }

    /**
     * The player's aura of this spell, asked from the client directly: by the ID the player knows, by the ID, then by
     * the spell's name. Undefined when the client does not say (it may still be there: see scanAuras); not found and
     * unreadable when it refused to answer (it keeps the aura secret).
     */
    readPlayerAura(spellId: number): AuraRead | undefined {
        const resolved = this.spells.resolve(spellId);
        const fromResolved = resolved !== undefined ? this.readPlayerAuraById(resolved) : undefined;
        if (fromResolved) return fromResolved;
        const fromId = this.readPlayerAuraById(spellId);
        if (fromId) return fromId;
        const name = this.spells.getSpellName(resolved ?? spellId) ?? this.spells.getSpellName(spellId);
        const named = name !== undefined && name !== "" ? this.findAuraByName(name, "player", "HELPFUL") : undefined;
        if (named !== undefined) return named;
        return fromResolved === false || fromId === false ? { isFound: false, remain: 0, isUnreadable: true } : undefined;
    }

    /** A unit's aura by its exact name (a totem's effect: "Stoneskin"); undefined when the client does not show it. */
    findAuraByName(name: string, unit: UnitToken, filter: AuraFilter): AuraRead | undefined {
        const named = attempt(C_UnitAuras.GetAuraDataBySpellName, unit, name, filter);
        if (named === undefined || type(named) !== "table") return undefined;
        const entry = this.describeAura(named);
        return entry.isHidden
            ? undefined
            : {
                  isFound: true,
                  remain: entry.remain,
                  isUnreadable: false,
                  stacks: entry.stacks,
                  caster: entry.caster,
                  spellId: entry.spellId,
                  duration: entry.duration,
              };
    }

    /** Every aura of a unit of a kind, as the client shows it (kept for a moment, so a tick reads the list once). */
    scanAuras(unit: UnitToken, filter: AuraFilter = "HELPFUL"): AuraScan {
        const now = GetTime();
        const key = `${unit}\u0000${filter}`;
        const cached = this.scans.get(key);
        if (cached && now - cached.at < SCAN_REUSE) return cached.scan;
        const scan: AuraScan = { auras: [], isUnreadable: false };
        for (let i = 1; i <= 40; i++) {
            const [didSucceed, aura] = tryCall(C_UnitAuras.GetAuraDataByIndex, unit, i, filter);
            if (!didSucceed) {
                scan.isUnreadable = true;
                break;
            }
            if (aura === undefined) break;
            const entry = this.describeAura(aura);
            if (entry.isHidden) scan.isUnreadable = true;
            scan.auras.push(entry);
        }
        this.scans.set(key, { at: now, scan });
        return scan;
    }

    /** The player's aura by an ID; false when the client refused to answer. */
    private readPlayerAuraById(spellId: number): AuraRead | undefined | false {
        const [didSucceed, aura] = tryCall(C_UnitAuras.GetPlayerAuraBySpellID, spellId);
        if (!didSucceed) return false;
        if (aura === undefined || type(aura) !== "table") return undefined;
        return {
            isFound: true,
            remain: this.getRemainingSeconds(aura),
            isUnreadable: false,
            stacks: this.getStacks(aura),
            caster: this.findAuraCaster(aura),
            spellId,
            duration: this.getDuration(aura),
        };
    }

    private getStacks(aura: AuraData): number {
        const stacks = getReadable(aura.applications);
        return stacks !== undefined && type(stacks) === "number" && stacks > 0 ? stacks : 1;
    }

    /** How long an aura lasts in all; undefined when the client does not say (secret) or it has no end. */
    private getDuration(aura: AuraData): number | undefined {
        const duration = getReadable(aura.duration);
        return duration !== undefined && type(duration) === "number" && duration > 0 ? duration : undefined;
    }

    private getRemainingSeconds(aura: AuraData): number {
        const expiration = getReadable(aura.expirationTime);
        if (expiration !== undefined && expiration > 0) return math.max(expiration - GetTime(), 0);
        return NO_EXPIRY;
    }

    /** Who cast an aura: the player, someone else, or the client hides it. */
    private findAuraCaster(aura: AuraData): "player" | "other" | "hidden" {
        // None named: someone out of the group and not targeted (a passing druid's Mark of the Wild). The player's own always
        // name the player; in a fight the name is kept secret, which is not nil (comparing a secret with nil is allowed)
        if (aura.sourceUnit === undefined) return "other";
        const source = getReadable(aura.sourceUnit);
        if (source === undefined) return "hidden";
        if (source === "player") return "player";
        // In a dungeon the game may keep secret who the unit is (a totem's "focustarget"): that is hidden too, never compared
        const isPlayer = getReadable(attempt(UnitIsUnit, source, "player"));
        if (isPlayer === undefined) return "hidden";
        return isPlayer === true ? "player" : "other";
    }

    /** What the client lets addon code see of one aura. */
    private describeAura(aura: AuraData): AuraEntry {
        const spellId = getReadable(aura.spellId);
        const name = getReadable(aura.name);
        let isHidden = (aura.spellId !== undefined && spellId === undefined) || (aura.name !== undefined && name === undefined);
        if (!isHidden && spellId === undefined && name === undefined) isHidden = true;
        const dispelType = getReadable(aura.dispelName);
        return {
            spellId,
            name,
            remain: this.getRemainingSeconds(aura),
            isHidden,
            caster: this.findAuraCaster(aura),
            stacks: this.getStacks(aura),
            dispelType: type(dispelType) === "string" && dispelType !== "" ? dispelType : undefined,
            isStealable: isReadable(aura.isStealable) && aura.isStealable === true,
            duration: this.getDuration(aura),
        };
    }
}
