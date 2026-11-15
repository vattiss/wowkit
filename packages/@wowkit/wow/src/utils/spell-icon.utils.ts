// The icons a spell can show on a button, as keys to find the button by: the last resort of the bar mapping.
import { readTextureKey } from "./item-button.utils";
import { attempt } from "./protected-call.utils";
import type { SpellsService } from "../spells.service";

/** An icon on more buttons than this tells nothing about which spell they hold. */
const MAX_BUTTONS_PER_ICON = 4;

/** The buttons that show the spell's icon, where few do (an icon many buttons share tells nothing). */
export function listIconButtons(
    spells: SpellsService,
    byIcon: LuaMap<number | string, ActionButton[]>,
    readMacros: LuaMap<ActionButton, boolean>,
    id: number | undefined,
    resolved: number | undefined,
): ActionButton[][] {
    const keys = new LuaSet<number | string>();
    addSpellIconKeys(id, spells.getSpellInfo(id), keys);
    addSpellIconKeys(resolved ?? id, spells.getSpellInfo(resolved ?? id), keys);
    const lists: ActionButton[][] = [];
    for (const key of keys) {
        const list = byIcon.get(key);
        // Not a macro whose text was read: a /target macro with the icon of a buff does not cast it
        if (list && list.length > 0 && list.length <= MAX_BUTTONS_PER_ICON) lists.push(list.filter((button) => !readMacros.has(button)));
    }
    return lists;
}

/** Adds the keys of the spell's icons (its texture now, its icon and its original icon) to `keys`. */
export function addSpellIconKeys(spellId: number | undefined, info: SpellInfo | undefined, keys: LuaSet<number | string>): void {
    if (spellId === undefined) return;
    const add = (value: unknown) => {
        const key = readTextureKey(value);
        if (key !== undefined) keys.add(key);
    };
    add(attempt(() => C_Spell.GetSpellTexture(spellId)));
    if (info) {
        add(info.iconID);
        add(info.originalIconID);
    }
}
