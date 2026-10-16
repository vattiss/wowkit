// Party members missing one of the player's buffs. Out of combat only (in combat the client hides
// other units' auras), party only (not raids), members online, alive and in range. When two or
// more miss a buff (of one class, for Greater Blessings) and the reagent is in the bags, the
// group version is suggested.
import { getUnitBuffState } from "./api/auras";
import { isLearned } from "./api/spells";
import { canReceiveBuffs, isInCombat, isInSpellRange, getPartyUnits, getUnitIdentity, doesUseMana } from "./api/unit";
import { getClassBuffs, isBuffEnabled, type BuffStep } from "./buffs";
import { hasReagentFor } from "./reagents";
import { settings } from "./settings";

export interface PartySuggestion {
    /** The spell to cast: the single buff or its group version. */
    spellId: number;
    /** Names of the members who miss it. */
    names: string[];
}

/** The group version is worth it from this many members missing the buff. */
const GROUP_MIN = 2;
/** Party auras are read at most this often. */
const REFRESH_SECONDS = 1;

let cachedAt = -10;
let cached: PartySuggestion[] = [];

interface Member {
    unit: UnitToken;
    name: string;
    classToken: string;
}

/** The buffs to check: enabled, learned, castable on others; one per family (the first). */
function getPartySteps(): BuffStep[] {
    const steps: BuffStep[] = [];
    const families = new LuaSet<object>();
    for (const step of getClassBuffs()) {
        const family = step.anyBuff ?? step;
        if (step.party && isBuffEnabled(step) && isLearned(step.id) && !families.has(family)) {
            families.add(family);
            steps.push(step);
        }
    }
    return steps;
}

/** The highest learned rank of the group version that has its reagent. */
function findUsableGroupSpell(step: BuffStep): number | undefined {
    const ranks = step.party?.groupIds ?? [];
    for (let i = ranks.length - 1; i >= 0; i--) {
        const id = ranks[i]!;
        if (isLearned(id)) return hasReagentFor(id) ? id : undefined;
    }
    return undefined;
}

function buildSuggestionsFor(step: BuffStep, members: Member[]): PartySuggestion[] {
    const party = step.party!;
    const missing = members.filter(
        (member) =>
            (!party.isManaOnly || doesUseMana(member.unit)) &&
            isInSpellRange(step.id, member.unit) &&
            getUnitBuffState(member.unit, step.id, party.isOwnOnly === true) === "missing",
    );
    if (missing.length === 0) return [];
    const groupSpell = findUsableGroupSpell(step);
    if (groupSpell === undefined) return [{ spellId: step.id, names: missing.map((m) => m.name) }];
    if (!party.isPerClass) {
        return [{ spellId: missing.length >= GROUP_MIN ? groupSpell : step.id, names: missing.map((m) => m.name) }];
    }
    // Greater Blessings cover one class: the group version for classes with enough members missing
    const byClass = new LuaMap<string, string[]>();
    for (const member of missing) {
        const names = byClass.get(member.classToken) ?? [];
        names.push(member.name);
        byClass.set(member.classToken, names);
    }
    const out: PartySuggestion[] = [];
    const singles: string[] = [];
    for (const [, names] of byClass) {
        if (names.length >= GROUP_MIN) out.push({ spellId: groupSpell, names });
        else singles.push(...names);
    }
    if (singles.length > 0) out.push({ spellId: step.id, names: singles });
    return out;
}

/** What to cast on whom; empty in combat, in raids, or when the feature is off. */
export function findPartyBuffSuggestions(): PartySuggestion[] {
    if (!settings.showPartyBuffs || isInCombat()) return [];
    const now = GetTime();
    if (now - cachedAt < REFRESH_SECONDS) return cached;
    cachedAt = now;
    const members: Member[] = getPartyUnits()
        .filter((unit) => canReceiveBuffs(unit))
        .map((unit) => ({ unit, ...getUnitIdentity(unit) }));
    cached = members.length === 0 ? [] : getPartySteps().flatMap((step) => buildSuggestionsFor(step, members));
    return cached;
}

/** Read the party again on the next call (roster or auras changed). */
export function refreshPartyBuffs(): void {
    cachedAt = -10;
}
