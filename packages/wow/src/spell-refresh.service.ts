// Keeps the spell lookups fresh. Spells are learned and levels gained in bursts, so the lookups are cleared once things
// settle. Announces "spells.refreshed" when it did.
import { type EventBus, OnGameEvent } from "@wowkit/framework";
import type { ClockService } from "./clock.service";
import type { SpellsService } from "./spells.service";

declare module "@wowkit/framework/event-bus" {
    interface AppEvents {
        /** The spell lookups were cleared after spells were learned or a level was gained. */
        "spells.refreshed": [];
    }
}

/** Spell lookups are cleared this long after a learn or a level-up. */
const SPELL_SETTLE = 0.5;

export class SpellRefreshService {
    private generation = 0;

    constructor(
        private readonly spells: SpellsService,
        private readonly clock: ClockService,
        private readonly bus: EventBus,
    ) {}

    /**
     * Spells were learned or the player levelled up. Only the failed spell lookups are cleared, so a new rank
     * resolves; the spellbook is not walked again (that froze the client on quest turn-in).
     * Do NOT listen to SPELLS_CHANGED: Forever fires it in storms on quest turn-in and level-up.
     */
    @OnGameEvent("PLAYER_TALENT_UPDATE", "PLAYER_LEVEL_UP")
    scheduleSpellRefresh(): void {
        this.generation += 1;
        const generation = this.generation;
        this.clock.runAfter(SPELL_SETTLE, () => {
            if (generation !== this.generation) return;
            this.spells.invalidateSpells(false);
            this.bus.emit("spells.refreshed");
        });
    }

    @OnGameEvent("LEARNED_SPELL_IN_SKILL_LINE")
    noteLearnedSpellAndRefresh(spellId: number): void {
        this.spells.noteLearnedSpell(spellId);
        this.scheduleSpellRefresh();
    }
}
