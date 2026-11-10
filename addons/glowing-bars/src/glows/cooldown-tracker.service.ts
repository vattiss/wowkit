// Spell cooldowns. The client often hides them in combat, so a cooldown read while it was readable is remembered, and a
// successful cast starts the spell's base cooldown, which runs out on its own. A few cooldowns start with the cast of another
// spell (Swift Judgement with the next Judgement): until then the spell is not ready, whatever the client says. While the
// client hides them, the spell's icon in the Cooldown Manager says first. The ranks of a spell in the spellbook share one
// cooldown: the cast of Fade's top rank starts the cooldown asked about by its first. An item's spell of the same name is
// not in the spellbook, and keeps its own.
import { OnEvent } from "@wowkit/core";
import type { ClockService, CooldownsService, CooldownViewerService, PlayerSpellCast, SpellsService } from "@wowkit/wow";
import { COOLDOWN_STARTED_BY } from "./glow-cues.constants";

/** A cooldown this short is the global cooldown, which never takes a spell out of the picture. */
const GLOBAL_COOLDOWN = 1.51;
/** Under this many seconds a cooldown counts as over. */
export const READY_MARGIN = 0.2;
/** What a cooldown that waits for another spell's cast has left: it is not ready until then. */
const WAITING = math.huge;
/** Right after a cast the client may not show the new cooldown yet; a readable "ready" is not believed for this long. */
const CAST_GRACE = 1;
/** What a cooldown the icon says is running has left when nobody knows its end: enough not to be ready. */
const STILL_RUNNING = 1;

export class CooldownTrackerService {
    /** Spell ID -> when the tracked cooldown ends. */
    private readonly endsAt = new LuaMap<number, number>();
    /** Spell ID -> the cooldown's length as last read from the client. */
    private readonly knownLength = new LuaMap<number, number>();
    /** Spell ID -> when the player last cast it. */
    private readonly castAt = new LuaMap<number, number>();
    /** Spells cast whose cooldown waits for the cast of another spell (COOLDOWN_STARTED_BY). */
    private readonly waiting = new LuaSet<number>();

    constructor(
        private readonly spells: SpellsService,
        private readonly cooldowns: CooldownsService,
        private readonly clock: ClockService,
        private readonly viewer: CooldownViewerService,
    ) {}

    /** Seconds left on the spell's own cooldown (the global cooldown ignored); 0 when it is ready or nobody knows. */
    getRemaining(spellId: number): number {
        const id = this.findListedId(spellId);
        if (this.waiting.has(id)) return WAITING;
        const read = this.cooldowns.readCooldown(id);
        const now = this.clock.getCurrentTime();
        if (!read.isHidden) {
            if (read.duration > GLOBAL_COOLDOWN) this.knownLength.set(id, read.duration);
            // A cooldown read while readable still counts when the next reads are hidden (in combat)
            if (read.remain > READY_MARGIN) {
                this.endsAt.set(id, now + read.remain);
                return read.remain;
            }
            if (now - (this.castAt.get(id) ?? -CAST_GRACE) > CAST_GRACE) {
                this.endsAt.delete(id);
                return 0;
            }
        }
        const fromIcon = read.isHidden ? this.readCooldownIcon(id, now) : undefined;
        if (fromIcon !== undefined) return fromIcon;
        const endsAt = this.endsAt.get(id);
        if (endsAt === undefined) return 0;
        if (endsAt <= now) {
            this.endsAt.delete(id);
            return 0;
        }
        return endsAt - now;
    }

    /** What the spell's icon in the Cooldown Manager says it has left; undefined when it has no say. */
    private readCooldownIcon(id: number, now: number): number | undefined {
        const name = this.spells.getSpellName(id);
        const isOnCooldown = name !== undefined ? this.viewer.isSpellOnCooldown(name) : undefined;
        if (isOnCooldown === true) return math.max((this.endsAt.get(id) ?? now) - now, STILL_RUNNING);
        if (isOnCooldown === undefined || now - (this.castAt.get(id) ?? -CAST_GRACE) <= CAST_GRACE) return undefined;
        this.endsAt.delete(id);
        return 0;
    }

    /** The player cast the spell: its cooldown starts now (or waits for another spell), and so does that of a spell that waited for it. */
    @OnEvent("player.spell-cast")
    noteSpellCast(cast: PlayerSpellCast): void {
        if (cast.spellId === undefined) return;
        // The ID of what was cast, not one found by its name: an item's spell of the same name stays apart
        const id = this.findRanksId(cast.spellId);
        const now = this.clock.getCurrentTime();
        const started: number[] = [];
        for (const waitingId of this.waiting) if (this.isStartedBy(waitingId, id)) started.push(waitingId);
        for (const waitingId of started) {
            this.waiting.delete(waitingId);
            this.startCooldown(waitingId, now);
        }
        this.castAt.set(id, now);
        if (COOLDOWN_STARTED_BY.some(([spellId]) => this.findListedId(spellId) === id)) {
            this.waiting.add(id);
            this.endsAt.delete(id);
        } else {
            this.startCooldown(id, now);
        }
    }

    private startCooldown(id: number, now: number): void {
        const seconds = math.max(this.cooldowns.getBaseCooldown(id), this.knownLength.get(id) ?? 0);
        if (seconds > GLOBAL_COOLDOWN) this.endsAt.set(id, now + seconds);
    }

    /** The ID a cooldown is kept under: the lowest of the spellbook ranks the spell is one of, else its own. */
    private findRanksId(spellId: number): number {
        const ranks = this.spells.listRanks(spellId);
        if (!ranks.includes(spellId)) return spellId;
        let lowest = spellId;
        for (const rank of ranks) if (rank < lowest) lowest = rank;
        return lowest;
    }

    /** The ID a spell of a list is kept under. */
    private findListedId(spellId: number): number {
        return this.findRanksId(this.spells.resolveOrSame(spellId));
    }

    /** Does the cast of `castId` start the cooldown of `waitingId`? */
    private isStartedBy(waitingId: number, castId: number): boolean {
        return COOLDOWN_STARTED_BY.some(
            ([spellId, startedBy]) =>
                this.findListedId(spellId) === waitingId && startedBy.some((starter) => this.findListedId(starter) === castId),
        );
    }
}
