// Party members missing one of the player's buffs. Out of combat only (in combat the client hides
// other units' auras), party only (not raids), members online, alive and in range. When two or
// more miss a buff (of one class, for Greater Blessings) and the reagent is in the bags, the
// group version is suggested.
import { getUnitBuffState } from "../wow/auras";
import { isLearned } from "../wow/spells";
import { getCurrentTime } from "../wow/clock";
import { canReceiveBuffs, doesUseMana, getPartyUnits, getUnitIdentity, isInSpellRange } from "../wow/party";
import { isInCombat } from "../wow/player";
import { getClassBuffs, isBuffEnabled, type ClassBuff } from "./class-buffs";
import { hasReagentFor } from "./reagents";
import { settings } from "../settings";

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

/** The buffs to check: enabled, learned, castable on others; one per category (the first). */
function getPartyBuffs(): ClassBuff[] {
    const classBuffs: ClassBuff[] = [];
    const categories = new LuaSet<object>();
    for (const classBuff of getClassBuffs()) {
        const category = classBuff.categoryMembers ?? classBuff;
        if (classBuff.party && isBuffEnabled(classBuff) && isLearned(classBuff.id) && !categories.has(category)) {
            categories.add(category);
            classBuffs.push(classBuff);
        }
    }
    return classBuffs;
}

/** The highest learned rank of the group version that has its reagent. */
function findUsableGroupSpell(classBuff: ClassBuff): number | undefined {
    const ranks = classBuff.party?.groupIds ?? [];
    for (let i = ranks.length - 1; i >= 0; i--) {
        const id = ranks[i]!;
        if (isLearned(id)) return hasReagentFor(id) ? id : undefined;
    }
    return undefined;
}

function buildSuggestionsFor(classBuff: ClassBuff, members: Member[]): PartySuggestion[] {
    const party = classBuff.party!;
    const missing = members.filter(
        (member) =>
            (!party.isManaOnly || doesUseMana(member.unit)) &&
            isInSpellRange(classBuff.id, member.unit) &&
            getUnitBuffState(member.unit, classBuff.id, party.isOwnOnly === true) === "missing",
    );
    if (missing.length === 0) return [];
    const groupSpell = findUsableGroupSpell(classBuff);
    if (groupSpell === undefined) return [{ spellId: classBuff.id, names: missing.map((m) => m.name) }];
    if (!party.isPerClass) {
        return [{ spellId: missing.length >= GROUP_MIN ? groupSpell : classBuff.id, names: missing.map((m) => m.name) }];
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
    if (singles.length > 0) out.push({ spellId: classBuff.id, names: singles });
    return out;
}

/** What to cast on whom; empty in combat, in raids, or when the feature is off. */
export function findPartyBuffSuggestions(): PartySuggestion[] {
    if (!settings.showPartyBuffs || isInCombat()) return [];
    const now = getCurrentTime();
    if (now - cachedAt < REFRESH_SECONDS) return cached;
    cachedAt = now;
    const members: Member[] = getPartyUnits()
        .filter((unit) => canReceiveBuffs(unit))
        .map((unit) => ({ unit, ...getUnitIdentity(unit) }));
    cached = members.length === 0 ? [] : getPartyBuffs().flatMap((classBuff) => buildSuggestionsFor(classBuff, members));
    return cached;
}

/** Read the party again on the next call (roster or auras changed). */
export function refreshPartyBuffs(): void {
    cachedAt = -10;
}
