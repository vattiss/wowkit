// Which clauses of a macro line a press can reach now. The game judges the stance, the form and stealth: the bars are mapped
// again whenever they change. Any other condition (a key held at the press, a target, a fight, being mounted) can change at
// any moment without that, so a clause behind one counts either way.
import { attemptMulti } from "./protected-call.utils";
import { getReadable } from "./secret-value.utils";

/** The conditions the game judges here, without their "no": the rest count either way. */
const JUDGED_CONDITIONS = ["stance", "form", "stealth"];

/** Can a press reach a clause, and does a press that gets there always stop there? */
export interface JudgedClause {
    isReached: boolean;
    isFinal: boolean;
}

/** stance:2, form, nostealth...: one the game judges here. */
function isJudgedCondition(condition: string): boolean {
    const [word] = string.gsub(string.lower(strtrim(condition)), "^no", "");
    return JUDGED_CONDITIONS.some((name) => string.sub(word, 1, name.length) === name);
}

/** @focus, target=party1, or nothing: who the spell goes on, which always holds. */
function isTargetOnly(condition: string): boolean {
    const word = string.lower(strtrim(condition));
    return word === "" || string.sub(word, 1, 1) === "@" || string.sub(word, 1, 7) === "target=";
}

/** Do these conditions hold now, as the game judges them? Without its judge, or when it fails, they hold. */
function isHolding(conditions: string): boolean {
    if (strtrim(conditions) === "") return true;
    // A client without it fails the call: then they hold
    const [didRead, result] = attemptMulti(() => SecureCmdOptionParse(`[${conditions}] x`));
    return !didRead || getReadable(result) === "x";
}

/** A clause with these groups of conditions ("[a,b]", "[c]": any group may hold); none is a clause that always holds. */
export function judgeClause(groups: string[]): JudgedClause {
    if (groups.length === 0) return { isReached: true, isFinal: true };
    const judged = { isReached: false, isFinal: false };
    for (const group of groups) {
        const conditions: string[] = [];
        let isEitherWay = false;
        for (const [condition] of string.gmatch(string.sub(group, 2, -2), "[^,]+")) {
            if (isJudgedCondition(condition!)) conditions.push(condition!);
            else if (!isTargetOnly(condition!)) isEitherWay = true;
        }
        if (!isHolding(conditions.join(","))) continue;
        judged.isReached = true;
        // Behind a condition that counts either way, a press may go on to the next clause
        if (!isEitherWay) judged.isFinal = true;
    }
    return judged;
}
