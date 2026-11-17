// The Before of a row in the table: how long before a buff, weapon buff or seal runs out it is asked for. Typed with its
// units (15s, 30m, 1h, 1h30m, 1.5s; a number alone is seconds) and shown back in the largest whole ones.
import type { ReminderType } from "../settings/settings.interface";

/** The types that run out with a time left: the others (a totem gone, a tracking) have no Before. */
const BEFORE_TYPES: ReminderType[] = ["missingBuff", "weaponBuff", "missingSeal"];

const UNIT_SECONDS: { [letter: string]: number } = { h: 3600, m: 60, s: 1 };

/** Has the type a Before (its rows a box for it in the Below column)? */
export function hasBefore(reminderType: ReminderType): boolean {
    return BEFORE_TYPES.includes(reminderType);
}

/** The seconds a typed Before means: an empty box is 0; undefined for what is no time (the box shows the old one again). */
export function parseBefore(text: string): number | undefined {
    let rest = string.lower(string.gsub(text, "%s", "")[0]);
    if (rest === "") return 0;
    const alone = tonumber(rest);
    // A number the game reads as endless (inf) or as none (nan) is no time
    if (alone !== undefined) return alone >= 0 && alone < math.huge ? alone : undefined;
    let total = 0;
    while (rest !== "") {
        const [amount, unit, after] = string.match(rest, "^(%d*%.?%d+)([hms])(.*)$");
        if (amount === undefined || unit === undefined) return undefined;
        total += tonumber(amount)! * UNIT_SECONDS[unit]!;
        if (total >= math.huge) return undefined;
        rest = after ?? "";
    }
    return total;
}

/** A Before as its box shows it: 1h, 30m, 1m30s, 1.5s; empty for 0. */
export function formatBefore(seconds: number): string {
    if (seconds <= 0) return "";
    const hours = math.floor(seconds / 3600);
    const minutes = math.floor((seconds - hours * 3600) / 60);
    const rest = seconds - hours * 3600 - minutes * 60;
    let text = hours > 0 ? `${hours}h` : "";
    if (minutes > 0) text = `${text}${minutes}m`;
    if (rest > 0) text = `${text}${string.format("%g", rest)}s`;
    return text;
}
