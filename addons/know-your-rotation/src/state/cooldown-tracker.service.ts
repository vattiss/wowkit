// Spell cooldowns. The client often hides them in combat, so a cooldown read while it was readable is remembered, and
// a successful cast starts the spell's base cooldown (or the Classic value of COOLDOWNS). The look-ahead marks the
// cooldowns of spells it assumes will be cast, so the queue's next slots skip them.
import type { ClockService, CooldownsService, SpellsService } from "@wowkit/wow";
import type { NameKeysService } from "../knowledge/name-keys.service";
import { COOLDOWNS, SHARED_COOLDOWNS } from "../knowledge/spell-data.constants";

/** A cooldown this short is the global cooldown, which never takes a spell out of the queue. */
const GLOBAL_COOLDOWN = 1.51;
/** Under this many seconds a cooldown counts as over. */
const READY_MARGIN = 0.2;

type SharedCooldown = (typeof SHARED_COOLDOWNS)[number];

export class CooldownTrackerService {
    /** Key (name key or "id:<id>") -> when the tracked cooldown ends. */
    private readonly endsAt = new LuaMap<string, number>();
    /** Key -> the cooldown's length as last read from the client. */
    private readonly knownLength = new LuaMap<string, number>();
    /** The look-ahead's assumed cooldowns: key -> when they would end. */
    private readonly predicted = new LuaMap<string, number>();

    constructor(
        private readonly spells: SpellsService,
        private readonly cooldowns: CooldownsService,
        private readonly clock: ClockService,
        private readonly nameKeys: NameKeysService,
    ) {}

    /** Seconds left on the spell's own cooldown (the global cooldown ignored), and its length. */
    readCooldown(spellId: number): LuaMultiReturn<[remain: number, duration: number]> {
        const id = this.spells.resolveOrSame(spellId);
        const read = this.cooldowns.readCooldown(id);
        const keys = this.listKeys(id);
        if (!read.isHidden && read.duration > GLOBAL_COOLDOWN) {
            for (const key of keys) this.knownLength.set(key, read.duration);
            // A cooldown read while readable still counts when the next reads are hidden (in combat)
            if (read.remain > READY_MARGIN) this.markUntil(keys, this.clock.getCurrentTime() + read.remain);
        }
        const tracked = math.max(this.getRemaining(this.endsAt, keys), this.getRemaining(this.predicted, keys));
        if (tracked > READY_MARGIN) {
            // A readable real cooldown wins over the estimate: talents can shorten it
            if (!read.isHidden && read.duration > GLOBAL_COOLDOWN) return $multi(read.remain, read.duration);
            return $multi(tracked, read.duration > 0 ? read.duration : tracked);
        }
        if (read.isHidden) return $multi(0, 0);
        return $multi(read.remain, read.duration);
    }

    /** The spell's cooldown in seconds: the client's base cooldown, else the Classic value. */
    getCooldownSeconds(spellId: number): number {
        const id = this.spells.resolveOrSame(spellId);
        const base = this.cooldowns.getBaseCooldown(id);
        return base > READY_MARGIN ? base : this.getFallbackSeconds(id);
    }

    /** The player cast the spell: its cooldown (and its shared group's) starts now. */
    noteSpellCast(spellId: number): void {
        let seconds = this.cooldowns.getBaseCooldown(spellId);
        const known = this.knownLength.get(this.nameKeys.findKeyOf(spellId) ?? `id:${spellId}`);
        if (seconds <= 0 && known !== undefined && known > 1.5) seconds = known;
        if (seconds <= 0) seconds = this.getFallbackSeconds(spellId);
        this.markCooldown(this.endsAt, spellId, seconds);
    }

    /** The look-ahead assumes the spell is cast: its cooldown counts until the look-ahead ends. */
    markAssumedCooldown(spellId: number): void {
        const seconds = this.getCooldownSeconds(spellId);
        if (seconds > READY_MARGIN) this.markCooldown(this.predicted, spellId, seconds, true);
    }

    clearPredictions(): void {
        for (const [key] of this.predicted) this.predicted.delete(key);
    }

    /** The group of spells that share the spell's cooldown (by ID or name). */
    findSharedGroup(spellId: number): SharedCooldown | undefined {
        const name = this.spells.getSpellName(spellId);
        return SHARED_COOLDOWNS.find((group) =>
            group.ids.some((id) => id === spellId || (name !== undefined && this.spells.getSpellName(id) === name)),
        );
    }

    private getFallbackSeconds(spellId: number): number {
        const direct = COOLDOWNS[spellId];
        if (direct !== undefined) return direct;
        const group = this.findSharedGroup(spellId);
        if (group) return group.seconds;
        const name = this.spells.getSpellName(spellId);
        if (name === undefined) return 0;
        for (const [id, seconds] of pairs(COOLDOWNS)) {
            if (seconds !== undefined && this.spells.getSpellName(id as number) === name) return seconds;
        }
        return 0;
    }

    private markCooldown(map: LuaMap<string, number>, spellId: number, seconds: number, isSameEnd = false): void {
        if (seconds <= READY_MARGIN) return;
        const now = this.clock.getCurrentTime();
        this.markUntil(this.listKeys(spellId), now + seconds, map);
        const group = this.findSharedGroup(spellId);
        if (!group) return;
        const groupEnd = isSameEnd ? now + seconds : now + math.max(seconds, group.seconds);
        for (const id of group.ids) this.markUntil(this.listKeys(id), groupEnd, map);
    }

    private markUntil(keys: string[], endsAt: number, map = this.endsAt): void {
        for (const key of keys) map.set(key, endsAt);
    }

    private getRemaining(map: LuaMap<string, number>, keys: string[]): number {
        const now = this.clock.getCurrentTime();
        let remain = 0;
        for (const key of keys) {
            const endsAt = map.get(key);
            if (endsAt === undefined) continue;
            if (endsAt <= now) map.delete(key);
            else remain = math.max(remain, endsAt - now);
        }
        return remain;
    }

    /** A spell is tracked by its name key (all ranks share the cooldown) and by its ID. */
    private listKeys(spellId: number): string[] {
        const keys = [`id:${spellId}`];
        const nameKey = this.nameKeys.findKeyOf(spellId);
        if (nameKey !== undefined) keys.push(nameKey);
        return keys;
    }
}
