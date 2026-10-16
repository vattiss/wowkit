// Which weapon buff the player should keep up: the player's pick if learned, else the best one
// already learned.
import { getHintName, isLearned, resolve, resolveFromName, getSpellName, spellsInvalidated } from "../wow/spells";
import { getClassToken, isOffhandWeaponEquipped } from "../wow/player";
import { OFFHAND_PRIORITY, WEAPON_BUFF_BY_SPELL, WEAPON_BUFFS, WEAPON_PRIORITY, type WeaponBuff } from "../data/weapon-buffs";
import { settings } from "../settings";
import { contains } from "../util/text";

export interface PickedWeaponBuff {
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

export function getWeaponChoices(): WeaponBuff[] {
    const token = getClassToken();
    return (token !== undefined ? WEAPON_BUFFS[token] : undefined) ?? [];
}

/** The highest learned rank of this weapon buff. */
function findLearnedId(entry: WeaponBuff | undefined): number | undefined {
    if (!entry) return undefined;
    const ranks = entry.ranks ?? [];
    for (let i = ranks.length - 1; i >= 0; i--) {
        if (isLearned(ranks[i])) return ranks[i];
    }
    // The ID must still name this buff (a client can give an old ID to another spell); otherwise
    // the name decides (rogue poisons carry their name)
    if (isLearned(entry.id) && (entry.name === undefined || getSpellName(resolve(entry.id) ?? entry.id) === entry.name)) return entry.id;
    if (entry.name !== undefined) {
        const byName = resolveFromName(entry.name);
        if (byName !== undefined && isLearned(byName)) return byName;
    }
    return undefined;
}

function createPickedWeaponBuff(entry: WeaponBuff | undefined): PickedWeaponBuff | undefined {
    const spellId = findLearnedId(entry);
    return entry && spellId !== undefined ? { entry, spellId } : undefined;
}

export function isWeaponBuffLearned(entry: WeaponBuff): boolean {
    return findLearnedId(entry) !== undefined;
}

/** The class coats both weapons (rogue). */
export function hasOffhandChoice(): boolean {
    const token = getClassToken();
    return token !== undefined && OFFHAND_PRIORITY[token] !== undefined;
}

/** The class coats both weapons and an off-hand weapon is equipped. */
export function isCoatingBothWeapons(): boolean {
    return hasOffhandChoice() && isOffhandWeaponEquipped();
}

/** The automatic pick: the best weapon buff already learned. */
export function findAutomaticWeaponBuff(isOffhand: boolean): PickedWeaponBuff | undefined {
    const choices = getWeaponChoices();
    const token = getClassToken();
    const order = token !== undefined ? (isOffhand ? OFFHAND_PRIORITY : WEAPON_PRIORITY)[token] : undefined;
    for (const key of order ?? []) {
        const found = createPickedWeaponBuff(choices.find((choice) => choice.key === key));
        if (found) return found;
    }
    for (const entry of choices) {
        const found = createPickedWeaponBuff(entry);
        if (found) return found;
    }
    return undefined;
}

/** The player's pick if it is learned, otherwise the automatic one. */
export function findSelectedWeaponBuff(isOffhand = false): PickedWeaponBuff | undefined {
    const key = isOffhand ? settings.weaponBuffOff : settings.weaponBuff;
    const chosen = key !== undefined && key !== "auto" ? createPickedWeaponBuff(getWeaponChoices().find((choice) => choice.key === key)) : undefined;
    return chosen ?? findAutomaticWeaponBuff(isOffhand);
}

function getWeaponNameSet(): LuaSet<string> {
    if (weaponNames && !weaponNames.isEmpty()) return weaponNames;
    weaponNames = new LuaSet();
    for (const [, list] of pairs(WEAPON_BUFFS)) {
        for (const entry of list ?? []) {
            const name = getSpellName(entry.id);
            if (name !== undefined) weaponNames.add(name);
            if (entry.name !== undefined) weaponNames.add(entry.name);
        }
    }
    return weaponNames;
}

function doesMatchName(entry: WeaponBuff, name: string): boolean {
    const lower = string.lower(name);
    if (entry.match.some((token) => token !== "" && contains(lower, token))) return true;
    return [entry.id, ...(entry.ranks ?? [])].some((id) => {
        const spell = getSpellName(id);
        return spell !== undefined && string.lower(spell) === lower;
    });
}

/** The weapon buff a cast put on, by spell ID, by a rank the table misses, or by the cast name. */
export function findWeaponBuffForCast(spellId: number | undefined, castName: string | undefined): WeaponBuff | undefined {
    if (spellId !== undefined) {
        const entry = WEAPON_BUFF_BY_SPELL.get(spellId);
        if (entry) return entry;
        const name = getSpellName(spellId);
        const selected = name !== undefined && getWeaponNameSet().has(name) ? findSelectedWeaponBuff()?.entry : undefined;
        if (selected) return selected;
    }
    if (castName !== undefined) return getWeaponChoices().find((choice) => doesMatchName(choice, castName));
    return undefined;
}

/** Lowercase texts that show the buff in a weapon tooltip. */
export function getWeaponMatchTokens(entry: WeaponBuff): string[] {
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
        add(getSpellName(id));
        add(getHintName(id));
    }
    tokenCache.set(entry, tokens);
    return tokens;
}
