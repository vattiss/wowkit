// One tick: look at the game, then show what is due. A tick runs every 0.2 seconds, and sooner
// when something happens (refresh.ts asks for it).
import { runEvery, type RepeatingTimer } from "../wow/clock";
import { findReminders } from "./find-reminders";
import { showReminders } from "./show-reminders";

const TICK_SECONDS = 0.2;

let timer: RepeatingTimer | undefined;

/** Starts the regular ticks (at the first login). */
export function startTicking(): void {
    timer ??= runEvery(TICK_SECONDS, () => tick());
}

export function stopTicking(): void {
    timer?.stop();
    timer = undefined;
}

/** Looks at the game and shows what is due. Does nothing before the first login. */
export function tick(): void {
    if (timer === undefined) return;
    showReminders(findReminders());
}
