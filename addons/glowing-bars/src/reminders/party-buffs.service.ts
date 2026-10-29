// Party members missing one of the player's buffs. Out of combat only (in combat the client hides
// other units' auras), party only (not raids), members online, alive and in range. When two or
// more miss a buff (of one class, for Greater Blessings) and the reagent is in the bags, the
// group version is suggested. Of a group the one the player wants is asked for: the one cast last, else the main talent
// tree's, else the first. A blessing goes by the member's class: the one the player last gave that class (seen on its
// members), else Wisdom for a class with mana and Kings, else Might, for the others.

import type { BuffStateService } from "../character/buff-state.service";
import type { AddonSettingsService } from "../settings/settings.interface";
import type { ReagentsService } from "../reagents/reagents.service";
import type { ClockService, PartyService, PlayerService, SpellsService } from "@wowkit/wow";
import type { ClassBuff } from "./class-buff.interface";
import { PARTY_BLESSINGS } from "./class-buffs.constants";
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
        this.cached = members.length === 0 ? [] : this.listPartyGroups().flatMap((group) => this.buildGroupSuggestions(group, members));
        return this.cached;
    }

    /** Read the party again on the next call (roster or auras changed). */
    refreshPartyBuffs(): void {
        this.cachedAt = -10;
    }

    /** The buffs to check, by category: enabled, learned, castable on others. */
    private listPartyGroups(): ClassBuff[][] {
        const groups: ClassBuff[][] = [];
        const groupOf = new LuaMap<object, ClassBuff[]>();
        for (const classBuff of this.classBuffs.getClassBuffs()) {
            if (!classBuff.party || !this.classBuffs.isBuffEnabled(classBuff) || !this.spells.isLearned(classBuff.id)) continue;
            const category = classBuff.categoryMembers ?? classBuff;
            let members = groupOf.get(category);
            if (members === undefined) {
                members = [];
                groupOf.set(category, members);
                groups.push(members);
            }
            members.push(classBuff);
        }
        return groups;
    }

    /** The suggestions of one category: the buff the player wants for all, or a blessing for each member's class. */
    private buildGroupSuggestions(group: ClassBuff[], members: Member[]): PartySuggestion[] {
        if (!group[0]!.party!.isPerClass) return this.buildSuggestionsFor(this.classBuffs.pickGroupBuff(group), members);
        this.noteGivenBlessings(group, members);
        const buffs: ClassBuff[] = [];
        const membersOf = new LuaMap<ClassBuff, Member[]>();
        for (const member of members) {
            const buff = this.pickMemberBlessing(group, member);
            const list = membersOf.get(buff) ?? [];
            if (list.length === 0) buffs.push(buff);
            list.push(member);
            membersOf.set(buff, list);
        }
        return buffs.flatMap((buff) => this.buildSuggestionsFor(buff, membersOf.get(buff)!));
    }

    /** The key of the blessing last given to a class, in the saved settings ("19740:PRIEST"). */
    private getClassKey(group: ClassBuff[], classToken: string): string {
        return `${this.classBuffs.getGroupKey(group[0]!)}:${classToken}`;
    }

    /** A member with one of the player's blessings shows the one the player gives its class (kept per character). */
    private noteGivenBlessings(group: ClassBuff[], members: Member[]): void {
        const spellsOf = group.map((buff): [number, number[]] => [buff.id, [buff.id, ...(buff.party?.groupIds ?? [])]]);
        for (const member of members) {
            const given = this.auras.findOwnUnitBuff(member.unit, spellsOf);
            const key = this.getClassKey(group, member.classToken);
            const lastBuffs = this.settings.get("lastBuffs");
            if (given !== undefined && lastBuffs[key] !== given) this.settings.change("lastBuffs", { ...lastBuffs, [key]: given });
        }
    }

    /** The blessing for a member: the one last given to its class, else the first of PARTY_BLESSINGS the player knows. */
    private pickMemberBlessing(group: ClassBuff[], member: Member): ClassBuff {
        const last = this.settings.get("lastBuffs")[this.getClassKey(group, member.classToken)];
        const order = this.party.doesUseMana(member.unit) ? PARTY_BLESSINGS.mana : PARTY_BLESSINGS.other;
        for (const id of [...(last !== undefined ? [last] : []), ...order]) {
            const found = group.find((buff) => buff.id === id);
            if (found !== undefined) return found;
        }
        return group[0]!;
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
