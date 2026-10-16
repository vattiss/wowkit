// Which buffs of the class list are missing.
import { findAura, hasAura } from "./api/auras";
import { isLearned, resolve, isCastable } from "./api/spells";
import { isInCombat } from "./api/unit";
import { isOnBars } from "./action-bars";
import { getClassBuffs, isBuffEnabled, type BuffStep } from "./buffs";
import { attempt } from "./util/safe";

export interface BuffCheck {
    isWanted: boolean;
    /** Why the buff is not asked for (shown in the debug report). */
    why?: string;
}

export interface MissingBuffs {
    /** The missing buffs on an action button that can be cast now: they glow (one per family). */
    glow: number[];
    /** Missing buffs on no button, one per family: named in a message. */
    notOnBars: number[];
}

/** Is this buff worth asking for now? */
export function checkBuff(step: BuffStep): BuffCheck {
    const id = resolve(step.id);
    if (id === undefined || !isLearned(id)) return { isWanted: false, why: "not learned yet" };
    if (step.isSwimmingOnly && attempt(IsSwimming) !== true) return { isWanted: false, why: "only while swimming" };
    for (const other of step.anyBuff ?? []) {
        if (hasAura(other)) return { isWanted: false, why: "a buff from the same group is already up" };
    }
    // A readable aura decides; while the client hides auras, the memory of the last sighting does
    const read = findAura(id);
    if (read.isFound) return { isWanted: false, why: "already active" };
    if ((read.isUnreadable || isInCombat()) && hasAura(id)) return { isWanted: false, why: "already active" };
    return { isWanted: true };
}

/**
 * Looks at the buffs of the list out of combat, whether or not a reminder is due, so the aura
 * memory knows them: a buff put on in town still counts once the client hides auras.
 */
export function rememberSelfBuffs(): void {
    if (isInCombat()) return;
    for (const step of getClassBuffs()) {
        if (isBuffEnabled(step)) {
            const id = resolve(step.id);
            if (id !== undefined) hasAura(id);
        }
    }
}

/**
 * The missing buffs in list order. Of a family (one aspect, one paladin aura) one is enough: the
 * first member on the bars glows; when a member is on the bars nothing of the family is named in
 * the "not on your bars" message, else the first one.
 */
export function findMissingBuffs(): MissingBuffs {
    const glow: number[] = [];
    const glowFamilies = new LuaSet<object>();
    const candidates: { id: number; family: object }[] = [];
    const familyOnBars = new LuaSet<object>();
    for (const step of getClassBuffs()) {
        if (isBuffEnabled(step) && checkBuff(step).isWanted) {
            const id = resolve(step.id) ?? step.id;
            const family = step.anyBuff ?? step;
            if (isOnBars(id)) {
                // Only a buff that can be cast now glows (Battle Shout waits for rage); one the
                // client gives no answer about still does
                if (isCastable(id) !== false && !glowFamilies.has(family)) {
                    glowFamilies.add(family);
                    glow.push(id);
                }
                familyOnBars.add(family);
            } else {
                candidates.push({ id, family });
            }
        }
    }
    const notOnBars: number[] = [];
    const named = new LuaSet<object>();
    for (const candidate of candidates) {
        if (!familyOnBars.has(candidate.family) && !named.has(candidate.family)) {
            named.add(candidate.family);
            notOnBars.push(candidate.id);
        }
    }
    return { glow, notOnBars };
}
