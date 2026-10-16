// The buff list of the player's class and the per-character switch of each buff.
import { getSpellName } from "../wow/spells";
import { BUFF_LISTS, type BuffStep } from "../data/buff-lists";
import { changeSetting, settings } from "../settings";
import { getClassToken } from "../wow/player";

/** The buffs of the player's class, in list order. */
export function getClassBuffs(): BuffStep[] {
    const token = getClassToken();
    return (token !== undefined ? BUFF_LISTS[token] : undefined) ?? [];
}

/**
 * How long a buff that was seen or cast counts as up while the client hides the auras: the `last`
 * of its list entry (matched by ID or name), else 30 seconds.
 */
export function getBuffSeconds(spellId: number | undefined, name: string): number {
    for (const step of getClassBuffs()) {
        if (step.last !== undefined && (step.id === spellId || getSpellName(step.id) === name)) return step.last;
    }
    return 30;
}

export function isBuffEnabled(step: BuffStep): boolean {
    return settings.buffOn[step.key] ?? step.isOnByDefault;
}

/** Switches one buff on or off; the default is not stored. */
export function setBuffEnabled(step: BuffStep, isOn: boolean): void {
    const buffOn = { ...settings.buffOn };
    buffOn[step.key] = isOn === step.isOnByDefault ? undefined : isOn;
    changeSetting("buffOn", buffOn);
}

export type { BuffStep };
