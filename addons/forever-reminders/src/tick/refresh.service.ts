// When to look again. Game events come in bursts (a quest turn-in or a level-up fires many at
// once, and Forever froze when the addon rebuilt things on every one), so each request is merged
// with the ones around it and delayed a little.
import { OnGameEvent } from "@forever/framework";
import type { ActionBarsService } from "@forever/wow";
import type { AurasService } from "@forever/wow";
import type { ClockService } from "@forever/wow";
import type { SpellsService } from "@forever/wow";
import type { ShowRemindersService } from "./show-reminders.service";
import type { TickService } from "./tick.service";

/** The bars are mapped again this long after the last change (changes come in bursts). */
const BAR_SETTLE = 0.5;
/** Spell lookups are cleared this long after a learn or a level-up. */
const SPELL_SETTLE = 0.5;

export class RefreshService {
    private isTickQueued = false;
    private barRemapGeneration = 0;
    private spellRefreshGeneration = 0;

    constructor(
        private readonly ticker: TickService,
        private readonly shower: ShowRemindersService,
        private readonly actionBars: ActionBarsService,
        private readonly auras: AurasService,
        private readonly clock: ClockService,
        private readonly spells: SpellsService,
    ) {}

    /** A tick on the next frame; several requests in one frame give one tick. */
    requestTick(): void {
        this.shower.markGlowsStale();
        if (this.isTickQueued) return;
        this.isTickQueued = true;
        this.clock.runAfter(0, () => {
            this.isTickQueued = false;
            this.ticker.tick();
        });
    }

    /** A tick that reads the auras again instead of reusing a recent read. */
    @OnGameEvent(
        "PLAYER_UPDATE_RESTING",
        "ZONE_CHANGED_NEW_AREA",
        "PLAYER_ALIVE",
        "PLAYER_UNGHOST",
        "PLAYER_MOUNT_DISPLAY_CHANGED",
        "PLAYER_DEAD",
        "PLAYER_REGEN_ENABLED",
    )
    requestTickWithFreshAuras(): void {
        this.auras.wipeAuraScans();
        this.requestTick();
    }

    /** The bars changed (a form, a stance, a page, a slot): map them again once they settle. */
    @OnGameEvent("SPELL_PUSHED_TO_ACTIONBAR", "ACTIONBAR_SLOT_CHANGED", "ACTIONBAR_PAGE_CHANGED")
    scheduleBarRemap(): void {
        this.actionBars.noteBarsChanged();
        this.barRemapGeneration += 1;
        const generation = this.barRemapGeneration;
        this.clock.runAfter(BAR_SETTLE, () => {
            if (generation !== this.barRemapGeneration) return;
            this.actionBars.mapBars(true);
            this.requestTick();
        });
    }

    @OnGameEvent("UPDATE_SHAPESHIFT_FORM")
    noteShapeshift(): void {
        this.auras.noteFormChange();
        this.scheduleBarRemap();
    }

    /**
     * Spells were learned or the player levelled up. Only the failed spell lookups are cleared, so a
     * new rank resolves; the spellbook is not walked again (that froze the client on quest turn-in).
     * Do NOT listen to SPELLS_CHANGED: Forever fires it in storms on quest turn-in and level-up.
     */
    @OnGameEvent("PLAYER_TALENT_UPDATE", "PLAYER_LEVEL_UP")
    scheduleSpellRefresh(): void {
        this.spellRefreshGeneration += 1;
        const generation = this.spellRefreshGeneration;
        this.clock.runAfter(SPELL_SETTLE, () => {
            if (generation !== this.spellRefreshGeneration) return;
            this.spells.invalidateSpells(false);
            this.requestTick();
            this.scheduleBarRemap();
        });
    }

    @OnGameEvent("LEARNED_SPELL_IN_SKILL_LINE")
    noteLearnedSpellAndRefresh(spellId: number): void {
        this.spells.noteLearnedSpell(spellId);
        this.scheduleSpellRefresh();
    }
}
