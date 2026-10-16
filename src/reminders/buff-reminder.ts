// Which buffs of the class list are missing.
import { hasAura } from "../wow/auras";
import { isLearned, resolve, isCastable } from "../wow/spells";
import { isInCombat, isSwimming } from "../wow/player";
import { isOnBars } from "../wow/action-bars";
import { getClassBuffs, isBuffEnabled, type ClassBuff } from "./class-buffs";

export interface BuffCheck {
    isWanted: boolean;
    /** Why the buff is not asked for (shown in the debug report). */
    why?: string;
}

export interface MissingBuffs {
    /** The missing buffs on an action button that can be cast now: they glow (one per category). */
    glow: number[];
    /** Missing buffs on no button, one per category: named in a message. */
    notOnBars: number[];
}

/** Is this buff worth asking for now? */
export function checkBuff(classBuff: ClassBuff): BuffCheck {
    const id = resolve(classBuff.id);
    if (id === undefined || !isLearned(id)) return { isWanted: false, why: "not learned yet" };
    if (classBuff.isSwimmingOnly && !isSwimming()) return { isWanted: false, why: "only while swimming" };
    for (const other of classBuff.categoryMembers ?? []) {
        if (hasAura(other)) return { isWanted: false, why: "a buff from the same category is already up" };
    }
    // hasAura reads the aura, and falls back on what was seen or cast while the client hides auras
    if (hasAura(id)) return { isWanted: false, why: "already active" };
    return { isWanted: true };
}

/**
 * Looks at the buffs of the list out of combat, whether or not a reminder is due, so the aura
 * memory knows them: a buff put on in town still counts once the client hides auras.
 */
export function rememberSelfBuffs(): void {
    if (isInCombat()) return;
    for (const classBuff of getClassBuffs()) {
        if (isBuffEnabled(classBuff)) {
            const id = resolve(classBuff.id);
            if (id !== undefined) hasAura(id);
        }
    }
}

/**
 * The missing buffs in list order. Of a category (one aspect, one paladin aura) one is enough: the
 * first member on the bars glows; when a member is on the bars nothing of the category is named in
 * the "not on your bars" message, else the first one.
 */
export function findMissingBuffs(): MissingBuffs {
    const glow: number[] = [];
    const glowCategories = new LuaSet<object>();
    const candidates: { id: number; category: object }[] = [];
    const categoryOnBars = new LuaSet<object>();
    for (const classBuff of getClassBuffs()) {
        if (isBuffEnabled(classBuff) && checkBuff(classBuff).isWanted) {
            const id = resolve(classBuff.id) ?? classBuff.id;
            const category = classBuff.categoryMembers ?? classBuff;
            if (isOnBars(id)) {
                // Only a buff that can be cast now glows (Battle Shout waits for rage); one the
                // client gives no answer about still does
                if (isCastable(id) !== false && !glowCategories.has(category)) {
                    glowCategories.add(category);
                    glow.push(id);
                }
                categoryOnBars.add(category);
            } else {
                candidates.push({ id, category });
            }
        }
    }
    const notOnBars: number[] = [];
    const named = new LuaSet<object>();
    for (const candidate of candidates) {
        if (!categoryOnBars.has(candidate.category) && !named.has(candidate.category)) {
            named.add(candidate.category);
            notOnBars.push(candidate.id);
        }
    }
    return { glow, notOnBars };
}
