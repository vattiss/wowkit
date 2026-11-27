// The words of the proc rules in the table: what a rule's condition says ("Buff up: Holy Shield", "Target: Undead"), and the
// conditions the add row offers, each creature type a choice of its own.
import type { SpellsService } from "@wowkit/wow";
import type { AddonLocale } from "../locale/locale.interface";
import type { TextKey } from "../locale/texts.constants";
import { CREATURE_TYPES } from "../glows/proc-rules.constants";
import type { ProcConditionKind, ProcRule } from "../glows/proc-rules.interface";

/** The words of each kind; a creature type's are "Target: <type>". */
const KIND_TEXTS: { [kind in ProcConditionKind]: TextKey } = {
    usable: "COND_USABLE",
    buff: "COND_BUFF",
    targetType: "COND_TARGET",
    afterBlock: "COND_AFTER_BLOCK",
    afterDodge: "COND_AFTER_DODGE",
    afterParry: "COND_AFTER_PARRY",
    targetDodged: "COND_TARGET_DODGED",
    free: "COND_FREE",
    instant: "COND_INSTANT",
    inRange: "COND_IN_RANGE",
    targetHealth: "COND_TARGET_HEALTH",
    myHealth: "COND_MY_HEALTH",
};

/** The creature types a rule can ask for, in the order of the list, with their words. */
const CREATURE_TEXTS: [creatureType: number, text: TextKey][] = [
    [CREATURE_TYPES.Undead, "CREATURE_UNDEAD"],
    [CREATURE_TYPES.Demon, "CREATURE_DEMON"],
    [CREATURE_TYPES.Beast, "CREATURE_BEAST"],
    [CREATURE_TYPES.Dragonkin, "CREATURE_DRAGONKIN"],
    [CREATURE_TYPES.Elemental, "CREATURE_ELEMENTAL"],
    [CREATURE_TYPES.Giant, "CREATURE_GIANT"],
    [CREATURE_TYPES.Humanoid, "CREATURE_HUMANOID"],
    [CREATURE_TYPES.Mechanical, "CREATURE_MECHANICAL"],
];

/** A condition the add row offers: its kind, and the creature type for a target's. */
export interface ConditionChoice {
    kind: ProcConditionKind;
    creatureType?: number;
}

/** The conditions of the add row, in its list's order. */
export const CONDITION_CHOICES: ConditionChoice[] = [
    { kind: "usable" },
    { kind: "buff" },
    ...CREATURE_TEXTS.map(([creatureType]) => ({ kind: "targetType" as const, creatureType })),
    { kind: "afterBlock" },
    { kind: "afterDodge" },
    { kind: "afterParry" },
    { kind: "targetDodged" },
    { kind: "free" },
    { kind: "instant" },
    { kind: "inRange" },
    { kind: "targetHealth" },
    { kind: "myHealth" },
];

/** The words of a condition of the add row's list. */
export function describeChoice(choice: ConditionChoice, locale: AddonLocale): string {
    if (choice.kind !== "targetType") return locale.getText(KIND_TEXTS[choice.kind]);
    const creature = CREATURE_TEXTS.find(([creatureType]) => creatureType === choice.creatureType)?.[1];
    return string.format(locale.getText("COND_TARGET"), creature !== undefined ? locale.getText(creature) : "?");
}

/** What a rule's condition says: its kind, with its buff, creature type or percent. */
export function describeCondition(rule: ProcRule, locale: AddonLocale, spells: SpellsService): string {
    if (rule.kind === "targetType") return describeChoice({ kind: rule.kind, creatureType: rule.value }, locale);
    const words = locale.getText(KIND_TEXTS[rule.kind]);
    if (rule.kind === "buff") {
        const buff = rule.value !== undefined ? (spells.getSpellLabel(rule.value) ?? string.format("%d", rule.value)) : "?";
        return `${words}: ${buff}`;
    }
    if (rule.kind === "targetHealth" || rule.kind === "myHealth") return string.format("%s %d%%", words, rule.value ?? 0);
    return words;
}
