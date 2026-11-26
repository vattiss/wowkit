// Keeps the spell lookups fresh. Spells are learned and levels gained in bursts, so the lookups are cleared once things
// settle. Talents can take spells away (a switch of specs, a reset at the trainer): then the lookups and the spellbook index
// are made again in full, as at the login, rate limited. Announces "spells.refreshed" when it did.
import { type EventBus, OnGameEvent } from "@wowkit/core";
import type { ClockService } from "./clock.service";
import type { SpellsService } from "./spells.service";

declare module "@wowkit/core/event-bus" {
    interface AppEvents {
        /** The spell lookups were cleared after spells were learned or a level was gained. */
        "spells.refreshed": [];
    }
}

/** Spell lookups are cleared this long after a learn or a level-up. */
const SPELL_SETTLE = 0.5;
/** A full refresh waits this long after the last change of the talents (a spec switch sends a burst)... */
const TALENT_SETTLE = 1;
/** ...and comes at most once in so many seconds (talent points spent one by one). */
const TALENT_REFRESH_GAP = 5;

export class SpellRefreshService {
    private generation = 0;
    private talentGeneration = 0;
    private lastFullRefreshAt = -TALENT_REFRESH_GAP;

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
    @OnGameEvent("PLAYER_LEVEL_UP")
    scheduleSpellRefresh(): void {
        this.generation += 1;
        const generation = this.generation;
        this.clock.runAfter(SPELL_SETTLE, () => {
            if (generation !== this.generation) return;
            this.spells.invalidateSpells(false);
            this.bus.emit("spells.refreshed");
        });
    }

    /**
     * The talents changed: a spell may be gone (Shadowform after a switch to a priest's Discipline spec), which the lookups
     * still know. Everything is read again, as at the login: once the burst settles, and not sooner than TALENT_REFRESH_GAP
     * after the last time; a change meanwhile still gets it, at the end of the gap.
     */
    @OnGameEvent("ACTIVE_TALENT_GROUP_CHANGED", "PLAYER_TALENT_UPDATE", "CHARACTER_POINTS_CHANGED")
    scheduleFullRefresh(): void {
        this.talentGeneration += 1;
        const generation = this.talentGeneration;
        const wait = math.max(TALENT_SETTLE, this.lastFullRefreshAt + TALENT_REFRESH_GAP - this.clock.getCurrentTime());
        this.clock.runAfter(wait, () => {
            if (generation !== this.talentGeneration) return;
            this.lastFullRefreshAt = this.clock.getCurrentTime();
            this.spells.invalidateSpells(true);
            this.spells.rebuildSpellBook(false);
            this.bus.emit("spells.refreshed");
        });
    }

    @OnGameEvent("LEARNED_SPELL_IN_SKILL_LINE")
    noteLearnedSpellAndRefresh(spellId: number): void {
        this.spells.noteLearnedSpell(spellId);
        this.scheduleSpellRefresh();
    }
}
