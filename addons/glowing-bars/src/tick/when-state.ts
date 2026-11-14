// Which When of a look holds right now, read once for a tick: always, in combat or out of it, a living enemy or anyone
// targeted (or a fight), a living ally targeted. "Alert in town" holds anywhere: it glows anywhere, and keeps its message and sound to a town or an inn. And
// which When began at this tick: a ready cooldown glows again as its time begins, with a "+ start" choice or a target of
// its kind.
import type { PlayerService } from "@wowkit/wow";
import type { When } from "../settings/settings.interface";

export type WhenState = { [when in When]: boolean };

export function createWhenState(): WhenState {
    return {
        always: true,
        alwaysStart: true,
        inCombat: false,
        inCombatStart: false,
        outOfCombat: true,
        outOfCombatStart: true,
        enemyTargeted: false,
        allyTargeted: false,
        anyTargeted: false,
        townAlert: true,
    };
}

/** For each When, does it hold now? Read into `state`, the same table at every tick. */
export function readWhenState(player: PlayerService, state: WhenState): WhenState {
    const isInCombat = player.isInCombat();
    state.inCombat = isInCombat;
    // A "+ start" choice holds as the one without it: the start is the glow time's to add (whenStarts)
    state.inCombatStart = isInCombat;
    state.outOfCombat = !isInCombat;
    state.outOfCombatStart = !isInCombat;
    // In a fight Enemy and Any targeted hold without a target too: a target lost or changed does not turn them off. Ally
    // targeted goes by the target alone: an ally targeted is what it tells
    state.enemyTargeted = isInCombat || player.hasEnemyTarget();
    state.allyTargeted = player.hasAllyTarget();
    state.anyTargeted = isInCombat || player.hasLivingTarget();
    return state;
}

/**
 * The When whose time began between `was` and `now`, into `starts`; then `was` becomes `now`. In combat + start and
 * Always + start begin as a fight starts, Out of combat + start as it ends, the targeted ones with a target of their kind. The others
 * have no start: a ready cooldown glows once, as it is ready.
 */
export function readWhenStarts(now: WhenState, was: WhenState, starts: WhenState): void {
    const hasFightStarted = now.inCombat && !was.inCombat;
    for (const when of WHENS) {
        starts[when] = when === "alwaysStart" ? hasFightStarted : STARTING_WHENS.includes(when) && now[when] && !was[when];
    }
    for (const when of WHENS) was[when] = now[when];
}

/** No When has begun: what the starts are before the first tick. */
export function createNoStarts(): WhenState {
    const starts = createWhenState();
    for (const when of WHENS) starts[when] = false;
    return starts;
}

const WHENS: When[] = [
    "always",
    "alwaysStart",
    "inCombat",
    "inCombatStart",
    "outOfCombat",
    "outOfCombatStart",
    "enemyTargeted",
    "allyTargeted",
    "anyTargeted",
    "townAlert",
];
/** The When that begin when they come to hold (Always + start begins with a fight: Always never comes to hold). */
const STARTING_WHENS: When[] = ["inCombatStart", "outOfCombatStart", "enemyTargeted", "allyTargeted", "anyTargeted"];
