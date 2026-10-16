// Which weapon buff the player should keep up: the player's pick if learned, else the best one
// already learned.
import { hintName, known, resolve, resolveFromName, spellName, spellsInvalidated } from "./api/spells";
import { classToken } from "./buffs";
import { OFF_HAND_SLOT } from "./constants";
import { OFFHAND_PRIORITY, WEAPON_BUFF_BY_SPELL, WEAPON_BUFFS, WEAPON_PRIORITY, type WeaponBuff } from "./data/weapon-buffs";
import { settings } from "./settings";
import { attempt } from "./util/safe";
import { contains } from "./util/text";

export interface WeaponPick {
    entry: WeaponBuff;
    /** The highest learned rank. */
    spellId: number;
}

let weaponNames: LuaSet<string> | undefined;
const tokenCache = new LuaMap<WeaponBuff, string[]>();

spellsInvalidated.listen(() => {
    weaponNames = undefined;
    for (const [entry] of tokenCache) tokenCache.delete(entry);
});

export function weaponChoices(): WeaponBuff[] {
    const token = classToken();
    return (token !== undefined ? WEAPON_BUFFS[token] : undefined) ?? [];
}

/** The highest learned rank of this weapon buff. */
function learnedId(entry: WeaponBuff | undefined): number | undefined {
    if (!entry) return undefined;
    const ranks = entry.ranks ?? [];
    for (let i = ranks.length - 1; i >= 0; i--) {
        if (known(ranks[i])) return ranks[i];
    }
    // The ID must still name this buff (a client can give an old ID to another spell); otherwise
    // the name decides (rogue poisons carry their name)
    if (known(entry.id) && (entry.name === undefined || spellName(resolve(entry.id) ?? entry.id) === entry.name)) return entry.id;
    if (entry.name !== undefined) {
        const byName = resolveFromName(entry.name);
        if (byName !== undefined && known(byName)) return byName;
    }
    return undefined;
}

function pick(entry: WeaponBuff | undefined): WeaponPick | undefined {
    const spellId = learnedId(entry);
    return entry && spellId !== undefined ? { entry, spellId } : undefined;
}

export function weaponBuffLearned(entry: WeaponBuff): boolean {
    return learnedId(entry) !== undefined;
}

/** The class coats both weapons (rogue). */
export function weaponHasOffhandChoice(): boolean {
    const token = classToken();
    return token !== undefined && OFFHAND_PRIORITY[token] !== undefined;
}

/** The class coats both weapons and an off-hand weapon is equipped. */
export function weaponIsDual(): boolean {
    if (!weaponHasOffhandChoice()) return false;
    const itemId = attempt(GetInventoryItemID, "player", OFF_HAND_SLOT);
    if (itemId === undefined || type(itemId) !== "number") return false;
    const [, , , , , classId] = C_Item.GetItemInfoInstant(itemId);
    return classId === Enum.ItemClass.Weapon;
}

/** The automatic pick: the best weapon buff already learned. */
export function autoWeaponBuff(offhand: boolean): WeaponPick | undefined {
    const choices = weaponChoices();
    const token = classToken();
    const order = token !== undefined ? (offhand ? OFFHAND_PRIORITY : WEAPON_PRIORITY)[token] : undefined;
    for (const key of order ?? []) {
        const found = pick(choices.find((choice) => choice.key === key));
        if (found) return found;
    }
    for (const entry of choices) {
        const found = pick(entry);
        if (found) return found;
    }
    return undefined;
}

/** The player's pick if it is learned, otherwise the automatic one. */
export function selectedWeaponBuff(offhand = false): WeaponPick | undefined {
    const key = offhand ? settings.weaponBuffOff : settings.weaponBuff;
    const chosen = key !== undefined && key !== "auto" ? pick(weaponChoices().find((choice) => choice.key === key)) : undefined;
    return chosen ?? autoWeaponBuff(offhand);
}

function weaponNameSet(): LuaSet<string> {
    if (weaponNames && !weaponNames.isEmpty()) return weaponNames;
    weaponNames = new LuaSet();
    for (const [, list] of pairs(WEAPON_BUFFS)) {
        for (const entry of list ?? []) {
            const name = spellName(entry.id);
            if (name !== undefined) weaponNames.add(name);
            if (entry.name !== undefined) weaponNames.add(entry.name);
        }
    }
    return weaponNames;
}

function matchesName(entry: WeaponBuff, name: string): boolean {
    const lower = string.lower(name);
    if (entry.match.some((token) => token !== "" && contains(lower, token))) return true;
    return [entry.id, ...(entry.ranks ?? [])].some((id) => {
        const spell = spellName(id);
        return spell !== undefined && string.lower(spell) === lower;
    });
}

/** The weapon buff a cast put on, by spell ID, by a rank the table misses, or by the cast name. */
export function weaponBuffForCast(spellId: number | undefined, castName: string | undefined): WeaponBuff | undefined {
    if (spellId !== undefined && !issecretvalue(spellId)) {
        const entry = WEAPON_BUFF_BY_SPELL.get(spellId);
        if (entry) return entry;
        const name = spellName(spellId);
        const selected = name !== undefined && weaponNameSet().has(name) ? selectedWeaponBuff()?.entry : undefined;
        if (selected) return selected;
    }
    if (castName !== undefined) return weaponChoices().find((choice) => matchesName(choice, castName));
    return undefined;
}

/** Lowercase texts that show the buff in a weapon tooltip. */
export function weaponMatchTokens(entry: WeaponBuff): string[] {
    const cached = tokenCache.get(entry);
    if (cached) return cached;
    const tokens: string[] = [];
    const add = (token: string | undefined) => {
        if (token === undefined || token === "") return;
        const key = string.lower(token);
        if (!tokens.includes(key)) tokens.push(key);
    };
    for (const token of entry.match) add(token);
    for (const id of [entry.id, ...(entry.ranks ?? [])]) {
        add(spellName(id));
        add(hintName(id));
    }
    tokenCache.set(entry, tokens);
    return tokens;
}
