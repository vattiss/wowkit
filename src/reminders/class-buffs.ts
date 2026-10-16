// The buff list of the player's class and the per-character switch of each buff.
import { getSpellName } from "../wow/spells";
import { BUFF_LISTS, type ClassBuff } from "../data/buff-lists";
import { changeSetting, settings } from "../settings";
import { getClassToken } from "../wow/player";

/** The buffs of the player's class, in list order. */
export function getClassBuffs(): ClassBuff[] {
    const token = getClassToken();
    return (token !== undefined ? BUFF_LISTS[token] : undefined) ?? [];
}

/**
 * How long a buff that was seen or cast counts as up while the client hides the auras: the `last`
 * of its list entry (matched by ID or name), else 30 seconds.
 */
export function getBuffSeconds(spellId: number | undefined, name: string): number {
    for (const classBuff of getClassBuffs()) {
        if (classBuff.last !== undefined && (classBuff.id === spellId || getSpellName(classBuff.id) === name)) return classBuff.last;
    }
    return 30;
}

export function isBuffEnabled(classBuff: ClassBuff): boolean {
    return settings.buffOn[classBuff.key] ?? classBuff.isOnByDefault;
}

/** Switches one buff on or off; the default is not stored. */
export function setBuffEnabled(classBuff: ClassBuff, isOn: boolean): void {
    const buffOn = { ...settings.buffOn };
    buffOn[classBuff.key] = isOn === classBuff.isOnByDefault ? undefined : isOn;
    changeSetting("buffOn", buffOn);
}

export type { ClassBuff };
