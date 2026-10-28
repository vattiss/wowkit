// Which buffs of the class list are missing. Of a group (one paladin aura, one armor) one glows: the one the player cast
// last, else the one their main talent tree wants, else the first in the list; always one that is on the bars and
// switched on, so a buff the player switched off hands the glow to the next.

import { OnEvent } from "@wowkit/core";
import type { BuffStateService } from "../character/buff-state.service";
import type { ActionBarsService, PlayerService, PlayerSpellCast, SpellsService } from "@wowkit/wow";
import type { AddonSettingsService } from "../settings/settings.interface";
import type { ClassBuff } from "./class-buff.interface";
import { TALENT_BUFFS } from "./class-buffs.constants";
import type { ClassBuffsService } from "./class-buffs.service";
import type { BuffCheck, MissingBuffs } from "./reminders.interface";

export class BuffReminderService {
    constructor(
        private readonly auras: BuffStateService,
        private readonly spells: SpellsService,
        private readonly player: PlayerService,
        private readonly actionBars: ActionBarsService,
        private readonly classBuffs: ClassBuffsService,
        private readonly settings: AddonSettingsService,
    ) {}

    /** Is this buff worth asking for now? */
    checkBuff(classBuff: ClassBuff): BuffCheck {
        const id = this.spells.resolve(classBuff.id);
        if (id === undefined || !this.spells.isLearned(id)) return { isWanted: false };
        if (classBuff.isSwimmingOnly && !this.player.isSwimming()) return { isWanted: false };
        for (const other of classBuff.categoryMembers ?? []) {
            if (this.auras.hasAura(other)) return { isWanted: false };
        }
        // hasAura reads the aura, and falls back on what was seen or cast while the client hides auras
        if (this.auras.hasAura(id, classBuff.lead)) return { isWanted: false };
        return { isWanted: true };
    }

    /**
     * Looks at the buffs of the list out of combat, whether or not a reminder is due, so the aura
     * memory knows them: a buff put on in town still counts once the client hides auras.
     */
    rememberSelfBuffs(): void {
        if (this.player.isInCombat()) return;
        for (const classBuff of this.classBuffs.getClassBuffs()) {
            if (this.classBuffs.isBuffEnabled(classBuff)) {
                const id = this.spells.resolve(classBuff.id);
                if (id !== undefined) this.auras.hasAura(id);
            }
        }
    }

    /** A buff of a group the player casts is the one of the group to glow from now on (kept per character). */
    @OnEvent("player.spell-cast")
    noteCast(cast: PlayerSpellCast): void {
        if (cast.spellId === undefined) return;
        const id = this.spells.resolveOrSame(cast.spellId);
        const castBuff = this.classBuffs
            .getClassBuffs()
            .find((classBuff) => classBuff.categoryMembers !== undefined && (this.spells.resolve(classBuff.id) ?? classBuff.id) === id);
        if (castBuff === undefined) return;
        const group = this.getGroupKey(castBuff);
        const lastBuffs = this.settings.get("lastBuffs");
        if (lastBuffs[group] !== castBuff.id) this.settings.change("lastBuffs", { ...lastBuffs, [group]: castBuff.id });
    }

    /**
     * The missing buffs in list order, one of each group; when a member of a group is on the bars nothing of the group
     * is named in the "not on your bars" message, else the first one.
     */
    findMissingBuffs(): MissingBuffs {
        // The buffs that could glow, by group (a buff of no group is a group of its own), in list order
        const groups: ClassBuff[][] = [];
        const groupOf = new LuaMap<object, ClassBuff[]>();
        const candidates: { id: number; category: object }[] = [];
        const categoryOnBars = new LuaSet<object>();
        for (const classBuff of this.classBuffs.getClassBuffs()) {
            if (!this.classBuffs.isBuffEnabled(classBuff) || !this.checkBuff(classBuff).isWanted) continue;
            const id = this.spells.resolve(classBuff.id) ?? classBuff.id;
            const category = classBuff.categoryMembers ?? classBuff;
            if (!this.actionBars.isOnBars(id)) {
                candidates.push({ id, category });
                continue;
            }
            categoryOnBars.add(category);
            // Only a buff that can be cast now glows (Battle Shout waits for rage); one the client gives no answer about
            // still does
            if (this.spells.isCastable(id) === false) continue;
            let members = groupOf.get(category);
            if (members === undefined) {
                members = [];
                groupOf.set(category, members);
                groups.push(members);
            }
            members.push(classBuff);
        }
        const glow = groups.map((members) => {
            const picked = this.pickGroupBuff(members);
            return this.spells.resolve(picked.id) ?? picked.id;
        });
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

    /** Of the buffs of a group that could glow: the one cast last, else the main talent tree's, else the first. */
    private pickGroupBuff(members: ClassBuff[]): ClassBuff {
        const first = members[0]!;
        if (members.length === 1) return first;
        const last = this.settings.get("lastBuffs")[this.getGroupKey(first)];
        const castLast = members.find((member) => member.id === last);
        if (castLast !== undefined) return castLast;
        const tree = this.player.findMainTalentTree();
        const token = this.player.getClassToken();
        const wanted = tree !== undefined && token !== undefined ? (TALENT_BUFFS[token]?.[tree] ?? []) : [];
        for (const id of wanted) {
            const found = members.find((member) => member.id === id);
            if (found !== undefined) return found;
        }
        return first;
    }

    /** The key of a buff's group in the saved settings: the group's first spell ID. */
    private getGroupKey(classBuff: ClassBuff): string {
        return string.format("%d", classBuff.categoryMembers?.[0] ?? classBuff.id);
    }
}
