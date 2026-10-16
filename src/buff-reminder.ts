// Which buffs of the class list are missing.
import { findAura, hasAura } from "./api/auras";
import { known, resolve, spellUsable } from "./api/spells";
import { inCombat } from "./api/unit";
import { isOnBars } from "./action-bars";
import { classBuffs, isBuffEnabled, type BuffStep } from "./buffs";
import { attempt } from "./util/safe";

export interface BuffCheck {
    wanted: boolean;
    /** Why the buff is not asked for (shown in the debug report). */
    why?: string;
}

export interface MissingBuffs {
    /** The first missing buff that is on an action button and can be cast now: it glows. */
    glow?: number;
    /** Missing buffs on no button, one per family: named in a message. */
    notOnBars: number[];
}

/** Is this buff worth asking for now? */
export function checkBuff(step: BuffStep): BuffCheck {
    const id = resolve(step.id);
    if (id === undefined || !known(id)) return { wanted: false, why: "not learned yet" };
    if (step.swimming && attempt(IsSwimming) !== true) return { wanted: false, why: "only while swimming" };
    for (const other of step.anyBuff ?? []) {
        if (hasAura(other)) return { wanted: false, why: "a buff from the same group is already up" };
    }
    // A readable aura decides; while the client hides auras, the memory of the last sighting does
    const read = findAura(id);
    if (read.found) return { wanted: false, why: "already active" };
    if ((read.unreadable || inCombat()) && hasAura(id)) return { wanted: false, why: "already active" };
    return { wanted: true };
}

/**
 * Looks at the buffs of the list out of combat, whether or not a reminder is due, so the aura
 * memory knows them: a buff put on in town still counts once the client hides auras.
 */
export function rememberSelfBuffs(): void {
    if (inCombat()) return;
    for (const step of classBuffs()) {
        if (isBuffEnabled(step)) {
            const id = resolve(step.id);
            if (id !== undefined) hasAura(id);
        }
    }
}

/**
 * The missing buffs in list order. Of a family (one aspect, one paladin aura) one is enough: when
 * a member is on the bars nothing of the family is named, else the first one.
 */
export function missingBuffs(): MissingBuffs {
    let glow: number | undefined;
    const candidates: { id: number; family: object }[] = [];
    const familyOnBars = new LuaSet<object>();
    for (const step of classBuffs()) {
        if (isBuffEnabled(step) && checkBuff(step).wanted) {
            const id = resolve(step.id) ?? step.id;
            const family = step.anyBuff ?? step;
            if (isOnBars(id)) {
                // Only a buff that can be cast now glows (Battle Shout waits for rage); one the
                // client gives no answer about still does
                if (spellUsable(id) !== false) glow ??= id;
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
