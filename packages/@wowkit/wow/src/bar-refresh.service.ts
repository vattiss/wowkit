// Keeps the map of the action bars fresh. The bars change in bursts (a form, a stance, a page, a slot), so they are
// mapped again once the changes settle.
import { OnEvent, OnGameEvent } from "@wowkit/core";
import type { ActionBarsService } from "./action-bars.service";
import type { ClockService } from "./clock.service";

/** The bars are mapped again this long after the last change (changes come in bursts). */
const BAR_SETTLE = 0.5;
/**
 * The bars are mapped again this long after the first login too: some bar addons make their buttons only after it
 * (EllesmereUI one frame after the login, past the first map), and making a button fires no bar event.
 */
const LATE_BUTTONS_DELAY = 3;

export class BarRefreshService {
    private generation = 0;

    constructor(
        private readonly actionBars: ActionBarsService,
        private readonly clock: ClockService,
    ) {}

    /** Bar addons that make their buttons late: map the bars again once they have. */
    onFirstLogin(): void {
        this.clock.runAfter(LATE_BUTTONS_DELAY, () => this.actionBars.mapBars(true));
    }

    /** The bars changed: map them again once they settle. */
    @OnGameEvent("SPELL_PUSHED_TO_ACTIONBAR", "ACTIONBAR_SLOT_CHANGED", "ACTIONBAR_PAGE_CHANGED")
    scheduleBarRemap(): void {
        this.actionBars.noteBarsChanged();
        this.generation += 1;
        const generation = this.generation;
        this.clock.runAfter(BAR_SETTLE, () => {
            if (generation !== this.generation) return;
            this.actionBars.mapBars(true);
        });
    }

    /** New spells may sit on the bars at a new rank. */
    @OnEvent("spells.refreshed")
    scheduleRemapAfterSpellRefresh(): void {
        this.scheduleBarRemap();
    }
}
