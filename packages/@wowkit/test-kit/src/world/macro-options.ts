// The game's judge of a macro's options, as far as the tests need it: the stance or form by number, combat and a held key
// (none is held). Any other condition (a target, mounted) holds.
import type { ClientState } from "./client-state";

/** One clause "[a,b][c] x": any group of conditions may hold, its conditions all must. Undefined when none holds. */
export function judgeOptions(state: ClientState, options: string): string | undefined {
    const groups: string[] = [];
    for (const [group] of string.gmatch(options, "%b[]")) groups.push(group!);
    const result = strtrim(string.gsub(options, "%b[]", "")[0]);
    if (groups.length === 0) return result;
    const isGroupHolding = (group: string) => {
        for (const [condition] of string.gmatch(string.sub(group, 2, -2), "[^,]+"))
            if (!isConditionHolding(state, condition!)) return false;
        return true;
    };
    return groups.some((group) => isGroupHolding(group)) ? result : undefined;
}

/** stance:2, form:0, nostance, combat, mod:shift... */
function isConditionHolding(state: ClientState, condition: string): boolean {
    let word = string.lower(strtrim(condition));
    if (word === "" || string.sub(word, 1, 1) === "@" || string.sub(word, 1, 7) === "target=") return true;
    const isNegated = string.sub(word, 1, 2) === "no";
    if (isNegated) word = string.sub(word, 3);
    const [name, value] = string.match(word, "^(%a+):?(.*)$");
    let isHolding: boolean;
    if (name === "stance" || name === "form") isHolding = isStanceHolding(state, value ?? "");
    else if (name === "combat") isHolding = state.isInCombat;
    else if (name === "mod" || name === "modifier") isHolding = false;
    // Not known here, either way: it holds
    else return true;
    return isNegated ? !isHolding : isHolding;
}

/** "": in any stance; "0": in none; "1/2": in one of these, by their number on the stance bar. */
function isStanceHolding(state: ClientState, value: string): boolean {
    const active = state.activeStance === undefined ? 0 : state.stances.indexOf(state.activeStance) + 1;
    if (value === "") return active > 0;
    return string.find("/" + value + "/", "/" + active + "/", 1, true)[0] !== undefined;
}
