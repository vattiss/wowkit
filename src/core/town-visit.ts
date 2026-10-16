// Arriving in a town or an inn, where reagents are sold: name the ones that are running low.
import { showNotice, say } from "../wow/notice";
import { isResting } from "../wow/player";
import { getText } from "../locale";
import { findLowReagents } from "../reminders/reagents";
import { settings } from "../settings";

let wasResting = false;

/** Call when the player may have arrived (at login and when the resting state changes). */
export function checkReagentsOnArrival(): void {
    const isRestingNow = isResting();
    const hasArrived = isRestingNow && !wasResting;
    wasResting = isRestingNow;
    if (!hasArrived || !settings.showReagentNotice || settings.isMuted) return;
    const low = findLowReagents();
    if (low.length === 0) return;
    const message = string.format(getText("NOTICE_REAGENTS_LOW"), low.map((stock) => `${stock.name} (${stock.count})`).join(", "));
    say(message);
    showNotice(message);
}
