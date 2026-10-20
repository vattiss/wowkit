// Spell cooldowns. The client often hides them in combat, so a cooldown read while it was readable is remembered, and a
// successful cast starts the spell's base cooldown, which runs out on its own. A few cooldowns start with the cast of another
// spell (Swift Judgement with the next Judgement): until then the spell is not ready, whatever the client says.
import { OnEvent } from "@wowkit/core";
import type { ClockService, CooldownsService, PlayerSpellCast, SpellsService } from "@wowkit/wow";
import { COOLDOWN_STARTED_BY } from "./glow-cues.constants";

/** A cooldown this short is the global cooldown, which never takes a spell out of the picture. */
const GLOBAL_COOLDOWN = 1.51;
/** Under this many seconds a cooldown counts as over. */
export const READY_MARGIN = 0.2;
/** What a cooldown that waits for another spell's cast has left: it is not ready until then. */
const WAITING = math.huge;
/** Right after a cast the client may not show the new cooldown yet; a readable "ready" is not believed for this long. */
const CAST_GRACE = 1;

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
    ) {}

    /** Seconds left on the spell's own cooldown (the global cooldown ignored); 0 when it is ready or nobody knows. */
    getRemaining(spellId: number): number {
        const id = this.spells.resolveOrSame(spellId);
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
        const endsAt = this.endsAt.get(id);
        if (endsAt === undefined) return 0;
        if (endsAt <= now) {
            this.endsAt.delete(id);
            return 0;
        }
        return endsAt - now;
    }

    /** The player cast the spell: its cooldown starts now (or waits for another spell), and so does that of a spell that waited for it. */
    @OnEvent("player.spell-cast")
    noteSpellCast(cast: PlayerSpellCast): void {
        if (cast.spellId === undefined) return;
        const id = this.spells.resolveOrSame(cast.spellId);
        const now = this.clock.getCurrentTime();
        const started: number[] = [];
        for (const waitingId of this.waiting) if (this.isStartedBy(waitingId, id)) started.push(waitingId);
        for (const waitingId of started) {
            this.waiting.delete(waitingId);
            this.startCooldown(waitingId, now);
        }
        this.castAt.set(id, now);
        if (COOLDOWN_STARTED_BY.some(([spellId]) => this.spells.resolveOrSame(spellId) === id)) {
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

    /** Does the cast of `castId` start the cooldown of `waitingId`? */
    private isStartedBy(waitingId: number, castId: number): boolean {
        return COOLDOWN_STARTED_BY.some(
            ([spellId, startedBy]) =>
                this.spells.resolveOrSame(spellId) === waitingId &&
                startedBy.some((starter) => this.spells.resolveOrSame(starter) === castId),
        );
    }
}
