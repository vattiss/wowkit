// The player's cast in progress and the last cast: the client marks spells unusable during a cast or the global
// cooldown, so what comes right after a cast is judged with that in mind.
import type { ClockService, PlayerService, SpellsService } from "@wowkit/wow";

export class CastStateService {
    private lastCastAt = -10;

    constructor(
        private readonly player: PlayerService,
        private readonly spells: SpellsService,
        private readonly clock: ClockService,
    ) {}

    /** A cast finished (its spell may be hidden). */
    noteCast(): void {
        this.lastCastAt = this.clock.getCurrentTime();
    }

    getSecondsSinceLastCast(): number {
        return this.clock.getCurrentTime() - this.lastCastAt;
    }

    /** Seconds left on the cast or channel in progress. */
    getCastRemaining(): number {
        return this.player.getCastRemaining();
    }

    /** Is the player casting or channeling this spell now (by name)? */
    isCasting(spellId: number): boolean {
        const name = this.spells.getSpellName(spellId);
        if (name === undefined || name === "") return false;
        return this.player.getCastingSpellName() === name || this.player.getChannelingSpellName() === name;
    }
}
