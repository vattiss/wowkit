// The icons a spell can show on a button, as keys to find the button by: the last resort of the bar mapping.
import { readTextureKey } from "./item-button.utils";
import { attempt } from "./protected-call.utils";

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
