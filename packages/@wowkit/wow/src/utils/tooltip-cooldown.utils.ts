// A cooldown only the spell's tooltip names: Forever gives Faerie Fire one in Bear Form, which the game's data does not have.
// The tooltip is matched with the game's own wording ("%.2g sec cooldown"), so it reads in every language.
import { attempt } from "./protected-call.utils";
import { getReadable } from "./secret-value.utils";

/** The game's wording of a cooldown in a tooltip, and how many seconds its number is. */
const COOLDOWN_WORDINGS: [name: string, seconds: number][] = [
    ["SPELL_RECAST_TIME_SEC", 1],
    ["SPELL_RECAST_TIME_MIN", 60],
    ["SPELL_RECAST_TIME_HOURS", 3600],
];
/** Where the number goes in a wording turned into a pattern. */
const NUMBER_MARK = "#NUMBER#";
/** Where a word the game puts in the plural goes ("|4Minute:Minuten;"): any word there. */
const PLURAL_MARK = "#PLURAL#";

/** The seconds of the cooldown the spell's tooltip names now; 0 when it names none. */
export function readTooltipCooldown(spellId: number): number {
    const tooltip = attempt(C_TooltipInfo.GetSpellByID, spellId);
    if (tooltip === undefined || type(tooltip) !== "table") return 0;
    for (const line of tooltip.lines ?? []) {
        for (const text of [getReadable(line.leftText), getReadable(line.rightText)]) {
            const seconds = text !== undefined ? matchCooldown(text) : undefined;
            if (seconds !== undefined) return seconds;
        }
    }
    return 0;
}

function matchCooldown(text: string): number | undefined {
    const globals = _G as unknown as { [name: string]: unknown };
    for (const [name, seconds] of COOLDOWN_WORDINGS) {
        const wording = globals[name];
        if (type(wording) !== "string") continue;
        const [number] = string.match(text, buildPattern(wording as string));
        // A decimal comma in some languages
        const value = number !== undefined ? tonumber(string.gsub(number, ",", ".")[0]) : undefined;
        if (value !== undefined) return value * seconds;
    }
    return undefined;
}

/** "%.2g sec cooldown" -> "^([%d%.,]+) sec cooldown$"; "%.3g |4Minute:Minuten; Abklingzeit" -> "^([%d%.,]+) .- Abklingzeit$" */
function buildPattern(wording: string): string {
    let [pattern] = string.gsub(wording, "|4[^;]*;", PLURAL_MARK);
    [pattern] = string.gsub(pattern, "%%[%-%d%.]*[dfgs]", NUMBER_MARK);
    [pattern] = string.gsub(pattern, "([%(%)%.%%%+%-%*%?%[%]%^%$])", "%%%1");
    [pattern] = string.gsub(pattern, NUMBER_MARK, "([%%d%%.,]+)");
    [pattern] = string.gsub(pattern, PLURAL_MARK, ".-");
    return `^${pattern}$`;
}
