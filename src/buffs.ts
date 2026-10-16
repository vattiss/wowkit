// The buff list of the player's class and the per-character switch of each buff.
import { spellName } from "./api/spells";
import { BUFF_LISTS, type BuffStep } from "./data/buff-lists";
import { changeSetting, settings } from "./settings";
import { readable } from "./util/safe";

/** The player's class token ("PRIEST"). */
export function classToken(): string | undefined {
    const [, classFile] = UnitClass("player");
    if (classFile !== undefined && readable(classFile)) return string.upper(classFile);
    const [base] = UnitClassBase("player");
    if (base !== undefined && readable(base)) return string.upper(base);
    return undefined;
}

/** The buffs of the player's class, in list order. */
export function classBuffs(): BuffStep[] {
    const token = classToken();
    return (token !== undefined ? BUFF_LISTS[token] : undefined) ?? [];
}

/**
 * How long a buff that was seen or cast counts as up while the client hides the auras: the `last`
 * of its list entry (matched by ID or name), else 30 seconds.
 */
export function buffSeconds(spellId: number | undefined, name: string): number {
    for (const step of classBuffs()) {
        if (step.last !== undefined && (step.id === spellId || spellName(step.id) === name)) return step.last;
    }
    return 30;
}

export function isBuffEnabled(step: BuffStep): boolean {
    return settings.buffOn[step.key] ?? step.onByDefault;
}

/** Switches one buff on or off; the default is not stored. */
export function setBuffEnabled(step: BuffStep, on: boolean): void {
    const buffOn = { ...settings.buffOn };
    buffOn[step.key] = on === step.onByDefault ? undefined : on;
    changeSetting("buffOn", buffOn);
}

export type { BuffStep };
