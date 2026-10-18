// Party members missing one of the player's buffs. Out of combat only (in combat the client hides
// other units' auras), party only (not raids), members online, alive and in range. When two or
// more miss a buff (of one class, for Greater Blessings) and the reagent is in the bags, the
// group version is suggested.

import type { BuffStateService } from "../character/buff-state.service";
import type { AddonSettingsService } from "../settings/settings.interface";
import type { ReagentsService } from "@forever-reminders/shared";
import type { ClockService, PartyService, PlayerService, SpellsService } from "@wowkit/wow";
import type { ClassBuff } from "./class-buff.interface";
import type { ClassBuffsService } from "./class-buffs.service";
import type { PartySuggestion } from "./reminders.interface";

/** The group version is worth it from this many members missing the buff. */
const GROUP_MIN = 2;
/** Party auras are read at most this often. */
const REFRESH_SECONDS = 1;

interface Member {
    unit: UnitToken;
    name: string;
    classToken: string;
}

export class PartyBuffsService {
    private cachedAt = -10;
    private cached: PartySuggestion[] = [];

    constructor(
        private readonly auras: BuffStateService,
        private readonly spells: SpellsService,
        private readonly clock: ClockService,
        private readonly party: PartyService,
        private readonly player: PlayerService,
        private readonly classBuffs: ClassBuffsService,
        private readonly reagents: ReagentsService,
        private readonly settings: AddonSettingsService,
    ) {}

    /** What to cast on whom; empty in combat, in raids, or when the feature is off. */
    findPartyBuffSuggestions(): PartySuggestion[] {
        if (!this.settings.get("showPartyBuffs") || this.player.isInCombat() || this.party.isInRaid()) return [];
        const now = this.clock.getCurrentTime();
        if (now - this.cachedAt < REFRESH_SECONDS) return this.cached;
        this.cachedAt = now;
        const members: Member[] = this.party
            .getPartyUnits()
            .filter((unit) => this.party.isReachable(unit))
            .map((unit) => ({ unit, ...this.party.getUnitIdentity(unit) }));
        this.cached = members.length === 0 ? [] : this.getPartyBuffs().flatMap((classBuff) => this.buildSuggestionsFor(classBuff, members));
        return this.cached;
    }

    /** Read the party again on the next call (roster or auras changed). */
    refreshPartyBuffs(): void {
        this.cachedAt = -10;
    }

    /** The buffs to check: enabled, learned, castable on others; one per category (the first). */
    private getPartyBuffs(): ClassBuff[] {
        const classBuffs: ClassBuff[] = [];
        const categories = new LuaSet<object>();
        for (const classBuff of this.classBuffs.getClassBuffs()) {
            const category = classBuff.categoryMembers ?? classBuff;
            if (
                classBuff.party &&
                this.classBuffs.isBuffEnabled(classBuff) &&
                this.spells.isLearned(classBuff.id) &&
                !categories.has(category)
            ) {
                categories.add(category);
                classBuffs.push(classBuff);
            }
        }
        return classBuffs;
    }

    /** The highest learned rank of the group version that has its reagent. */
    private findUsableGroupSpell(classBuff: ClassBuff): number | undefined {
        const ranks = classBuff.party?.groupIds ?? [];
        for (let i = ranks.length - 1; i >= 0; i--) {
            const id = ranks[i]!;
            if (this.spells.isLearned(id)) return this.reagents.hasReagentFor(id) ? id : undefined;
        }
        return undefined;
    }

    private buildSuggestionsFor(classBuff: ClassBuff, members: Member[]): PartySuggestion[] {
        const party = classBuff.party!;
        const missing = members.filter(
            (member) =>
                (!party.isManaOnly || this.party.doesUseMana(member.unit)) &&
                this.party.isInSpellRange(classBuff.id, member.unit) &&
                this.auras.getUnitBuffState(member.unit, classBuff.id, party.isOwnOnly === true) === "missing",
        );
        if (missing.length === 0) return [];
        const groupSpell = this.findUsableGroupSpell(classBuff);
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
}
