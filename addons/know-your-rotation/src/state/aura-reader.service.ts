// Is an aura on a unit? What the game shows, the look-ahead's assumptions, and the memory while the client hides
// auras. On the target only the player's own debuffs count, except the ones a target has once (Sunder Armor).
import {
    type AuraEntry,
    type AuraFilter,
    type AuraRead,
    type AuraScan,
    type AurasService,
    type PlayerService,
    type SpellsService,
    type UnitsService,
    buildNameKey,
} from "@wowkit/wow";
import type { NameKeysService } from "../knowledge/name-keys.service";
import { SHARED_DEBUFFS } from "../knowledge/spell-data.constants";
import type { AuraMemoryService } from "./aura-memory.service";
import type { TargetService } from "../situation/target.service";
import type { LookAheadService } from "./look-ahead.service";

/** An aura read: found, seconds left, whether the client hid auras, the stacks, and whether a seal was seen. */
export interface AuraFind {
    isFound: boolean;
    remain: number;
    isUnreadable: boolean;
    stacks: number;
    isSealSeen: boolean;
}

const NOT_FOUND: AuraFind = { isFound: false, remain: 0, isUnreadable: false, stacks: 0, isSealSeen: false };

export class AuraReaderService {
    constructor(
        private readonly auras: AurasService,
        private readonly spells: SpellsService,
        private readonly units: UnitsService,
        private readonly player: PlayerService,
        private readonly nameKeys: NameKeysService,
        private readonly memory: AuraMemoryService,
        private readonly lookAhead: LookAheadService,
        private readonly target: TargetService,
    ) {}

    /** What the game shows of the aura now: by ID for the player, by name, then in the list (by name, ID, seal family). */
    findAura(spellId: number, unit: UnitToken = "player", filter: "HELPFUL" | "HARMFUL" = "HELPFUL"): AuraFind {
        const resolved = this.spells.resolve(spellId);
        const wantName = this.spells.getSpellName(resolved ?? spellId) ?? this.spells.getSpellName(spellId);
        const readFilter = this.chooseFilter(spellId, unit, filter);
        const read = this.readDirectly(spellId, wantName, unit, readFilter);
        if (read) return { isFound: true, remain: read.remain, isUnreadable: false, stacks: read.stacks ?? 1, isSealSeen: false };
        return this.findInScan(this.auras.scanAuras(unit, readFilter), spellId, resolved, wantName);
    }

    /** The client asked for the aura itself: the player's by ID, then the unit's by name. */
    private readDirectly(spellId: number, wantName: string | undefined, unit: UnitToken, filter: AuraFilter): AuraRead | undefined {
        if (unit === "player" && filter === "HELPFUL") {
            const direct = this.auras.readPlayerAura(spellId);
            if (direct?.isFound === true) return direct;
        }
        if (wantName === undefined || wantName === "") return undefined;
        return this.auras.findAuraByName(wantName, unit, filter);
    }

    /** Is the aura on the unit, counting the look-ahead and the remembered state while the client hides auras? */
    hasAura(spellId: number, unit: UnitToken = "player", filter: "HELPFUL" | "HARMFUL" = "HELPFUL"): boolean {
        if (unit === "player" && filter === "HELPFUL") return this.hasSelfBuff(spellId);
        if (unit === "target" && filter === "HARMFUL") return this.hasTargetDebuff(spellId);
        return this.findAura(spellId, unit, filter).isFound;
    }

    private hasSelfBuff(spellId: number): boolean {
        if (this.lookAhead.isBuffUsedUp(spellId)) return false;
        if (this.lookAhead.isBuffPredicted(spellId)) return true;
        const read = this.findAura(spellId, "player", "HELPFUL");
        if (read.isFound) {
            this.memory.rememberBuff(spellId, undefined, read.remain, false);
            return true;
        }
        if (read.isUnreadable) return this.memory.isBuffHeld(spellId);
        // In combat the client may simply return no auras: a buff seen or cast is trusted until it runs out
        if (this.memory.isBuffHeld(spellId) && this.player.isInCombat()) return true;
        this.memory.releaseBuff(spellId, read.isSealSeen);
        return false;
    }

    private hasTargetDebuff(spellId: number): boolean {
        if (this.lookAhead.isDebuffPredicted(spellId)) return true;
        const read = this.findAura(spellId, "target", "HARMFUL");
        if (read.isFound) {
            this.memory.noteTargetDebuff(spellId, read.remain);
            return true;
        }
        return read.isUnreadable && this.memory.isDebuffHeld(spellId);
    }

    /** Is the form (or stance) active? The stance bar says so; the aura when the bar cannot tell. */
    isFormActive(spellId: number): boolean {
        const wantName = this.spells.getSpellName(spellId);
        for (const form of this.player.listShapeshiftForms()) {
            if (form.spellId === spellId || (wantName !== undefined && this.spells.getSpellName(form.spellId) === wantName)) {
                if (form.isActive !== undefined) return form.isActive;
                break;
            }
        }
        return this.hasAura(spellId, "player", "HELPFUL");
    }

    /** The player's aura by its exact name (a totem's effect): found, and seconds left (NO_EXPIRY without an end). */
    findAuraByName(name: string): LuaMultiReturn<[isFound: boolean, remain: number]> {
        const read = this.auras.findAuraByName(name, "player", "HELPFUL");
        if (read) return $multi(true, read.remain);
        return $multi(false, 0);
    }

    /** On a hostile target only the player's own debuffs count, unless the debuff is one a target has once. */
    private chooseFilter(spellId: number, unit: UnitToken, filter: "HELPFUL" | "HARMFUL"): AuraFilter {
        if (filter !== "HARMFUL" || unit !== "target") return filter;
        if (this.nameKeys.isOneOf(spellId, "shared debuffs", SHARED_DEBUFFS)) return filter;
        return this.target.isHostile() ? "HARMFUL|PLAYER" : filter;
    }

    private findInScan(scan: AuraScan, spellId: number, resolved: number | undefined, wantName: string | undefined): AuraFind {
        const wantKey = wantName !== undefined && wantName !== "" ? buildNameKey(wantName) : undefined;
        const readable = scan.auras.filter((aura) => !aura.isHidden);
        const hit = readable.find((aura) => this.isAuraOf(aura, spellId, resolved, wantKey));
        const seal = readable.find((aura) => this.memory.isSeal(aura.name));
        const isSealSeen = seal !== undefined;
        // An active seal, whatever its ID, counts for the seal asked for
        const found = hit ?? (this.memory.isSeal(wantName) ? seal : undefined);
        if (found) return { isFound: true, remain: found.remain, isUnreadable: false, stacks: found.stacks, isSealSeen };
        // No auras at all while buffs are remembered, in combat or with a target: the client hides them
        const isUnreadable =
            scan.isUnreadable ||
            readable.length < scan.auras.length ||
            (scan.auras.length === 0 && this.memory.hasAnyBuff() && this.isBusy());
        return { ...NOT_FOUND, isUnreadable, isSealSeen };
    }

    private isAuraOf(aura: AuraEntry, spellId: number, resolved: number | undefined, wantKey: string | undefined): boolean {
        if (aura.spellId !== undefined && (aura.spellId === resolved || aura.spellId === spellId)) return true;
        return wantKey !== undefined && aura.name !== undefined && buildNameKey(aura.name) === wantKey;
    }

    private isBusy(): boolean {
        return this.player.isInCombat() || this.units.doesExist("target");
    }
}
