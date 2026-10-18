// What the addon remembers of auras while the client hides them (combat): the player's buffs it saw or cast, and the
// debuffs the player put on the target. A remembered aura counts as up until it would run out.
//
// The seals are one family: an active seal (whatever its rank or ID) counts for every seal, because the client often
// hides the aura's ID as soon as a target is selected. The druid's forms have no end and change only with a shapeshift.
import { Druid } from "@wowkit/wow-data";
import { type ClockService, type SpellsService, type UnitsService, hasKnownExpiry, buildNameKey } from "@wowkit/wow";
import { PALADIN_SEALS } from "../knowledge/lists/list-groups.constants";
import type { NameKeysService } from "../knowledge/name-keys.service";
import type { HoldTrackerService } from "./hold-tracker.service";

const SEAL_SECONDS = 30;
const FORM_SECONDS = 1800;
/** A buff without a known length is remembered this long. */
const DEFAULT_SECONDS = 30;
/** A debuff without a known length is remembered this long. */
const DEFAULT_DEBUFF_SECONDS = 18;
/** A buff cast this recently is not forgotten by a read that misses it (the aura may not be there yet). */
const CAST_GRACE = 1;
const FORMS = [Druid.BearForm, Druid.DireBearForm, Druid.CatForm, Druid.TravelForm, Druid.AquaticForm, Druid.Moonkin];

export class AuraMemoryService {
    /** Buff name key -> when it runs out. */
    private readonly heldBuffs = new LuaMap<string, number>();
    private sealUntil = 0;
    /** Buff name key (or "seal") -> when the player cast it. */
    private readonly castAt = new LuaMap<string, number>();
    /** Debuff key (name key or "id:<id>") on the current target -> when it runs out. */
    private readonly heldDebuffs = new LuaMap<string, number>();
    private debuffTarget: string | undefined;

    constructor(
        private readonly spells: SpellsService,
        private readonly units: UnitsService,
        private readonly clock: ClockService,
        private readonly nameKeys: NameKeysService,
        private readonly holds: HoldTrackerService,
    ) {}

    isSeal(nameOrKey: string | undefined): boolean {
        return this.nameKeys.isNameOf(nameOrKey, "seals", PALADIN_SEALS);
    }

    hasAnyBuff(): boolean {
        return !this.heldBuffs.isEmpty() || this.sealUntil > this.clock.getCurrentTime();
    }

    /** A buff was seen (`remain` known; NO_EXPIRY for one without an end) or cast (`isFromCast`). */
    rememberBuff(spellId: number, auraName: string | undefined, remain: number | undefined, isFromCast: boolean): void {
        const name = auraName ?? this.spells.getSpellName(spellId);
        if (name === undefined || name === "") return;
        const key = buildNameKey(name);
        const isSeal = this.isSeal(name);
        const now = this.clock.getCurrentTime();
        const endsAt = this.findMemoryEnd(spellId, key, isSeal, remain, isFromCast);
        if (endsAt !== undefined) {
            this.heldBuffs.set(key, endsAt);
            if (isSeal) this.sealUntil = endsAt;
        }
        if (isFromCast) {
            this.castAt.set(key, now);
            if (isSeal) this.castAt.set("seal", now);
        }
    }

    /** Is the buff (or, for a seal, any seal) remembered as up? */
    isBuffHeld(spellId: number): boolean {
        const name = this.spells.getSpellName(spellId);
        if (name === undefined || name === "") return false;
        const now = this.clock.getCurrentTime();
        const endsAt = this.heldBuffs.get(buildNameKey(name));
        if (endsAt !== undefined && now < endsAt) return true;
        return this.isSeal(name) && now < this.sealUntil;
    }

