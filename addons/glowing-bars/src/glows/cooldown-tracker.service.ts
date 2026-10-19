// Spell cooldowns. The client often hides them in combat, so a cooldown read while it was readable is remembered, and a
// successful cast starts the spell's base cooldown, which runs out on its own.
import { OnEvent } from "@wowkit/core";
import type { ClockService, CooldownsService, PlayerSpellCast, SpellsService } from "@wowkit/wow";

/** A cooldown this short is the global cooldown, which never takes a spell out of the picture. */
const GLOBAL_COOLDOWN = 1.51;
/** Under this many seconds a cooldown counts as over. */
export const READY_MARGIN = 0.2;
/** Right after a cast the client may not show the new cooldown yet; a readable "ready" is not believed for this long. */
const CAST_GRACE = 1;

export class CooldownTrackerService {
    /** Spell ID -> when the tracked cooldown ends. */
    private readonly endsAt = new LuaMap<number, number>();
    /** Spell ID -> the cooldown's length as last read from the client. */
    private readonly knownLength = new LuaMap<number, number>();
    /** Spell ID -> when the player last cast it. */
    private readonly castAt = new LuaMap<number, number>();

    constructor(
        private readonly spells: SpellsService,
        private readonly cooldowns: CooldownsService,
        private readonly clock: ClockService,
    ) {}

    /** Seconds left on the spell's own cooldown (the global cooldown ignored); 0 when it is ready or nobody knows. */
    getRemaining(spellId: number): number {
        const id = this.spells.resolveOrSame(spellId);
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

    /** The player cast the spell: its cooldown starts now. */
    @OnEvent("player.spell-cast")
    noteSpellCast(cast: PlayerSpellCast): void {
        if (cast.spellId === undefined) return;
        const id = this.spells.resolveOrSame(cast.spellId);
        const seconds = math.max(this.cooldowns.getBaseCooldown(id), this.knownLength.get(id) ?? 0);
        const now = this.clock.getCurrentTime();
        this.castAt.set(id, now);
        if (seconds > GLOBAL_COOLDOWN) this.endsAt.set(id, now + seconds);
    }
}
