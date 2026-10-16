// When to look again. Game events come in bursts (a quest turn-in or a level-up fires many at
// once, and Forever froze when the addon rebuilt things on every one), so each request is merged
// with the ones around it and delayed a little.
import { mapBars, noteBarsChanged } from "../wow/action-bars";
import { wipeAuraScans } from "../wow/auras";
import { runAfter } from "../wow/clock";
import { invalidateSpells } from "../wow/spells";
import { markGlowsStale } from "./show-reminders";
import { tick } from "./tick";

/** The bars are mapped again this long after the last change (changes come in bursts). */
const BAR_SETTLE = 0.5;
/** Spell lookups are cleared this long after a learn or a level-up. */
const SPELL_SETTLE = 0.5;

let isTickQueued = false;
let barRemapGeneration = 0;
let spellRefreshGeneration = 0;

/** A tick on the next frame; several requests in one frame give one tick. */
export function requestTick(): void {
    markGlowsStale();
    if (isTickQueued) return;
    isTickQueued = true;
    runAfter(0, () => {
        isTickQueued = false;
        tick();
    });
}

/** A tick that reads the auras again instead of reusing a recent read. */
export function requestTickWithFreshAuras(): void {
    wipeAuraScans();
    requestTick();
}

/** The bars changed (a form, a stance, a page, a slot): map them again once they settle. */
export function scheduleBarRemap(): void {
    noteBarsChanged();
    barRemapGeneration += 1;
    const generation = barRemapGeneration;
    runAfter(BAR_SETTLE, () => {
        if (generation !== barRemapGeneration) return;
        mapBars(true);
        requestTick();
    });
}

/**
 * Spells were learned or the player levelled up. Only the failed spell lookups are cleared, so a
 * new rank resolves; the spellbook is not walked again (that froze the client on quest turn-in).
 */
export function scheduleSpellRefresh(): void {
    spellRefreshGeneration += 1;
    const generation = spellRefreshGeneration;
    runAfter(SPELL_SETTLE, () => {
        if (generation !== spellRefreshGeneration) return;
        invalidateSpells(false);
        requestTick();
        scheduleBarRemap();
    });
}