    /** A readable read did not find the buff: forget it, unless it was cast a moment ago. `isSealSeen`: a seal is up. */
    releaseBuff(spellId: number, isSealSeen: boolean): void {
        const name = this.spells.getSpellName(spellId);
        if (name === undefined || name === "") return;
        const key = buildNameKey(name);
        const now = this.clock.getCurrentTime();
        if (now - (this.castAt.get(key) ?? -10) < CAST_GRACE) return;
        this.heldBuffs.delete(key);
        if (this.isSeal(name) && !isSealSeen && now - (this.castAt.get("seal") ?? -10) >= CAST_GRACE) this.sealUntil = 0;
    }

    /** A shapeshift happened: the remembered form is out of date (a form cast a moment ago is the new one: kept). */
    forgetForms(): void {
        const now = this.clock.getCurrentTime();
        for (const [key] of this.heldBuffs) {
            if (this.nameKeys.isNameOf(key, "forms", FORMS) && now - (this.castAt.get(key) ?? -10) >= 1.5) this.heldBuffs.delete(key);
        }
    }

    /** The player put a debuff on the target; `remain` when seen, else the spell's hold (or 18 s). */
    noteTargetDebuff(spellId: number, remain?: number): void {
        if (!this.units.doesExist("target")) return;
        this.forgetDebuffsOfOtherTarget();
        let seconds = remain;
        if (seconds === undefined || !hasKnownExpiry(seconds)) {
            const hold = this.holds.getHoldSeconds(spellId);
            seconds = hold > 0 ? hold : DEFAULT_DEBUFF_SECONDS;
        }
        const endsAt = this.clock.getCurrentTime() + seconds;
        const nameKey = this.nameKeys.findKeyOf(spellId);
        if (nameKey !== undefined) this.heldDebuffs.set(nameKey, endsAt);
        this.heldDebuffs.set(`id:${spellId}`, endsAt);
        const resolved = this.spells.resolve(spellId);
        if (resolved !== undefined && resolved !== spellId) this.heldDebuffs.set(`id:${resolved}`, endsAt);
    }

    /** Is the debuff remembered on the current target? */
    isDebuffHeld(spellId: number): boolean {
        this.forgetDebuffsOfOtherTarget();
        const now = this.clock.getCurrentTime();
        const byId = this.heldDebuffs.get(`id:${spellId}`);
        if (byId !== undefined && now < byId) return true;
        const nameKey = this.nameKeys.findKeyOf(spellId);
        const byName = nameKey !== undefined ? this.heldDebuffs.get(nameKey) : undefined;
        return byName !== undefined && now < byName;
    }

    /** The target changed: what was remembered on the old one is gone. */
    clearTargetDebuffs(): void {
        for (const [key] of this.heldDebuffs) this.heldDebuffs.delete(key);
        this.debuffTarget = undefined;
    }

    /** The debuffs belong to one target: a new GUID drops them. */
    private forgetDebuffsOfOtherTarget(): void {
        const guid = this.units.getGuid("target");
        if (this.debuffTarget !== undefined && guid !== undefined && this.debuffTarget !== guid) this.clearTargetDebuffs();
        if (guid !== undefined) this.debuffTarget = guid;
    }

    /** Until when a buff seen or cast is remembered; undefined keeps what is held. */
    private findMemoryEnd(
        spellId: number,
        key: string,
        isSeal: boolean,
        remain: number | undefined,
        isFromCast: boolean,
    ): number | undefined {
        const now = this.clock.getCurrentTime();
        if (remain !== undefined && hasKnownExpiry(remain)) return now + remain;
        // A sighting renews the memory: an aura seen every few seconds never runs out in a long play
        const held = this.heldBuffs.get(key);
        if (isFromCast || remain !== undefined || held === undefined || held <= now) return now + this.getMemorySeconds(spellId, isSeal);
        return undefined;
    }

    private getMemorySeconds(spellId: number, isSeal: boolean): number {
        if (isSeal) return SEAL_SECONDS;
        if (this.nameKeys.isOneOf(spellId, "forms", FORMS)) return FORM_SECONDS;
        const hold = this.holds.getHoldSeconds(spellId);
        return hold > 0 ? hold : DEFAULT_SECONDS;
    }
}
