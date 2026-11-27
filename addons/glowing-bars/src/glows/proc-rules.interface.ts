// The rules of the procs (beta, behind "Use advanced proc rules"): each rule is a spell and one condition; a spell with
// several rules glows by the first priority at which one of them holds (the same number counts equally, the lowest is
// asked first), and that rule's result and group decide whether it glows and with which row's look.
import type { AddonSettingsService } from "../settings/settings.interface";

/**
 * What a rule asks:
 * - usable: the game says the spell can be cast now (Execute below 20%, Victory Rush after a kill)
 * - buff: a buff (`value`, its spell ID) is on the player, by its aura or its icon in the Cooldown Manager
 * - targetType: a living enemy of a creature type (`value`, the game's ID: 3 Demon, 6 Undead) is targeted, and the spell is
 *   usable
 * - afterBlock / afterDodge / afterParry: the player blocked, dodged or parried in the last few seconds
 * - targetDodged: the target dodged the warrior (Forever's combo point)
 * - free / instant: the spell costs nothing, or casts at once, now
 * - inRange: the game says the target is in the spell's range (Feral Charge out of its dead zone); no target, or no answer
 *   from the game, is out of range, so it never glows by a guess
 * - targetHealth / myHealth: the target's or the player's health is at or below `value` percent (only the game knows: a glow
 *   it fades, see the services of the low health)
 */
export type ProcConditionKind =
    | "usable"
    | "buff"
    | "targetType"
    | "afterBlock"
    | "afterDodge"
    | "afterParry"
    | "targetDodged"
    | "free"
    | "instant"
    | "inRange"
    | "targetHealth"
    | "myHealth";

/** Every kind, for the ones read back from the saved settings. */
export const PROC_CONDITION_KINDS: ProcConditionKind[] = [
    "usable",
    "buff",
    "targetType",
    "afterBlock",
    "afterDodge",
    "afterParry",
    "targetDodged",
    "free",
    "instant",
    "inRange",
    "targetHealth",
    "myHealth",
];

export type ProcRuleResult = "glow" | "noGlow";

export interface ProcRule {
    spellId: number;
    kind: ProcConditionKind;
    /** The buff's spell ID, the creature type's ID, or the health percent, for the kinds that take one. */
    value?: number;
    result: ProcRuleResult;
    /** 1 is asked first; rules of the same number count equally. */
    priority: number;
    /** The row of the Procs tab whose look the glow takes: none, the spell's own; else "<spell> (<group>)". */
    group?: string;
    /** A rule of the player's switched off (a built-in one is switched off by its key, see disabledProcRules). */
    isOff?: boolean;
}

/** A rule of the addon's: switched off by the player by its key, never changed. */
export interface BuiltInProcRule extends ProcRule {
    /**
     * Where the game hides the target's type, the spell's range check stands in (it says no to a target the spell cannot hit):
     * only for a spell that hits nothing else (Exorcism).
     */
    isRangeFallback?: boolean;
    /** A rule of the player's, as the engine lists it (its buff may also be told by the addon's memory of a cast). */
    isOwn?: boolean;
    /** The switch of its group's row, as the engine lists it (see buildGroupSwitchKey); none for a rule of no group. */
    switchKey?: string;
}

/** The kinds whose answer only the game knows (a glow it fades): the engine of the ticks leaves them to their own services. */
export const HIDDEN_KINDS: ProcConditionKind[] = ["targetHealth", "myHealth"];

/** The kinds that take a value, and the ones that take none. */
export const VALUE_KINDS: ProcConditionKind[] = ["buff", "targetType", "targetHealth", "myHealth"];

/** The group of a rule of the player's on the health: always one (its glow can do less than the spell's row), by default its condition. */
export function findHealthGroup(rule: ProcRule): string {
    if (rule.group !== undefined && rule.group !== "") return rule.group;
    return string.format("%s below %d%%", rule.kind === "myHealth" ? "my health" : "target health", rule.value ?? 0);
}

/** Has the player switched this built-in rule off, with the rules on? (The rules on the health are lit by services of their own.) */
export function isBuiltInRuleOff(settings: AddonSettingsService, rule: ProcRule): boolean {
    return settings.get("shouldUseProcRules") && settings.get("disabledProcRules")[buildProcRuleKey(rule)] === true;
}

/**
 * The key of the switch of a group's row on the Procs tab, in the per-spell switches, by the spell's name ("group:Revenge:dodge"):
 * the rules of every rank of a spell with one group share it.
 */
export function buildGroupSwitchKey(spellName: string, group: string): string {
    return `group:${spellName}:${group}`;
}

/** The key a built-in rule is switched off by: its spell, its kind and its value ("20271:targetType:6"). */
export function buildProcRuleKey(rule: ProcRule): string {
    return rule.value !== undefined ? `${rule.spellId}:${rule.kind}:${rule.value}` : `${rule.spellId}:${rule.kind}`;
}

/** A rule the player added keeps only what a rule has: the engine's own fields are not theirs to set. */
export function repairProcRules(rules: unknown): ProcRule[] {
    if (type(rules) !== "table") return [];
    const repaired: ProcRule[] = [];
    for (const rule of rules as ProcRule[]) {
        if (type(rule) !== "table" || tonumber(rule.spellId) === undefined || !PROC_CONDITION_KINDS.includes(rule.kind)) continue;
        repaired.push({
            spellId: tonumber(rule.spellId)!,
            kind: rule.kind,
            value: tonumber(rule.value),
            result: rule.result === "noGlow" ? "noGlow" : "glow",
            priority: math.max(1, math.floor(tonumber(rule.priority) ?? 1)),
            group: type(rule.group) === "string" && rule.group !== "" ? rule.group : undefined,
            isOff: rule.isOff === true ? true : undefined,
        });
    }
    return repaired;
}
